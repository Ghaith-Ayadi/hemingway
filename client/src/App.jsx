// App — Root component. Owns all pipeline state. Manages the cancel token pattern for Compose.
// Threads resolvedStyles from the pipeline into PagesPanel to ensure render/paginate consistency.
// Persists all pipeline output and settings to localStorage via useLocalStorage so state survives page reload.
// Passes notionPageId to runPipeline when a Notion URL is entered; falls back to testfile.md otherwise.

import { useState, useRef } from 'react'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import './styles/global.css'
import './styles/layout.css'
import ControlsPanel from './components/ControlsPanel.jsx'
import PagesPanel    from './components/PagesPanel.jsx'
import LogsPanel     from './components/LogsPanel.jsx'
import { runPipeline, PipelineCancelledError } from './pipeline/runPipeline.js'
import { exportPdf } from './pdf/exportPdf.js'

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

// Extract the Notion page ID from a full URL (last hyphen-separated segment before any query string)
function extractPageId(url) {
  if (!url) return null
  const clean = url.split('?')[0].split('#')[0]
  const parts = clean.split('-')
  const last  = parts[parts.length - 1]
  return last.length === 32 ? last : null
}

export default function App() {
  const [notionUrl,         setNotionUrl]        = useLocalStorage('hemingway:notionUrl',        '')
  const [styleSettings,     setStyleSettings]    = useLocalStorage('hemingway:styleSettings',    DEFAULT_STYLES)
  const [marginSettings,    setMarginSettings]   = useLocalStorage('hemingway:marginSettings',   DEFAULT_MARGINS)
  const [validationIssues,  setValidationIssues] = useLocalStorage('hemingway:validationIssues', [])
  const [normalizedBlocks,  setNormalizedBlocks] = useLocalStorage('hemingway:normalizedBlocks', [])
  const [measuredBlocks,    setMeasuredBlocks]   = useLocalStorage('hemingway:measuredBlocks',   [])
  const [paginatedPages,    setPaginatedPages]   = useLocalStorage('hemingway:paginatedPages',   [])
  const [resolvedStyles,    setResolvedStyles]   = useLocalStorage('hemingway:resolvedStyles',   null)
  const [logs,              setLogs]             = useLocalStorage('hemingway:logs',             [])
  const [lastRunAt,         setLastRunAt]        = useLocalStorage('hemingway:lastRunAt',        null)
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
    setResolvedStyles(null)
    setIsRunning(true)

    function log(entry) {
      if (token.cancelled) return
      setLogs(prev => [...prev, { ...entry, timestamp: Date.now() }])
    }

    runPipeline({
      styleSettings,
      marginSettings,
      notionPageId: extractPageId(notionUrl),
      cancelToken: token,
      log,
      onNormalizedBlocks: blocks   => { if (!token.cancelled) setNormalizedBlocks(blocks) },
      onResolvedStyles:   resolved => { if (!token.cancelled) setResolvedStyles(resolved) },
      onMeasuredBlocks:   blocks   => { if (!token.cancelled) setMeasuredBlocks(blocks) },
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
      console.error('[pipeline]', err)
      // Split multi-line error messages into separate log entries for readability
      const lines = err.message.split('\n').filter(Boolean)
      lines.forEach(line => log({ step: 'pipeline', message: line, type: 'error' }))
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
    if (paginatedPages.length === 0 || !resolvedStyles) return
    exportPdf(paginatedPages, resolvedStyles).catch(err => {
      console.error('[exportPdf]', err)
    })
  }

  return (
    <div className="app">
      <ControlsPanel
        notionUrl={notionUrl}
        onNotionUrlChange={setNotionUrl}
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
      <PagesPanel pages={paginatedPages} resolvedStyles={resolvedStyles} />
      <LogsPanel  logs={logs} />
    </div>
  )
}
