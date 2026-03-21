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
