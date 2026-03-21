import { useRef, useState, useEffect } from 'react'
import A4Page from './A4Page.jsx'

const PAGE_RENDER_WIDTH = 1600

export default function PagesPanel({ pages, resolvedStyles }) {
  const bodyRef = useRef(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (!bodyRef.current) return

    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width
      setScale((width - 48) / PAGE_RENDER_WIDTH)
    })

    observer.observe(bodyRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="column">
      <div className="column-header">Pages</div>
      <div className="column-body pages-body" ref={bodyRef}>
        {pages.length === 0 || !resolvedStyles
          ? <p className="pages-empty">No pages yet. Click Compose to begin.</p>
          : pages.map(page => {
              const scaledHeight = resolvedStyles.pageHeight * scale
              return (
                <div key={page.number} style={{
                  width:      '100%',
                  height:     scaledHeight,
                  flexShrink: 0,
                  boxShadow:  '0 2px 16px rgba(0,0,0,0.18)',
                }}>
                  <div style={{
                    transform:       `scale(${scale})`,
                    transformOrigin: 'top left',
                    width:           PAGE_RENDER_WIDTH,
                    height:          resolvedStyles.pageHeight,
                  }}>
                    <A4Page page={page} resolvedStyles={resolvedStyles} />
                  </div>
                </div>
              )
            })
        }
      </div>
    </div>
  )
}
