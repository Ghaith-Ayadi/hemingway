function RichText({ runs = [] }) {
  return runs.map((run, i) => {
    const style = {
      fontWeight:  run.bold   ? 600        : undefined,
      fontStyle:   run.italic ? 'italic'   : undefined,
      fontFamily:  run.code   ? 'monospace': undefined,
      background:  run.code   ? '#f0f0f0'  : undefined,
      padding:     run.code   ? '0 4px'    : undefined,
      borderRadius:run.code   ? '2px'      : undefined,
    }
    return <span key={i} style={style}>{run.text}</span>
  })
}

export default function BlockRenderer({ block, resolvedStyles }) {
  const { spaceBefore, spaceAfter, blocks: typeStyles } = resolvedStyles
  const ts = typeStyles[block.type] ?? { fontSize: 16, lineHeight: 24 }

  const base = {
    fontFamily:  "'Inter', sans-serif",
    fontSize:    ts.fontSize,
    lineHeight:  `${ts.lineHeight}px`,
    marginTop:   spaceBefore,
    marginBottom: spaceAfter,
    wordBreak:   'break-word',
    width:       '100%',
    boxSizing:   'border-box',
  }

  switch (block.type) {

    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
      return (
        <div style={{ ...base, fontWeight: 700 }}>
          <RichText runs={block.content} />
        </div>
      )

    case 'paragraph':
      return (
        <div style={base}>
          <RichText runs={block.content} />
        </div>
      )

    case 'bulleted_list_item':
      return (
        <div style={{ ...base, paddingLeft: 24, display: 'flex', gap: 10 }}>
          <span style={{ flexShrink: 0, userSelect: 'none' }}>•</span>
          <span><RichText runs={block.content} /></span>
        </div>
      )

    case 'numbered_list_item':
      return (
        <div style={{ ...base, paddingLeft: 24, display: 'flex', gap: 10 }}>
          <span style={{ flexShrink: 0, userSelect: 'none' }}>{block.index}.</span>
          <span><RichText runs={block.content} /></span>
        </div>
      )

    case 'to_do':
      return (
        <div style={{ ...base, paddingLeft: 24, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, userSelect: 'none', marginTop: 4 }}>
            {block.checked ? '☑' : '☐'}
          </span>
          <span style={{ textDecoration: block.checked ? 'line-through' : 'none', opacity: block.checked ? 0.5 : 1 }}>
            <RichText runs={block.content} />
          </span>
        </div>
      )

    case 'quote':
      return (
        <div style={{ ...base, paddingLeft: 20, borderLeft: '3px solid #ccc', color: '#555' }}>
          <RichText runs={block.content} />
        </div>
      )

    case 'callout':
      return (
        <div style={{ ...base, padding: '12px 16px', background: '#f7f7f7', borderRadius: 6, display: 'flex', gap: 12 }}>
          {block.icon && <span style={{ flexShrink: 0 }}>{block.icon}</span>}
          <span><RichText runs={block.content} /></span>
        </div>
      )

    case 'code':
      return (
        <pre style={{
          ...base,
          fontFamily: 'monospace',
          background: '#f4f4f4',
          padding: '16px 20px',
          borderRadius: 6,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
        }}>
          <RichText runs={block.content} />
        </pre>
      )

    case 'image':
      return (
        <div style={{ ...base, textAlign: 'center' }}>
          <img
            src={block.url}
            alt={block.alt}
            style={{
              maxWidth: '100%',
              maxHeight: block.scaled ? resolvedStyles.contentHeight : undefined,
              objectFit: 'contain',
            }}
          />
        </div>
      )

    case 'divider':
      return (
        <div style={{ marginTop: spaceBefore, marginBottom: spaceAfter }}>
          <hr style={{ border: 'none', borderTop: '1px solid #ddd' }} />
        </div>
      )

    default:
      return null
  }
}
