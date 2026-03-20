export default function PagesPanel({ pages }) {
  return (
    <div className="column">
      <div className="column-header">Pages</div>
      <div className="column-body pages-body">
        {pages.length === 0
          ? <p className="pages-empty">No pages yet. Click Compose to begin.</p>
          : pages.map(page => (
              <div key={page.number}>Page {page.number}</div>
            ))
        }
      </div>
    </div>
  )
}
