function newPage(number, contentHeight) {
  return { number, blocks: [], usedHeight: 0, remainingHeight: contentHeight }
}

export function paginate(measuredBlocks, resolvedStyles, issues, log, onPageReady) {
  log({ step: 'paginate', message: 'Paginating…', type: 'info' })

  const { contentHeight } = resolvedStyles
  const giantBlockIds = new Set(issues.filter(i => i.type === 'giant_block').map(i => i.blockId))

  const pages = []
  let current = newPage(1, contentHeight)

  function pushCurrent() {
    if (current.blocks.length > 0) {
      pages.push(current)
      onPageReady(pages)
      current = newPage(pages.length + 1, contentHeight)
    }
  }

  for (const block of measuredBlocks) {
    // Giant image — scale to fit, place on its own page
    if (giantBlockIds.has(block.id) && block.type === 'image') {
      pushCurrent()
      pages.push({ ...newPage(pages.length + 1, contentHeight), blocks: [{ ...block, scaled: true }], usedHeight: contentHeight })
      onPageReady(pages)
      current = newPage(pages.length + 1, contentHeight)
      log({ step: 'paginate', message: `Giant image placed on dedicated page ${pages.length}`, type: 'warning' })
      continue
    }

    // Giant non-image — place on its own page with overflow flag
    if (giantBlockIds.has(block.id)) {
      pushCurrent()
      pages.push({ ...newPage(pages.length + 1, contentHeight), blocks: [{ ...block, overflow: true }], usedHeight: block.height })
      onPageReady(pages)
      current = newPage(pages.length + 1, contentHeight)
      log({ step: 'paginate', message: `Giant block placed on dedicated page ${pages.length} (overflow)`, type: 'warning' })
      continue
    }

    // Normal block — fits on current page
    if (block.height <= current.remainingHeight) {
      current.blocks.push(block)
      current.usedHeight      += block.height
      current.remainingHeight -= block.height
    } else {
      // Doesn't fit — start a new page
      pushCurrent()
      current.blocks.push(block)
      current.usedHeight      = block.height
      current.remainingHeight = contentHeight - block.height
    }
  }

  // Flush last page
  if (current.blocks.length > 0) {
    pages.push(current)
    onPageReady(pages)
  }

  log({ step: 'paginate', message: `Done — ${pages.length} page(s)`, type: 'info' })

  return pages
}
