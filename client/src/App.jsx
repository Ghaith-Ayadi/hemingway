// App — Root component. Owns all pipeline state. Manages the cancel token pattern for Compose/Restyle.
// Threads resolvedStyles from the pipeline into PagesPanel to ensure render/paginate consistency.
// Persists all pipeline output and settings to localStorage via useLocalStorage so state survives page reload.
// Restyle re-runs resolveStyles→measure→validate→paginate using cached normalizedBlocks, skipping fetch.

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
  h1:        { fontSize: 128, lineHeight: 124, spaceBefore: 96,  spaceAfter: 16 },
  h2:        { fontSize: 96,  lineHeight: 96,  spaceBefore: 64,  spaceAfter: 12 },
  h3:        { fontSize: 32,  lineHeight: 48,  spaceBefore: 40,  spaceAfter: 8  },
  paragraph: { fontSize: 32,  lineHeight: 48,  spaceBefore: 0,   spaceAfter: 12 },
  list:      { fontSize: 32,  lineHeight: 48,  spaceBefore: 0,   spaceAfter: 8  },
  quote:     { fontSize: 32,  lineHeight: 48,  spaceBefore: 24,  spaceAfter: 24 },
  code:      { fontSize: 28,  lineHeight: 44,  spaceBefore: 24,  spaceAfter: 24 },
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
  const [styleSettings,     setStyleSettings]    = useLocalStorage('hemingway:styleSettings:v2',  DEFAULT_STYLES)
  const [marginSettings,    setMarginSettings]   = useLocalStorage('hemingway:marginSettings',   DEFAULT_MARGINS)
  const [validationIssues,  setValidationIssues] = useLocalStorage('hemingway:validationIssues', [])
  const [normalizedBlocks,  setNormalizedBlocks] = useLocalStorage('hemingway:normalizedBlocks', [])
  const [measuredBlocks,    setMeasuredBlocks]   = useLocalStorage('hemingway:measuredBlocks',   [])
  const [paginatedPages,    setPaginatedPages]   = useLocalStorage('hemingway:paginatedPages',   [])
  const [resolvedStyles,    setResolvedStyles]   = useLocalStorage('hemingway:resolvedStyles:v2', null)
  const [logs,              setLogs]             = useLocalStorage('hemingway:logs',             [])
  const [lastRunAt,         setLastRunAt]        = useLocalStorage('hemingway:lastRunAt',        null)
  const [isRunning,         setIsRunning]        = useState(false)
  // True whenever styles/margins change after the last run — drives the Restyle button state
  const [stylesDirty,       setStylesDirty]      = useState(false)

  const cancelTokenRef = useRef({ cancelled: false })

  function handleStyleChange(key, prop, value) {
    setStyleSettings(prev => {
      if (prop === null) return { ...prev, [key]: value }
      return { ...prev, [key]: { ...prev[key], [prop]: value } }
    })
    setStylesDirty(true)
  }

  function handleMarginChange(key, value) {
    setMarginSettings(prev => ({ ...prev, [key]: value }))
    setStylesDirty(true)
  }

  // Shared pipeline runner — handles cancel token, state wiring, error logging.
  // pipelineArgs are merged into the runPipeline call; clearBlocks controls whether
  // normalizedBlocks is reset (Compose) or kept (Restyle).
  function runWith({ clearBlocks, pipelineArgs }) {
    setStylesDirty(false)
    cancelTokenRef.current.cancelled = true
    const token = { cancelled: false }
    cancelTokenRef.current = token

    setLogs([])
    setValidationIssues([])
    if (clearBlocks) setNormalizedBlocks([])
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
      cancelToken: token,
      log,
      onNormalizedBlocks: blocks   => { if (!token.cancelled) setNormalizedBlocks(blocks) },
      onResolvedStyles:   resolved => { if (!token.cancelled) setResolvedStyles(resolved) },
      onMeasuredBlocks:   blocks   => { if (!token.cancelled) setMeasuredBlocks(blocks) },
      onValidationIssues: issues   => { if (!token.cancelled) setValidationIssues(issues) },
      onPageReady:        pages    => { if (!token.cancelled) setPaginatedPages([...pages]) },
      onDone: ({ pages }) => {
        if (!token.cancelled) {
          setPaginatedPages(pages)
          setLastRunAt(Date.now())
        }
      },
      ...pipelineArgs,
    })
    .catch(err => {
      if (err instanceof PipelineCancelledError) return
      console.error('[pipeline]', err)
      err.message.split('\n').filter(Boolean).forEach(line =>
        log({ step: 'pipeline', message: line, type: 'error' })
      )
    })
    .finally(() => {
      if (!token.cancelled) setIsRunning(false)
    })
  }

  function handleCompose() {
    runWith({
      clearBlocks:  true,
      pipelineArgs: { notionPageId: extractPageId(notionUrl) },
    })
  }

  // Restyle: re-run resolveStyles → measure → validate → paginate using cached blocks.
  // Does not re-fetch or re-parse the source — fast style iteration without a network call.
  function handleRestyle() {
    if (normalizedBlocks.length === 0) return
    runWith({
      clearBlocks:  false,
      pipelineArgs: { cachedBlocks: normalizedBlocks },
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
        onRestyle={handleRestyle}
        onResetStyles={handleResetStyles}
        onClearOutput={handleClearOutput}
        onDownloadPdf={handleDownloadPdf}
        isRunning={isRunning}
        hasPages={paginatedPages.length > 0}
        hasBlocks={normalizedBlocks.length > 0}
        stylesDirty={stylesDirty}
      />
      <PagesPanel
        pages={paginatedPages}
        resolvedStyles={resolvedStyles}
        onDownloadPdf={handleDownloadPdf}
        onClearOutput={handleClearOutput}
        hasPages={paginatedPages.length > 0}
      />
      <LogsPanel  logs={logs} />
    </div>
  )
}
