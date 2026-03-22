// paginate — Places measured blocks into pages. Giant blocks get dedicated pages.
// Splittable blocks that don't fit are split at the word level with widow/orphan prevention.
// Calls onPageReady after each page is finalised for progressive rendering.

import { canSplit, splitBlock } from './splitBlock.js'

function newPage(number, contentHeight) {
  return { number, blocks: [], usedHeight: 0, remainingHeight: contentHeight }
}

export async function paginate(measuredBlocks, resolvedStyles, issues, log, onPageReady) {
  log({ step: 'paginate', message: 'Paginating…', type: 'info' })

  const { contentHeight, blocks: typeStyles } = resolvedStyles
  const giantBlockIds = new Set(issues.filter(i => i.type === 'giant_block').map(i => i.blockId))

  const pages   = []
  let current   = newPage(1, contentHeight)
  let splitCount = 0

  function pushCurrent() {
    if (current.blocks.length > 0) {
      pages.push(current)
      onPageReady(pages)
      current = newPage(pages.length + 1, contentHeight)
    }
  }

  // Use a mutable queue so split bottom-fragments can be inserted immediately after their origin
  const queue = [...measuredBlocks]
  let i = 0

  while (i < queue.length) {
    const block = queue[i++]

    // Divider → forced page break (the divider itself is not rendered)
    if (block.type === 'divider') {
      if (current.blocks.length > 0) {
        pushCurrent()
        log({ step: 'paginate', message: 'Divider — forced page break', type: 'info' })
      }
      continue
    }

    // Giant image — scale to fit on its own page
    if (giantBlockIds.has(block.id) && block.type === 'image') {
      pushCurrent()
      pages.push({ ...newPage(pages.length + 1, contentHeight), blocks: [{ ...block, scaled: true }], usedHeight: contentHeight })
      onPageReady(pages)
      current = newPage(pages.length + 1, contentHeight)
      log({ step: 'paginate', message: `Giant image placed on dedicated page ${pages.length}`, type: 'warning' })
      continue
    }

    // Giant non-image — own page with overflow flag
    if (giantBlockIds.has(block.id)) {
      pushCurrent()
      pages.push({ ...newPage(pages.length + 1, contentHeight), blocks: [{ ...block, overflow: true }], usedHeight: block.height })
      onPageReady(pages)
      current = newPage(pages.length + 1, contentHeight)
      log({ step: 'paginate', message: `Giant block placed on dedicated page ${pages.length} (overflow)`, type: 'warning' })
      continue
    }

    // Fits on current page — place it
    if (block.height <= current.remainingHeight) {
      current.blocks.push(block)
      current.usedHeight      += block.height
      current.remainingHeight -= block.height
      continue
    }

    // Doesn't fit — attempt a line-level split if there's room and the page isn't empty
    if (canSplit(block) && current.blocks.length > 0) {
      const ts = typeStyles[block.type] ?? { fontSize: 16, lineHeight: 24 }
      const tsb = ts.spaceBefore ?? 0
      const tsa = ts.spaceAfter  ?? 0
      const minNeeded = (block.isContinuation ? 0 : tsb) + ts.lineHeight + tsa

      if (current.remainingHeight >= minNeeded) {
        const fragments = await splitBlock(block, resolvedStyles, current.remainingHeight, log)
        if (fragments) {
          const [top, bottom] = fragments
          current.blocks.push(top)
          current.usedHeight      += top.height
          current.remainingHeight -= top.height
          pushCurrent()
          queue.splice(i, 0, bottom)  // bottom fragment processes next
          splitCount++
          continue
        }
      }
    }

    // No split possible — push block to a fresh page
    pushCurrent()
    current.blocks.push(block)
    current.usedHeight      = block.height
    current.remainingHeight = contentHeight - block.height
  }

  // Flush the last page
  if (current.blocks.length > 0) {
    pages.push(current)
    onPageReady(pages)
  }

  if (splitCount > 0) {
    log({ step: 'paginate', message: `Split ${splitCount} block(s) across page boundaries`, type: 'info' })
  }
  log({ step: 'paginate', message: `Done — ${pages.length} page(s)`, type: 'info' })

  return pages
}
