import { useState } from 'react'
import './styles/global.css'
import './styles/layout.css'
import ControlsPanel from './components/ControlsPanel.jsx'
import PagesPanel from './components/PagesPanel.jsx'
import LogsPanel from './components/LogsPanel.jsx'

const DEFAULT_STYLES = {
  h1:        { fontSize: 128, lineHeight: 124 },
  h2:        { fontSize: 96,  lineHeight: 96  },
  h3:        { fontSize: 32,  lineHeight: 48  },
  paragraph: { fontSize: 32,  lineHeight: 48  },
  list:      { fontSize: 32,  lineHeight: 48  },
  quote:     { fontSize: 32,  lineHeight: 48  },
  code:      { fontSize: 28,  lineHeight: 44  },
  spaceBefore: 16,
  spaceAfter:  8,
}

const DEFAULT_MARGINS = {
  top:    72,
  bottom: 72,
  left:   80,
  right:  80,
}

export default function App() {
  const [styleSettings,    setStyleSettings]    = useState(DEFAULT_STYLES)
  const [marginSettings,   setMarginSettings]   = useState(DEFAULT_MARGINS)
  const [validationIssues, setValidationIssues] = useState([])
  const [normalizedBlocks, setNormalizedBlocks] = useState([])
  const [measuredBlocks,   setMeasuredBlocks]   = useState([])
  const [paginatedPages,   setPaginatedPages]   = useState([])
  const [logs,             setLogs]             = useState([])
  const [lastRunAt,        setLastRunAt]        = useState(null)
  const [lastExportSummary,setLastExportSummary]= useState(null)
  const [isRunning,        setIsRunning]        = useState(false)

  function handleStyleChange(key, prop, value) {
    setStyleSettings(prev => {
      if (prop === null) return { ...prev, [key]: value }
      return { ...prev, [key]: { ...prev[key], [prop]: value } }
    })
  }

  function handleMarginChange(key, value) {
    setMarginSettings(prev => ({ ...prev, [key]: value }))
  }

  function handleCompose() {
    // pipeline will go here
  }

  function handleResetStyles() {
    setStyleSettings(DEFAULT_STYLES)
    setMarginSettings(DEFAULT_MARGINS)
  }

  function handleClearOutput() {
    setValidationIssues([])
    setNormalizedBlocks([])
    setMeasuredBlocks([])
    setPaginatedPages([])
    setLogs([])
    setLastRunAt(null)
    setLastExportSummary(null)
  }

  function handleDownloadPdf() {
    // PDF export will go here
  }

  return (
    <div className="app">
      <ControlsPanel
        styleSettings={styleSettings}
        marginSettings={marginSettings}
        onStyleChange={handleStyleChange}
        onMarginChange={handleMarginChange}
        onCompose={handleCompose}
        onResetStyles={handleResetStyles}
        onClearOutput={handleClearOutput}
        onDownloadPdf={handleDownloadPdf}
        isRunning={isRunning}
        hasPages={paginatedPages.length > 0}
      />
      <PagesPanel pages={paginatedPages} />
      <LogsPanel logs={logs} />
    </div>
  )
}
