function renderBlockToEl(block, typeStyle) {
  const el = document.createElement('div')

  const base = `
    font-family: 'Inter', sans-serif;
    font-size: ${typeStyle.fontSize}px;
    line-height: ${typeStyle.lineHeight}px;
    width: 100%;
    word-break: break-word;
    box-sizing: border-box;
  `

  switch (block.type) {
    case 'code':
      el.style.cssText = base + 'white-space: pre-wrap; font-family: monospace;'
      break
    case 'quote':
      el.style.cssText = base + 'padding-left: 16px;'
      break
    case 'callout':
      el.style.cssText = base + 'padding: 12px 16px;'
      break
    case 'bulleted_list_item':
      el.style.cssText = base + 'padding-left: 24px;'
      break
    case 'numbered_list_item':
      el.style.cssText = base + 'padding-left: 24px;'
      break
    case 'to_do':
      el.style.cssText = base + 'padding-left: 24px;'
      break
    case 'divider':
      el.style.cssText = 'width: 100%; height: 1px;'
      break
    case 'image':
      // Placeholder — actual image scaling handled by renderer
      el.style.cssText = 'width: 100%; height: 200px;'
      break
    default:
      el.style.cssText = base
  }

  el.textContent = block.content.map(r => r.text).join('')

  return el
}

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
    const typeStyle = resolvedStyles.blocks[block.type] ?? { fontSize: 16, lineHeight: 24 }
    const el = renderBlockToEl(block, typeStyle)
    container.appendChild(el)

    const contentHeight = el.getBoundingClientRect().height
    const totalHeight   = contentHeight + resolvedStyles.spaceBefore + resolvedStyles.spaceAfter

    container.removeChild(el)

    measured.push({ ...block, height: totalHeight })
  }

  document.body.removeChild(container)

  log({ step: 'measureBlocks', message: `Measured ${measured.length} blocks`, type: 'info' })

  return measured
}
