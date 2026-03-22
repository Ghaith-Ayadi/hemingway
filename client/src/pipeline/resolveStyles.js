// resolveStyles — Maps styleSettings + marginSettings into a resolved object used by every downstream step.
// Render at 1600px wide (scales down to fit column via transform: scale)
// Height derived from A4 aspect ratio (1123/794)
const PAGE_RENDER_WIDTH  = 1600
const PAGE_RENDER_HEIGHT = Math.round(PAGE_RENDER_WIDTH * 1123 / 794) // 2263

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
    const { fontSize, lineHeight, spaceBefore, spaceAfter, paragraphSpacing } = styleSettings[key]
    for (const type of types) {
      blocks[type] = { fontSize, lineHeight, spaceBefore: spaceBefore ?? 0, spaceAfter: spaceAfter ?? 0, paragraphSpacing: paragraphSpacing ?? 0 }
    }
  }

  // image and divider get spaceBefore:0, spaceAfter:0
  blocks.image   = { fontSize: 0, lineHeight: 0, spaceBefore: 0, spaceAfter: 0 }
  blocks.divider = { fontSize: 0, lineHeight: 0, spaceBefore: 0, spaceAfter: 0 }

  const { top, bottom, left, right } = marginSettings

  const contentWidth  = PAGE_RENDER_WIDTH  - left - right
  const contentHeight = PAGE_RENDER_HEIGHT - top  - bottom

  const resolved = {
    blocks,
    margins:      { top, bottom, left, right },
    pageWidth:    PAGE_RENDER_WIDTH,
    pageHeight:   PAGE_RENDER_HEIGHT,
    contentWidth,
    contentHeight,
  }

  log({
    step: 'resolveStyles',
    message: `Content area: ${contentWidth}×${contentHeight}px (render scale: ${PAGE_RENDER_WIDTH}px wide)`,
    type: 'info',
  })

  return resolved
}
