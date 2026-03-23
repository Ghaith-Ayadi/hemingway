/// <reference path="../node_modules/@figma/plugin-typings/index.d.ts" />
// Hemingway plugin main thread
// Handles all Figma API calls: reading styles, creating/updating A4 frames, tagging nodes.

import {
  Block, BlockType, StyleMap, MarginSettings, PluginSettings,
  UiMessage, PluginMessage,
  A4_WIDTH, A4_HEIGHT,
} from './types'

// ── Plugin entry ─────────────────────────────────────────────────────────────

figma.showUI(__html__, { width: 400, height: 600, themeColors: true })

figma.ui.onmessage = async (msg: UiMessage) => {
  switch (msg.type) {
    case 'get-styles':
      sendStyles()
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

function sendStyles() {
  const styles = figma.getLocalTextStyles().map(s => ({ id: s.id, name: s.name }))
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

    // 4. Measure blocks
    log('Measuring blocks…')
    const measured = await measureBlocks(blocks, settings)

    // 5. Paginate
    log('Paginating…')
    const pages = paginate(measured, userElements, settings.margins)
    log(`Created ${pages.length} page(s)`)

    // 6. Write to Figma
    log('Writing frames…')
    await writePages(pages, blocks, settings)

    log(`Done — ${pages.length} page(s)`)
    send({ type: 'done', pageCount: pages.length })
  } catch (err: any) {
    send({ type: 'error', message: err.message })
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

// ── Font loading ──────────────────────────────────────────────────────────────

async function loadFontsForStyles(styleMap: StyleMap) {
  const styleIds = [...new Set(Object.values(styleMap).map(s => s.figmaStyleId).filter(Boolean))] as string[]
  for (const id of styleIds) {
    const style = figma.getStyleById(id) as TextStyle | null
    if (style) {
      await figma.loadFontAsync(style.fontName)
    }
  }
  // Always load a fallback font
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' })
  await figma.loadFontAsync({ family: 'Inter', style: 'Italic' })
}

// ── Block measurement ─────────────────────────────────────────────────────────

interface MeasuredBlock {
  block: Block
  height: number  // pt
}

async function measureBlocks(blocks: Block[], settings: PluginSettings): Promise<MeasuredBlock[]> {
  const contentWidth = A4_WIDTH - settings.margins.left - settings.margins.right
  const measured: MeasuredBlock[] = []

  for (const block of blocks) {
    if (block.type === 'divider') {
      measured.push({ block, height: 1 })
      continue
    }
    if (block.type === 'image') {
      // Fixed height placeholder for images (will be scaled on render)
      measured.push({ block, height: 200 })
      continue
    }

    const styleAssignment = settings.styleMap[block.type]
    const textStyle = styleAssignment?.figmaStyleId
      ? figma.getStyleById(styleAssignment.figmaStyleId) as TextStyle | null
      : null

    // Create a temporary text node to measure
    const node = figma.createText()
    node.resize(contentWidth - getIndent(block.type), 100)

    if (textStyle) {
      await figma.loadFontAsync(textStyle.fontName)
      node.textStyleId = textStyle.id
    } else {
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
      node.fontName = { family: 'Inter', style: 'Regular' }
      node.fontSize = getDefaultFontSize(block.type)
      node.lineHeight = { unit: 'PERCENT', value: 140 }
    }

    const text = block.content.map(r => r.text).join('')
    node.characters = text || ' '
    node.textAutoResize = 'HEIGHT'

    const height = node.height
    node.remove()

    measured.push({ block, height })
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
  margins: MarginSettings
): PageContent[] {
  const contentHeight = A4_HEIGHT - margins.top - margins.bottom
  const pages: PageContent[] = [{ items: [] }]
  let currentY = 0

  // Build a map: blockId → user elements that come after it
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

  for (const { block, height } of measured) {
    const style = { marginTop: 0, marginBottom: 0 }  // will be read from styleMap in writePages
    addItem({ block, height, marginTop: 0, marginBottom: 0 })

    // Insert user elements that follow this block
    const ues = userAfterMap.get(block.id) ?? []
    for (const ue of ues) {
      addItem({ userElement: ue, height: ue.height, marginTop: 0, marginBottom: 0 })
    }
  }

  return pages
}

// ── Figma frame writing ───────────────────────────────────────────────────────

async function writePages(pages: PageContent[], allBlocks: Block[], settings: PluginSettings) {
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
      y += assignment.marginTop

      const node = await renderBlockNode(block, assignment, contentWidth, settings)
      if (node) {
        node.x = left
        node.y = y
        pageFrame.appendChild(node)
        y += node.height
      }

      y += assignment.marginBottom
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
  settings: PluginSettings
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
    // Placeholder rectangle — user replaces with actual image
    const rect = figma.createRectangle()
    rect.resize(contentWidth, 200)
    rect.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }]
    rect.setPluginData('hw-type', 'image')
    tagNode(rect, block)
    return rect
  }

  // Text node
  const textStyle = assignment.figmaStyleId
    ? figma.getStyleById(assignment.figmaStyleId) as TextStyle | null
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

  // Set text with rich text formatting
  const fullText = block.content.map(r => r.text).join('')
  textNode.characters = fullText || ' '

  // Apply per-run formatting
  let charOffset = 0
  for (const run of block.content) {
    const len = run.text.length
    if (len === 0) continue
    if (run.bold) {
      const boldFont = { family: textStyle?.fontName.family ?? 'Inter', style: 'Bold' }
      await figma.loadFontAsync(boldFont)
      textNode.setRangeFontName(charOffset, charOffset + len, boldFont)
      // fontWeight is set via fontName (Bold style), not setRangeFontWeight
    }
    if (run.italic) {
      const italicFont = { family: textStyle?.fontName.family ?? 'Inter', style: 'Italic' }
      await figma.loadFontAsync(italicFont)
      textNode.setRangeFontName(charOffset, charOffset + len, italicFont)
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

    wrapper.appendChild(bulletNode)
    wrapper.appendChild(textNode)
    wrapper.setPluginData('hw-type', 'block')
    tagNode(wrapper as unknown as SceneNode, block)
    return wrapper
  }

  return textNode
}

function tagNode(node: SceneNode, block: Block) {
  node.setPluginData('hw-type', 'block')
  node.setPluginData('hw-block-id', block.id)
  node.setPluginData('hw-block-type', block.type)
  node.setPluginData('hw-notion-text', block.content.map(r => r.text).join(''))
}
