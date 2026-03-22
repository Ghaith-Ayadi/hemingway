// splitBlock — Splits a text block across a page boundary at the word level.
// Binary-searches for the max words fitting in availableHeight, then applies widow/orphan rules:
// a widow (1-line bottom fragment) or orphan (1-line top fragment) cancels the split.

import { renderBlockToEl } from './renderBlock.js'

const SPLITTABLE = new Set(['paragraph', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'quote'])

export function canSplit(block) {
  return SPLITTABLE.has(block.type) && block.content?.length > 0
}

// Flatten RichTextRun[] to per-character entries, then group into word tokens.
// Each token = { text: 'word ', bold, italic, code } — trailing space included in token.
function runsToWords(runs) {
  const chars = []
  for (const run of runs) {
    const fmt = { bold: !!run.bold, italic: !!run.italic, code: !!run.code }
    for (const ch of run.text) chars.push({ ch, ...fmt })
  }

  const words = []
  let i = 0
  while (i < chars.length) {
    if (/\s/.test(chars[i].ch)) {
      if (words.length > 0) words[words.length - 1].text += chars[i].ch
      i++
    } else {
      const fmt = { bold: chars[i].bold, italic: chars[i].italic, code: chars[i].code }
      let text = ''
      while (i < chars.length && !/\s/.test(chars[i].ch)) { text += chars[i].ch; i++ }
      while (i < chars.length &&  /\s/.test(chars[i].ch)) { text += chars[i].ch; i++ }
      words.push({ text, ...fmt })
    }
  }
  return words
}

// Merge adjacent same-formatted word tokens back into RichTextRun[]
function wordsToRuns(words) {
  const runs = []
  for (const w of words) {
    const last = runs[runs.length - 1]
    if (last && !!last.bold === w.bold && !!last.italic === w.italic && !!last.code === w.code) {
      last.text += w.text
    } else {
      const run = { text: w.text }
      if (w.bold)   run.bold   = true
      if (w.italic) run.italic = true
      if (w.code)   run.code   = true
      runs.push(run)
    }
  }
  return runs
}

let _splitCounter = 0

// Returns [topFragment, bottomFragment] or null if no valid split exists.
// Widow rule: bottom fragment must have ≥ 2 lines; if not, splitAt is reduced until it does.
// Orphan rule: top fragment must have ≥ 2 lines; if not, the split is cancelled entirely.
export async function splitBlock(block, resolvedStyles, availableHeight, log = () => {}) {
  const { contentWidth, blocks: typeStyles } = resolvedStyles
  const ts = typeStyles[block.type] ?? { fontSize: 16, lineHeight: 24, spaceBefore: 0, spaceAfter: 0 }
  const sbefore = ts.spaceBefore ?? 0
  const safter  = ts.spaceAfter  ?? 0

  const topSpaceBefore   = block.isContinuation ? 0 : sbefore
  const contentAvailable = availableHeight - topSpaceBefore - safter

  // Need room for at least 2 lines (1 here + 1 on next page — anything less creates widow/orphan)
  if (contentAvailable < ts.lineHeight * 2) return null

  const words = runsToWords(block.content)
  if (words.length <= 1) return null

  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed; top: -9999px; left: -9999px;
    width: ${contentWidth}px; visibility: hidden; pointer-events: none;
  `
  document.body.appendChild(container)

  function measureWords(count) {
    const el = renderBlockToEl({ ...block, content: wordsToRuns(words.slice(0, count)) }, ts)
    container.appendChild(el)
    const h = el.getBoundingClientRect().height
    container.removeChild(el)
    return h
  }

  function measureContent(content) {
    const el = renderBlockToEl({ ...block, content }, ts)
    container.appendChild(el)
    const h = el.getBoundingClientRect().height
    container.removeChild(el)
    return h
  }

  // Binary search: max words whose content height fits in contentAvailable
  let lo = 1, hi = words.length - 1, splitAt = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (measureWords(mid) <= contentAvailable) { splitAt = mid; lo = mid + 1 }
    else hi = mid - 1
  }

  if (splitAt === 0) { document.body.removeChild(container); return null }

  // Widow/orphan resolution loop:
  // - Orphan: top fragment is 1 line → cancel split entirely
  // - Widow: bottom fragment is 1 line → pull one more line to bottom (reduce splitAt)
  const lineH = ts.lineHeight
  let resolved = false

  while (splitAt > 0) {
    const topH = measureWords(splitAt)

    // Orphan check: top fragment would be a single line
    if (topH <= lineH + 2) {
      log({ step: 'paginate', message: `Orphan prevented for block ${block.id} — not splitting`, type: 'info' })
      splitAt = 0
      break
    }

    const bottomContent = wordsToRuns(words.slice(splitAt))
    const bottomH = measureContent(bottomContent)

    // Widow check: bottom fragment would be a single line
    if (bottomH <= lineH + 2) {
      log({ step: 'paginate', message: `Widow prevented for block ${block.id} — pulling line to next page`, type: 'info' })
      splitAt--
      continue
    }

    // Both fragments have ≥ 2 lines — valid split
    resolved = true
    break
  }

  if (!resolved || splitAt === 0) {
    document.body.removeChild(container)
    return null
  }

  const topContent    = wordsToRuns(words.slice(0, splitAt))
  const bottomContent = wordsToRuns(words.slice(splitAt))

  // Strip leading whitespace from bottom fragment
  if (bottomContent[0]) {
    bottomContent[0] = { ...bottomContent[0], text: bottomContent[0].text.trimStart() }
    if (!bottomContent[0].text) bottomContent.shift()
  }
  if (!topContent.length || !bottomContent.length) {
    document.body.removeChild(container)
    return null
  }

  const topContentH    = measureWords(splitAt)
  const topHeight      = topSpaceBefore + topContentH + safter
  const bottomContentH = measureContent(bottomContent)
  const bottomHeight   = bottomContentH + safter  // continuation: no spaceBefore

  document.body.removeChild(container)

  return [
    { ...block,                                        content: topContent,    height: topHeight },
    { ...block, id: block.id + '-c' + (++_splitCounter), content: bottomContent, height: bottomHeight, isContinuation: true },
  ]
}
