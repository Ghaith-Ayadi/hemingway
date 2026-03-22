// ControlsPanel — Column 1. Notion URL input, typography/spacing/margin inputs, and action buttons.
// Compose fetches + paginates. Restyle re-paginates with new styles without re-fetching.

import { useState } from 'react'

const TYPOGRAPHY_FIELDS = [
  { key: 'h1',        label: 'H1' },
  { key: 'h2',        label: 'H2' },
  { key: 'h3',        label: 'H3' },
  { key: 'paragraph', label: 'Paragraph' },
  { key: 'list',      label: 'List' },
  { key: 'quote',     label: 'Quote' },
  { key: 'code',      label: 'Code' },
]

function MarginIcon({ side }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
      <rect x="4" y="4" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
      {side === 'left'   && <line x1="1.5" y1="2" x2="1.5" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      {side === 'right'  && <line x1="14.5" y1="2" x2="14.5" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      {side === 'top'    && <line x1="2" y1="1.5" x2="14" y2="1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      {side === 'bottom' && <line x1="2" y1="14.5" x2="14" y2="14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  )
}

export default function ControlsPanel({
  notionUrl,
  onNotionUrlChange,
  styleSettings,
  marginSettings,
  onStyleChange,
  onMarginChange,
  onCompose,
  onRestyle,
  onResetStyles,
  onClearOutput,
  onDownloadPdf,
  isRunning,
  hasPages,
  hasBlocks,
  stylesDirty,
}) {
  const [marginsLinked, setMarginsLinked] = useState(false)

  function handleMarginInput(key, value) {
    if (marginsLinked) {
      ;['top', 'bottom', 'left', 'right'].forEach(k => onMarginChange(k, value))
    } else {
      onMarginChange(key, value)
    }
  }

  return (
    <div className="column">
      <div className="column-header">Controls</div>
      <div className="column-body controls-body">

        {/* Source */}
        <div className="settings-section">
          <div className="settings-section-title">Source</div>
          <div className="setting-row">
            <input
              className="setting-input setting-input-url"
              type="text"
              placeholder="Notion page URL (leave empty for testfile.md)"
              value={notionUrl}
              onChange={e => onNotionUrlChange(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="actions">
          <button className="btn-compose" onClick={onCompose} disabled={isRunning}>
            {isRunning ? 'Composing…' : 'Compose'}
          </button>
        </div>

        {/* Typography */}
        <div className="settings-section">
          <div className="settings-section-title">Typography</div>
          {/* Typography header */}
          <div className="typography-col-headers">
            <span></span>
            <span className="col-header-label">size / lh</span>
            <span className="col-header-label">↑ / ↓</span>
          </div>
          {TYPOGRAPHY_FIELDS.map(({ key, label }) => (
            <div key={key} className="setting-row typography-row">
              <span className="setting-label">{label}</span>
              <div className="setting-input-pair">
                <input className="setting-input" type="number" value={styleSettings[key].fontSize} onChange={e => onStyleChange(key, 'fontSize', Number(e.target.value))} />
                <span className="setting-divider">/</span>
                <input className="setting-input" type="number" value={styleSettings[key].lineHeight} onChange={e => onStyleChange(key, 'lineHeight', Number(e.target.value))} />
              </div>
              <div className="setting-input-pair">
                <input className="setting-input" type="number" value={styleSettings[key].spaceBefore} onChange={e => onStyleChange(key, 'spaceBefore', Number(e.target.value))} />
                <span className="setting-divider">/</span>
                <input className="setting-input" type="number" value={styleSettings[key].spaceAfter} onChange={e => onStyleChange(key, 'spaceAfter', Number(e.target.value))} />
              </div>
            </div>
          ))}
          {/* Style action buttons */}
          <div className="style-actions">
            <button
              className={stylesDirty && hasBlocks ? 'btn-compose' : 'btn-secondary'}
              onClick={onRestyle}
              disabled={isRunning || !hasBlocks || !stylesDirty}
            >Restyle</button>
            <button className="btn-secondary" onClick={onResetStyles}>Reset styles</button>
          </div>
        </div>

        {/* Margins */}
        <div className="settings-section">
          <div className="settings-section-title">Margins</div>
          <div className="margin-grid">
            {/* Row 1 */}
            <div className="margin-cell">
              <MarginIcon side="left" />
              <input className="setting-input margin-input" type="number" value={marginSettings.left} onChange={e => handleMarginInput('left', Number(e.target.value))} />
            </div>
            <div className="margin-cell">
              <MarginIcon side="top" />
              <input className="setting-input margin-input" type="number" value={marginSettings.top} onChange={e => handleMarginInput('top', Number(e.target.value))} />
            </div>
            <button
              className={`margin-link-btn ${marginsLinked ? 'active' : ''}`}
              onClick={() => setMarginsLinked(l => !l)}
              title={marginsLinked ? 'Unlink margins' : 'Link all margins'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
                {marginsLinked && <rect x="5" y="5" width="6" height="6" rx="0.5" fill="currentColor" />}
              </svg>
            </button>
            {/* Row 2 */}
            <div className="margin-cell">
              <MarginIcon side="right" />
              <input className="setting-input margin-input" type="number" value={marginSettings.right} onChange={e => handleMarginInput('right', Number(e.target.value))} />
            </div>
            <div className="margin-cell">
              <MarginIcon side="bottom" />
              <input className="setting-input margin-input" type="number" value={marginSettings.bottom} onChange={e => handleMarginInput('bottom', Number(e.target.value))} />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
