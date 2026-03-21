// ControlsPanel — Column 1. Typography/spacing/margin inputs and action buttons (Compose, Download PDF, Reset Styles, Clear Output).

const TYPOGRAPHY_FIELDS = [
  { key: 'h1',        label: 'H1' },
  { key: 'h2',        label: 'H2' },
  { key: 'h3',        label: 'H3' },
  { key: 'paragraph', label: 'Paragraph' },
  { key: 'list',      label: 'List' },
  { key: 'quote',     label: 'Quote' },
  { key: 'code',      label: 'Code' },
]

const MARGIN_FIELDS = [
  { key: 'top',    label: 'Top' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'left',   label: 'Left' },
  { key: 'right',  label: 'Right' },
]

const SPACING_FIELDS = [
  { key: 'spaceBefore', label: 'Space before' },
  { key: 'spaceAfter',  label: 'Space after' },
]

export default function ControlsPanel({
  styleSettings,
  marginSettings,
  onStyleChange,
  onMarginChange,
  onCompose,
  onResetStyles,
  onClearOutput,
  onDownloadPdf,
  isRunning,
  hasPages,
}) {
  return (
    <div className="column">
      <div className="column-header">Controls</div>
      <div className="column-body controls-body">

        {/* Actions */}
        <div className="actions">
          <button className="btn-compose" onClick={onCompose}>
            {isRunning ? 'Composing…' : 'Compose'}
          </button>
          <button className="btn-secondary" onClick={onDownloadPdf} disabled={!hasPages}>
            Download PDF
          </button>
          <button className="btn-secondary" onClick={onResetStyles}>
            Reset Styles
          </button>
          <button className="btn-secondary" onClick={onClearOutput}>
            Clear Output
          </button>
        </div>

        {/* Typography */}
        <div className="settings-section">
          <div className="settings-section-title">Typography</div>
          {TYPOGRAPHY_FIELDS.map(({ key, label }) => (
            <div key={key} className="setting-row">
              <span className="setting-label">{label}</span>
              <div className="setting-input-pair">
                <input
                  className="setting-input"
                  type="number"
                  value={styleSettings[key].fontSize}
                  onChange={e => onStyleChange(key, 'fontSize', Number(e.target.value))}
                />
                <span className="setting-divider">/</span>
                <input
                  className="setting-input"
                  type="number"
                  value={styleSettings[key].lineHeight}
                  onChange={e => onStyleChange(key, 'lineHeight', Number(e.target.value))}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Spacing */}
        <div className="settings-section">
          <div className="settings-section-title">Spacing</div>
          {SPACING_FIELDS.map(({ key, label }) => (
            <div key={key} className="setting-row">
              <span className="setting-label">{label}</span>
              <input
                className="setting-input"
                type="number"
                value={styleSettings[key]}
                onChange={e => onStyleChange(key, null, Number(e.target.value))}
              />
            </div>
          ))}
        </div>

        {/* Margins */}
        <div className="settings-section">
          <div className="settings-section-title">Margins</div>
          {MARGIN_FIELDS.map(({ key, label }) => (
            <div key={key} className="setting-row">
              <span className="setting-label">{label}</span>
              <input
                className="setting-input"
                type="number"
                value={marginSettings[key]}
                onChange={e => onMarginChange(key, Number(e.target.value))}
              />
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
