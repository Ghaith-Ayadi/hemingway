// measureBlocks — Awaits document.fonts.ready, then renders each block into a hidden DOM container
// at contentWidth. Measured height = getBoundingClientRect().height + spaceBefore + spaceAfter.

import { renderBlockToEl } from './renderBlock.js'

export async function measureBlocks(blocks, resolvedStyles, log) {
  log({ step: 'measureBlocks', message: 'Waiting for fonts…', type: 'info' })
  await document.fonts.ready

  log({ step: 'measureBlocks', message: 'Measuring blocks…', type: 'info' })

  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: ${resolvedStyles.contentWidth}px;
    visibility: hidden;
    pointer-events: none;
  `
  document.body.appendChild(container)

  const measured = []

  for (const block of blocks) {
    const typeStyle = resolvedStyles.blocks[block.type] ?? { fontSize: 16, lineHeight: 24, spaceBefore: 0, spaceAfter: 0 }
    const el = renderBlockToEl(block, typeStyle)
    container.appendChild(el)

    const contentHeight = el.getBoundingClientRect().height
    const totalHeight   = contentHeight + (typeStyle.spaceBefore ?? 0) + (typeStyle.spaceAfter ?? 0)

    container.removeChild(el)

    measured.push({ ...block, height: totalHeight })
  }

  document.body.removeChild(container)

  log({ step: 'measureBlocks', message: `Measured ${measured.length} blocks`, type: 'info' })

  return measured
}
