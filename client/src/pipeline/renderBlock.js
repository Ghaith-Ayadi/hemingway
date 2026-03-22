// renderBlock — Shared DOM rendering utility used by measureBlocks and splitBlock.
// Creates a styled div matching BlockRenderer exactly so measurement and layout agree.

export function renderBlockToEl(block, typeStyle) {
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
    case 'numbered_list_item':
    case 'to_do':
      el.style.cssText = base + 'padding-left: 24px;'
      break
    case 'divider':
      el.style.cssText = 'width: 100%; height: 1px;'
      break
    case 'image':
      el.style.cssText = 'width: 100%; height: 200px;'
      break
    default:
      el.style.cssText = base
  }

  el.textContent = block.content.map(r => r.text).join('')

  return el
}
