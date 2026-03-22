// renderBlock — Shared DOM rendering utility used by measureBlocks and splitBlock.
// Creates a styled div matching BlockRenderer exactly so measurement and layout agree.
// Splits content at \n boundaries and inserts paragraphSpacing between chunks.

export function renderBlockToEl(block, typeStyle) {
  const el = document.createElement('div')
  const ps = typeStyle.paragraphSpacing ?? 0

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
      return el
    case 'image':
      el.style.cssText = 'width: 100%; height: 200px;'
      return el
    default:
      el.style.cssText = base
  }

  const fullText = block.content?.map(r => r.text).join('') ?? ''
  const chunks = fullText.split('\n')

  if (ps > 0 && chunks.length > 1) {
    chunks.forEach((chunk, i) => {
      const p = document.createElement('div')
      p.textContent = chunk
      if (i < chunks.length - 1) p.style.marginBottom = ps + 'px'
      el.appendChild(p)
    })
  } else {
    el.textContent = fullText
  }

  return el
}
