// PagesPanel — Column 2. Uses ResizeObserver to measure available width, computes scale = width / 1600,
// and wraps each A4Page in a correctly-sized container so scaled pages don't affect document flow.
// Page numbers are rendered outside/below each page. Action buttons (PDF + Clear) in the header.

import { useRef, useState, useEffect } from 'react'
import A4Page from './A4Page.jsx'

const PAGE_RENDER_WIDTH = 1600

export default function PagesPanel({ pages, resolvedStyles, onDownloadPdf, onClearOutput, hasPages }) {
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
      <div className="column-header pages-header">
        <span>Pages</span>
        <div className="pages-header-actions">
          <button className="btn-header-action btn-header-primary" onClick={onDownloadPdf} disabled={!hasPages}>Download PDF</button>
          <button className="btn-header-action" onClick={onClearOutput}>Clear</button>
        </div>
      </div>
      <div className="column-body pages-body" ref={bodyRef}>
        {pages.length === 0 || !resolvedStyles
          ? <p className="pages-empty">No pages yet. Click Compose to begin.</p>
          : pages.map(page => {
              const scaledHeight = resolvedStyles.pageHeight * scale
              return (
                <div key={page.number} style={{ width: '100%', flexShrink: 0 }}>
                  {/* scaled page */}
                  <div style={{ height: scaledHeight, boxShadow: '0 2px 16px rgba(0,0,0,0.18)' }}>
                    <div style={{
                      transform:       `scale(${scale})`,
                      transformOrigin: 'top left',
                      width:           PAGE_RENDER_WIDTH,
                      height:          resolvedStyles.pageHeight,
                    }}>
                      <A4Page page={page} resolvedStyles={resolvedStyles} />
                    </div>
                  </div>
                  {/* page number: outside the page, bottom right, subtle */}
                  <div style={{
                    textAlign:  'right',
                    fontSize:   11,
                    color:      '#555',
                    fontFamily: "'Inter', sans-serif",
                    padding:    '6px 4px 0',
                    userSelect: 'none',
                  }}>
                    {page.number}
                  </div>
                </div>
              )
            })
        }
      </div>
    </div>
  )
}
