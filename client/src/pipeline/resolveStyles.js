const PAGE_WIDTH  = 794
const PAGE_HEIGHT = 1123

// Maps styleSettings keys → block types that use them
const STYLE_KEY_TO_TYPES = {
  h1:        ['heading_1'],
  h2:        ['heading_2'],
  h3:        ['heading_3'],
  paragraph: ['paragraph', 'callout'],
  list:      ['bulleted_list_item', 'numbered_list_item', 'to_do'],
  quote:     ['quote'],
  code:      ['code'],
}

export function resolveStyles(styleSettings, marginSettings, log) {
  log({ step: 'resolveStyles', message: 'Resolving styles…', type: 'info' })

  const blocks = {}

  for (const [key, types] of Object.entries(STYLE_KEY_TO_TYPES)) {
    const { fontSize, lineHeight } = styleSettings[key]
    for (const type of types) {
      blocks[type] = { fontSize, lineHeight }
    }
  }

  // Fixed types with no text
  blocks.image   = { fontSize: 0, lineHeight: 0 }
  blocks.divider = { fontSize: 0, lineHeight: 0 }

  const { top, bottom, left, right } = marginSettings

  const contentWidth  = PAGE_WIDTH  - left - right
  const contentHeight = PAGE_HEIGHT - top  - bottom

  const resolved = {
    blocks,
    spaceBefore:   styleSettings.spaceBefore,
    spaceAfter:    styleSettings.spaceAfter,
    margins:       { top, bottom, left, right },
    pageWidth:     PAGE_WIDTH,
    pageHeight:    PAGE_HEIGHT,
    contentWidth,
    contentHeight,
  }

  log({
    step: 'resolveStyles',
    message: `Content area: ${contentWidth}×${contentHeight}px`,
    type: 'info',
  })

  return resolved
}
