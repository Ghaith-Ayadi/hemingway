/// <reference path="../node_modules/@figma/plugin-typings/index.d.ts" />
// Hemingway plugin main thread
// Handles all Figma API calls: reading styles, creating/updating A4 frames, tagging nodes.

import {
  Block, BlockType, StyleMap, MarginSettings, PluginSettings,
  UiMessage, PluginMessage,
  A4_WIDTH, A4_HEIGHT,
} from './types'
import { tokenize } from './syntax'

const CODE_PAD         = 16  // pt — top/bottom/right inner padding of code frame
const LINE_NUM_COL     = 28  // pt — width of line number column
const LINE_NUM_GAP     = 12  // pt — gap between line numbers and code text
const LINE_NUM_RESERVED = LINE_NUM_COL + LINE_NUM_GAP  // 40pt total reserved on the left

// ── Plugin entry ─────────────────────────────────────────────────────────────

figma.showUI(__html__, { width: 400, height: 600, themeColors: true })

figma.ui.onmessage = async (msg: UiMessage) => {
  switch (msg.type) {
    case 'get-styles':
      await sendStyles()
      break
    case 'compose':
      await compose(msg.settings, false)
      break
    case 'repaginate':
      await compose(msg.settings, true)
      break
    case 'resize':
      figma.ui.resize(msg.width, msg.height)
      break
  }
}

function send(msg: PluginMessage) {
  figma.ui.postMessage(msg)
}

function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  send({ type: 'log', level, message })
}

// ── Style discovery ───────────────────────────────────────────────────────────

async function sendStyles() {
  const styles = (await figma.getLocalTextStylesAsync()).map(s => ({ id: s.id, name: s.name }))
  send({ type: 'styles-list', styles })
}

// ── Compose / Re-paginate ─────────────────────────────────────────────────────

async function compose(settings: PluginSettings, isRepaginate: boolean) {
  try {
    // 1. Fetch blocks from proxy
    log('Fetching Notion content…')
    const blocks = await fetchBlocks(settings.notionUrl, settings.proxyUrl)
    log(`Fetched ${blocks.length} blocks`)

    // 2. Collect user-added elements if repaginating
    let userElements: UserElement[] = []
    if (isRepaginate) {
      userElements = collectUserElements()
      log(`Found ${userElements.length} user-added element(s)`)

      // Check for text drift
      const drifted = detectDrift(blocks)
      if (drifted.length > 0) {
        log(`⚠ ${drifted.length} block(s) edited in Figma — Notion is the source of truth. Figma edits will be overwritten.`, 'warn')
      }
    }

    // 3. Load fonts for all assigned styles
    await loadFontsForStyles(settings.styleMap)

    // 4. Split long code blocks into page-fitting line chunks
    const contentHeight = A4_HEIGHT - settings.margins.top - settings.margins.bottom
    const contentWidth  = A4_WIDTH  - settings.margins.left - settings.margins.right
    const processedBlocks = await splitCodeBlocks(blocks, contentWidth, contentHeight, settings)
    log(`${processedBlocks.length} blocks after code splitting`)

    // 5. Measure blocks
    log(`Measuring ${processedBlocks.length} blocks…`)
    const measured = await measureBlocks(processedBlocks, settings)
    const totalH = measured.reduce((s, m) => s + m.height, 0)
    log(`Total content height: ${Math.round(totalH)}pt`)

    // 5. Paginate
    log('Paginating…')
    const pages = paginate(measured, userElements, settings.margins, settings.styleMap, settings.newPageOnDivider, settings.newPageOnH1, settings.newPageOnH2)
    log(`Blocks per page: ${pages.map(p => p.items.length).join(', ')}`)
    log(`${pages.length} page(s) — content height per page: ${A4_HEIGHT - settings.margins.top - settings.margins.bottom}pt`)

    // 6. Write to Figma
    log('Writing frames…')
    await writePages(pages, settings)

    log(`Done — ${pages.length} page(s)`)
    send({ type: 'done', pageCount: pages.length })
  } catch (err: any) {
    const msg = err?.message ?? String(err) ?? 'Unknown error'
    send({ type: 'error', message: msg })
  }
}

// ── Network ───────────────────────────────────────────────────────────────────

async function fetchBlocks(notionUrl: string, proxyUrl: string): Promise<Block[]> {
  const res = await fetch(`${proxyUrl}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: notionUrl }),
  })
  if (!res.ok) throw new Error(`Proxy error: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.blocks
}

// ── Code block line splitting ─────────────────────────────────────────────────

async function splitCodeBlocks(
  blocks: Block[],
  contentWidth: number,
  contentHeight: number,
  settings: PluginSettings
): Promise<Block[]> {
  const result: Block[] = []
  const maxHeight = contentHeight - CODE_PAD * 2

  // Pre-fetch the code text style once for all splits
  const codeStyleId = settings.styleMap['code']?.figmaStyleId
  const codeTextStyle = codeStyleId
    ? await figma.getStyleByIdAsync(codeStyleId) as TextStyle | null
    : null

  for (const block of blocks) {
    if (block.type !== 'code') { result.push(block); continue }

    const lines = block.content.map(r => r.text).join('').split('\n')

    // Measure the full block — if it fits, no split needed
    const fullHeight = measureCodeChunkHeight(lines, contentWidth, codeTextStyle)
    if (fullHeight <= contentHeight) { result.push(block); continue }

    // Binary-search for the max number of source lines that fit per page.
    // This accounts for wrapping: long lines occupy more than one visual row.
    let remaining = lines
    let chunkIndex = 0
    let lineOffset = 0
    while (remaining.length > 0) {
      let lo = 1, hi = remaining.length, splitAt = 1
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        const h = measureCodeChunkHeight(remaining.slice(0, mid), contentWidth, codeTextStyle)
        if (h <= maxHeight) { splitAt = mid; lo = mid + 1 }
        else { hi = mid - 1 }
      }

      const chunk = remaining.slice(0, splitAt).join('\n')
      result.push({
        ...block,
        id: `${block.id}__chunk__${chunkIndex}`,
        content: [{ text: chunk }],
        isCodeContinuation: chunkIndex > 0,
        codeLineStart: lineOffset + 1,
      })

      lineOffset += splitAt
      remaining = remaining.slice(splitAt)
      chunkIndex++
    }
  }

  return result
}

// Measure the rendered height of a set of code lines as a Figma text node.
// Fonts and textStyle must already be resolved before calling this.
function measureCodeChunkHeight(lines: string[], contentWidth: number, textStyle: TextStyle | null): number {
  const node = figma.createText()
  node.resize(contentWidth - CODE_PAD * 2 - LINE_NUM_RESERVED, 100)
  node.textAutoResize = 'HEIGHT'

  if (textStyle) {
    node.textStyleId = textStyle.id
  } else {
    node.fontName = { family: 'Roboto Mono', style: 'Regular' }
    node.fontSize = 11
  }

  node.characters = lines.join('\n') || ' '
  const h = node.height + CODE_PAD * 2
  node.remove()
  return h
}

// ── Font loading ──────────────────────────────────────────────────────────────

async function loadFontsForStyles(styleMap: StyleMap) {
  const styleIds = [...new Set(Object.values(styleMap).map(s => s.figmaStyleId).filter(Boolean))] as string[]
  const fontNames: FontName[] = [
    { family: 'Inter',       style: 'Regular' },
    { family: 'Inter',       style: 'Bold'    },
    { family: 'Inter',       style: 'Italic'  },
    { family: 'Roboto Mono', style: 'Regular' },
  ]
  for (const id of styleIds) {
    const style = await figma.getStyleByIdAsync(id) as TextStyle | null
    if (style) fontNames.push(style.fontName)
  }
  // Load all fonts in parallel, gracefully skip unavailable fonts
  const uniqueFonts = [...new Set(fontNames.map(f => JSON.stringify(f)))].map(s => JSON.parse(s) as FontName)
  const results = await Promise.allSettled(uniqueFonts.map(f => figma.loadFontAsync(f)))
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      log(`⚠ Font not available: ${uniqueFonts[i].family} ${uniqueFonts[i].style} — will fall back`, 'warn')
    }
  })
}

// ── Block measurement ─────────────────────────────────────────────────────────

interface MeasuredBlock {
  block: Block
  height: number  // pt
}

// Fonts must already be loaded before calling this (via loadFontsForStyles)
async function measureBlocks(blocks: Block[], settings: PluginSettings): Promise<MeasuredBlock[]> {
  const contentWidth = A4_WIDTH - settings.margins.left - settings.margins.right
  const measured: MeasuredBlock[] = []

  // Pre-fetch all unique text styles so the measurement loop stays synchronous
  const styleIds = [...new Set(
    Object.values(settings.styleMap).map(a => a.figmaStyleId).filter(Boolean) as string[]
  )]
  const styleCache = new Map<string, TextStyle | null>()
  await Promise.all(styleIds.map(async id => {
    styleCache.set(id, await figma.getStyleByIdAsync(id) as TextStyle | null)
  }))

  for (const block of blocks) {
    if (block.type === 'divider') { measured.push({ block, height: 1 }); continue }
    if (block.type === 'image')   { measured.push({ block, height: 200 }); continue }

    const styleAssignment = settings.styleMap[block.type]
    const textStyle = styleAssignment?.figmaStyleId
      ? styleCache.get(styleAssignment.figmaStyleId) ?? null
      : null

    const isCode   = block.type === 'code'
    const padWidth = isCode ? CODE_PAD * 2 + LINE_NUM_RESERVED : 0
    const indent   = isCode ? 0 : getIndent(block.type)

    const node = figma.createText()
    node.resize(contentWidth - padWidth - indent, 100)
    node.textAutoResize = 'HEIGHT'

    if (textStyle) {
      node.textStyleId = textStyle.id
    } else if (isCode) {
      node.fontName = { family: 'Roboto Mono', style: 'Regular' }
      node.fontSize = 11
    } else {
      node.fontName = { family: 'Inter', style: 'Regular' }
      node.fontSize = getDefaultFontSize(block.type)
      node.lineHeight = { unit: 'PERCENT', value: 140 }
    }

    const text = block.content.map(r => r.text).join('')
    node.characters = text || ' '

    const height = node.height + (isCode ? CODE_PAD * 2 : 0)
    node.remove()

    measured.push({ block, height })

    if (measured.length % 50 === 0) {
      send({ type: 'log', level: 'info', message: `  measured ${measured.length}/${blocks.length}…` })
    }
  }

  return measured
}


function getIndent(type: BlockType): number {
  if (['bulleted_list_item', 'numbered_list_item', 'to_do'].includes(type)) return 20
  return 0
}

function getDefaultFontSize(type: BlockType): number {
  if (type === 'heading_1') return 36
  if (type === 'heading_2') return 28
  if (type === 'heading_3') return 22
  if (type === 'code') return 11
  return 12
}

// ── User element collection ───────────────────────────────────────────────────

interface UserElement {
  type: 'spacer' | 'image' | 'footer'
  afterBlockId: string  // insert after this block ID
  height: number
  node: SceneNode
}

function collectUserElements(): UserElement[] {
  const elements: UserElement[] = []
  const pages = getExistingHwPages()
  for (const page of pages) {
    for (const child of page.children) {
      const hwType = child.getPluginData('hw-type')
      if (hwType === 'spacer' || hwType === 'image-user' || hwType === 'footer') {
        const afterBlockId = child.getPluginData('hw-after-block')
        elements.push({
          type: hwType as UserElement['type'],
          afterBlockId,
          height: (child as FrameNode).height,
          node: child,
        })
      }
    }
  }
  return elements
}

function getExistingHwPages(): FrameNode[] {
  return figma.currentPage.children.filter(
    n => n.type === 'FRAME' && n.getPluginData('hw-type') === 'page'
  ) as FrameNode[]
}

// ── Drift detection ───────────────────────────────────────────────────────────

function detectDrift(freshBlocks: Block[]): string[] {
  const freshMap = new Map(freshBlocks.map(b => [b.id, b.content.map(r => r.text).join('')]))
  const drifted: string[] = []

  const pages = getExistingHwPages()
  for (const page of pages) {
    for (const child of page.children) {
      const blockId = child.getPluginData('hw-block-id')
      const originalText = child.getPluginData('hw-notion-text')
      if (!blockId || !originalText) continue
      const freshText = freshMap.get(blockId)
      if (freshText === undefined) continue
      if (child.type === 'TEXT' && child.characters !== originalText) {
        drifted.push(blockId)
      }
    }
  }
  return drifted
}

// ── Pagination ────────────────────────────────────────────────────────────────

interface PageContent {
  items: PageItem[]
}

interface PageItem {
  block?: Block
  userElement?: UserElement
  height: number
  marginTop: number
  marginBottom: number
}

function paginate(
  measured: MeasuredBlock[],
  userElements: UserElement[],
  margins: MarginSettings,
  styleMap: StyleMap,
  newPageOnDivider: boolean,
  newPageOnH1: boolean,
  newPageOnH2: boolean,
): PageContent[] {
  const contentHeight = A4_HEIGHT - margins.top - margins.bottom
  const pages: PageContent[] = [{ items: [] }]
  let currentY = 0

  const userAfterMap = new Map<string, UserElement[]>()
  for (const ue of userElements) {
    if (!userAfterMap.has(ue.afterBlockId)) userAfterMap.set(ue.afterBlockId, [])
    userAfterMap.get(ue.afterBlockId)!.push(ue)
  }

  function currentPage() { return pages[pages.length - 1] }

  function addItem(item: PageItem) {
    const totalH = item.marginTop + item.height + item.marginBottom
    if (currentY + totalH > contentHeight && currentPage().items.length > 0) {
      pages.push({ items: [] })
      currentY = 0
    }
    currentPage().items.push(item)
    currentY += totalH
  }

  const LIST_TYPES = new Set<string>(['bulleted_list_item', 'numbered_list_item', 'to_do'])

  for (let i = 0; i < measured.length; i++) {
    const { block, height } = measured[i]

    // Page-break triggers — force a new page before this block (heading stays on new page)
    const forceBreak =
      (block.type === 'divider'   && newPageOnDivider) ||
      (block.type === 'heading_1' && newPageOnH1) ||
      (block.type === 'heading_2' && newPageOnH2)
    if (forceBreak) {
      if (currentPage().items.length > 0) { pages.push({ items: [] }); currentY = 0 }
      if (block.type === 'divider') continue  // divider itself not rendered
    }

    const assignment = styleMap[block.type]
    let marginTop    = assignment?.marginTop    ?? 0
    let marginBottom = assignment?.marginBottom ?? 0

    if (LIST_TYPES.has(block.type)) {
      const prevBlock = i > 0 ? measured[i - 1].block : null
      const nextBlock = measured[i + 1]?.block
      const isFirst   = !prevBlock || !LIST_TYPES.has(prevBlock.type)
      const isLast    = !nextBlock  || !LIST_TYPES.has(nextBlock.type)

      // Pull the first item closer to the preceding paragraph
      if (isFirst && prevBlock) marginTop = -6
      // Tight between items, generous gap after the group
      marginBottom = isLast ? 16 : 2
    }

    addItem({ block, height, marginTop, marginBottom })

    const ues = userAfterMap.get(block.id) ?? []
    for (const ue of ues) {
      addItem({ userElement: ue, height: ue.height, marginTop: 0, marginBottom: 0 })
    }
  }

  return pages
}

// ── Figma frame writing ───────────────────────────────────────────────────────

async function writePages(pages: PageContent[], settings: PluginSettings) {
  // Remove old generated pages
  const existing = getExistingHwPages()
  for (const p of existing) p.remove()

  const startX = figma.viewport.center.x - A4_WIDTH / 2
  const startY = figma.viewport.center.y - A4_HEIGHT / 2

  for (let pi = 0; pi < pages.length; pi++) {
    const pageFrame = figma.createFrame()
    pageFrame.name = `[hw] Page ${pi + 1}`
    pageFrame.resize(A4_WIDTH, A4_HEIGHT)
    pageFrame.x = startX + pi * (A4_WIDTH + 40)
    pageFrame.y = startY
    pageFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
    pageFrame.setPluginData('hw-type', 'page')
    pageFrame.setPluginData('hw-page-index', String(pi))
    pageFrame.layoutMode = 'NONE'
    pageFrame.clipsContent = true

    let y = settings.margins.top
    const { left, right } = settings.margins
    const contentWidth = A4_WIDTH - left - right

    for (const item of pages[pi].items) {
      if (item.userElement) {
        // Re-attach user element
        const clone = item.userElement.node.clone() as FrameNode
        clone.x = left
        clone.y = y
        clone.resize(contentWidth, item.height)
        pageFrame.appendChild(clone)
        y += item.height
        continue
      }

      const block = item.block!
      const assignment = settings.styleMap[block.type]
      y += item.marginTop

      const node = await renderBlockNode(block, assignment, contentWidth)
      if (node) {
        node.x = left
        node.y = y
        pageFrame.appendChild(node)
        // Use pre-measured height to stay in sync with paginator
        y += item.height
      }

      y += item.marginBottom
    }

    figma.currentPage.appendChild(pageFrame)
  }

  figma.viewport.scrollAndZoomIntoView(getExistingHwPages())
}

// ── Block node rendering ──────────────────────────────────────────────────────

async function renderBlockNode(
  block: Block,
  assignment: { figmaStyleId: string | null; marginTop: number; marginBottom: number },
  contentWidth: number,
): Promise<SceneNode | null> {

  if (block.type === 'divider') {
    const line = figma.createLine()
    line.resize(contentWidth, 0)
    line.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }]
    line.strokeWeight = 1
    tagNode(line, block)
    return line
  }

  if (block.type === 'image') {
    const rect = figma.createRectangle()
    rect.resize(contentWidth, 200)
    rect.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }]
    rect.setPluginData('hw-type', 'image')
    tagNode(rect, block)
    return rect
  }

  if (block.type === 'code') {
    return renderCodeBlock(block, assignment, contentWidth)
  }

  // ── Text node ─────────────────────────────────────────────────────────────

  const textStyle = assignment.figmaStyleId
    ? await figma.getStyleByIdAsync(assignment.figmaStyleId) as TextStyle | null
    : null

  const indent = getIndent(block.type)
  const effectiveWidth = contentWidth - indent

  const textNode = figma.createText()
  textNode.resize(effectiveWidth, 100)
  textNode.textAutoResize = 'HEIGHT'

  if (textStyle) {
    await figma.loadFontAsync(textStyle.fontName)
    textNode.textStyleId = textStyle.id
  } else {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    textNode.fontName = { family: 'Inter', style: 'Regular' }
    textNode.fontSize = getDefaultFontSize(block.type)
  }

  const fullText = block.content.map(r => r.text).join('')
  textNode.characters = fullText || ' '

  // Apply per-run formatting (bold, italic, links)
  let charOffset = 0
  for (const run of block.content) {
    const len = run.text.length
    if (len === 0) continue
    const family = textStyle?.fontName.family ?? 'Inter'
    if (run.bold || run.italic) {
      // Try the most specific variant first, fall back gracefully
      const variants = run.bold && run.italic
        ? ['Bold Italic', 'Bold', 'Italic', 'Regular']
        : run.bold
          ? ['Bold', 'Semibold', 'Medium', 'Regular']
          : ['Italic', 'Regular']
      let loaded: FontName | null = null
      for (const style of variants) {
        try {
          const f: FontName = { family, style }
          await figma.loadFontAsync(f)
          loaded = f
          break
        } catch { /* variant unavailable, try next */ }
      }
      if (loaded) textNode.setRangeFontName(charOffset, charOffset + len, loaded)
    }
    if (run.link) {
      textNode.setRangeHyperlink(charOffset, charOffset + len, { type: 'URL', value: run.link })
      textNode.setRangeFills(charOffset, charOffset + len, [{ type: 'SOLID', color: { r: 0.1, g: 0.37, b: 0.84 } }])
    }
    charOffset += len
  }

  tagNode(textNode, block)

  // Wrap in frame for list items (to add bullet/number)
  if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item' || block.type === 'to_do') {
    const wrapper = figma.createFrame()
    wrapper.layoutMode = 'HORIZONTAL'
    wrapper.primaryAxisSizingMode = 'FIXED'
    wrapper.counterAxisSizingMode = 'AUTO'
    wrapper.resize(contentWidth, 100)
    wrapper.fills = []
    wrapper.itemSpacing = 8

    const bulletNode = figma.createText()
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    bulletNode.fontName = { family: 'Inter', style: 'Regular' }
    bulletNode.fontSize = textNode.fontSize
    bulletNode.characters =
      block.type === 'bulleted_list_item' ? '•' :
      block.type === 'numbered_list_item' ? `${block.index}.` :
      block.checked ? '☑' : '☐'

    textNode.layoutGrow = 1  // fill remaining width in horizontal auto-layout
    wrapper.appendChild(bulletNode)
    wrapper.appendChild(textNode)
    wrapper.setPluginData('hw-type', 'block')
    tagNode(wrapper as unknown as SceneNode, block)
    return wrapper
  }

  return textNode
}

async function renderCodeBlock(
  block: Block,
  assignment: { figmaStyleId: string | null; marginTop: number; marginBottom: number },
  contentWidth: number,
): Promise<FrameNode> {
  const textStyle = assignment.figmaStyleId
    ? await figma.getStyleByIdAsync(assignment.figmaStyleId) as TextStyle | null
    : null

  const codeFont: FontName = textStyle?.fontName ?? { family: 'Roboto Mono', style: 'Regular' }
  await figma.loadFontAsync(codeFont)

  const GH_BG       = { r: 0.965, g: 0.973, b: 0.980 }  // #f6f8fa
  const GH_TEXT     = { r: 0.141, g: 0.161, b: 0.184 }  // #24292f
  const GH_LINENUM  = { r: 0.549, g: 0.584, b: 0.624 }  // #8c959f

  const code      = block.content.map(r => r.text).join('')
  const lines     = code.split('\n')
  const lineStart = block.codeLineStart ?? 1
  const lineEnd   = lineStart + lines.length - 1
  const digits    = Math.max(2, String(lineEnd).length)

  // ── Code text node ────────────────────────────────────────────────────────
  const codeX = CODE_PAD + LINE_NUM_RESERVED
  const textNode = figma.createText()
  textNode.resize(contentWidth - codeX - CODE_PAD, 100)
  textNode.textAutoResize = 'HEIGHT'

  if (textStyle) {
    textNode.textStyleId = textStyle.id
  } else {
    textNode.fontName = codeFont
    textNode.fontSize = 11
  }

  textNode.characters = code || ' '
  textNode.fills = [{ type: 'SOLID', color: GH_TEXT }]

  const language = block.language ?? 'plain'
  const colorRanges = tokenize(code, language)
  for (const { start, end, color } of colorRanges) {
    if (start < end && end <= code.length) {
      textNode.setRangeFills(start, end, [{ type: 'SOLID', color }])
    }
  }

  // ── Line numbers node (separate layer → copy-paste of code excludes them) ─
  const lineNumNode = figma.createText()
  lineNumNode.resize(LINE_NUM_COL, 100)
  lineNumNode.textAutoResize = 'HEIGHT'
  lineNumNode.textAlignHorizontal = 'RIGHT'
  if (textStyle) {
    lineNumNode.textStyleId = textStyle.id
  } else {
    lineNumNode.fontName = codeFont
    lineNumNode.fontSize = 11
  }
  lineNumNode.characters = lines.map((_, i) => String(lineStart + i).padStart(digits, '0')).join('\n')
  lineNumNode.fills = [{ type: 'SOLID', color: GH_LINENUM }]

  // ── Wrap in frame with GitHub light background ─────────────────────────────
  const frameH = textNode.height + CODE_PAD * 2
  const frame = figma.createFrame()
  frame.resize(contentWidth, frameH)
  frame.fills = [{ type: 'SOLID', color: GH_BG }]
  frame.cornerRadius = block.isCodeContinuation ? 0 : 4
  frame.layoutMode = 'NONE'

  lineNumNode.x = CODE_PAD
  lineNumNode.y = CODE_PAD
  textNode.x = codeX
  textNode.y = CODE_PAD
  frame.appendChild(lineNumNode)
  frame.appendChild(textNode)

  tagNode(frame, block)
  return frame
}

function tagNode(node: SceneNode, block: Block) {
  node.setPluginData('hw-type', 'block')
  node.setPluginData('hw-block-id', block.id)
  node.setPluginData('hw-block-type', block.type)
  node.setPluginData('hw-notion-text', block.content.map(r => r.text).join(''))
}
