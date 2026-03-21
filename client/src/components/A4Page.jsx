// A4Page — Renders a single page at 1600×2263px (A4 at render scale). Content area is positioned
// inside margins. Sets color: #111 to override body's light theme. Page number shown at bottom.

import BlockRenderer from './BlockRenderer.jsx'

export default function A4Page({ page, resolvedStyles }) {
  const { pageWidth, pageHeight, margins } = resolvedStyles

  return (
    <div style={{
      width:      pageWidth,
      height:     pageHeight,
      background: '#fff',
      position:   'relative',
      flexShrink: 0,
      boxSizing:  'border-box',
    }}>
      {/* Content area */}
      <div style={{
        position: 'absolute',
        top:      margins.top,
        bottom:   margins.bottom,
        left:     margins.left,
        right:    margins.right,
        overflow: 'hidden',
        color:    '#111',
      }}>
        {page.blocks.map(block => (
          <BlockRenderer key={block.id} block={block} resolvedStyles={resolvedStyles} />
        ))}
      </div>

      {/* Page number */}
      <div style={{
        position:   'absolute',
        bottom:     24,
        width:      '100%',
        textAlign:  'center',
        fontSize:   22,
        color:      '#bbb',
        fontFamily: "'Inter', sans-serif",
        userSelect: 'none',
      }}>
        {page.number}
      </div>
    </div>
  )
}
