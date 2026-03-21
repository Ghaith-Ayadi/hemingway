import { useState, useRef } from 'react'
import './styles/global.css'
import './styles/layout.css'
import ControlsPanel from './components/ControlsPanel.jsx'
import PagesPanel    from './components/PagesPanel.jsx'
import LogsPanel     from './components/LogsPanel.jsx'
import { runPipeline, PipelineCancelledError } from './pipeline/runPipeline.js'

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
  const [styleSettings,     setStyleSettings]    = useState(DEFAULT_STYLES)
  const [marginSettings,    setMarginSettings]   = useState(DEFAULT_MARGINS)
  const [validationIssues,  setValidationIssues] = useState([])
  const [normalizedBlocks,  setNormalizedBlocks] = useState([])
  const [measuredBlocks,    setMeasuredBlocks]   = useState([])
  const [paginatedPages,    setPaginatedPages]   = useState([])
  const [logs,              setLogs]             = useState([])
  const [lastRunAt,         setLastRunAt]        = useState(null)
  const [isRunning,         setIsRunning]        = useState(false)

  const cancelTokenRef = useRef({ cancelled: false })

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
    // Cancel any in-progress run
    cancelTokenRef.current.cancelled = true
    const token = { cancelled: false }
    cancelTokenRef.current = token

    // Clear output
    setLogs([])
    setValidationIssues([])
    setNormalizedBlocks([])
    setMeasuredBlocks([])
    setPaginatedPages([])
    setIsRunning(true)

    function log(entry) {
      if (token.cancelled) return
      setLogs(prev => [...prev, { ...entry, timestamp: Date.now() }])
    }

    runPipeline({
      styleSettings,
      marginSettings,
      cancelToken: token,
      log,
      onNormalizedBlocks: blocks => { if (!token.cancelled) setNormalizedBlocks(blocks) },
      onMeasuredBlocks:   blocks => { if (!token.cancelled) setMeasuredBlocks(blocks) },
      onValidationIssues: issues => { if (!token.cancelled) setValidationIssues(issues) },
      onPageReady:        pages  => { if (!token.cancelled) setPaginatedPages([...pages]) },
      onDone: ({ pages }) => {
        if (!token.cancelled) {
          setPaginatedPages(pages)
          setLastRunAt(Date.now())
        }
      },
    })
    .catch(err => {
      if (err instanceof PipelineCancelledError) return
      log({ step: 'pipeline', message: `Error: ${err.message}`, type: 'error' })
    })
    .finally(() => {
      if (!token.cancelled) setIsRunning(false)
    })
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
  }

  function handleDownloadPdf() {
    // Phase 6
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
      <LogsPanel  logs={logs} />
    </div>
  )
}
