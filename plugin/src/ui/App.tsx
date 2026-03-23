import React, { useState, useEffect, useCallback } from 'react'
import {
  BlockType, StyleMap, MarginSettings, PluginSettings,
  PluginMessage, UiMessage,
  DEFAULT_STYLE_MAP, DEFAULT_MARGINS, PROXY_URL, BLOCK_TYPE_LABELS,
} from '../types'

interface FigmaStyle {
  id: string
  name: string
}

interface LogEntry {
  level: 'info' | 'warn' | 'error'
  message: string
  ts: number
}

const BLOCK_TYPES: BlockType[] = [
  'heading_1', 'heading_2', 'heading_3',
  'paragraph',
  'bulleted_list_item', 'numbered_list_item',
  'to_do', 'quote', 'callout', 'code', 'divider',
]

function post(msg: UiMessage) {
  parent.postMessage({ pluginMessage: msg }, '*')
}

export default function App() {
  const [notionUrl, setNotionUrl]   = useState('')
  const [proxyUrl, setProxyUrl]     = useState(PROXY_URL)
  const [styleMap, setStyleMap]     = useState<StyleMap>(DEFAULT_STYLE_MAP)
  const [margins, setMargins]       = useState<MarginSettings>(DEFAULT_MARGINS)
  const [figmaStyles, setFigmaStyles] = useState<FigmaStyle[]>([])
  const [newPageOnH1, setNewPageOnH1]           = useState(false)
  const [newPageOnH2, setNewPageOnH2]           = useState(false)
  const [newPageOnDivider, setNewPageOnDivider] = useState(false)
  const [logs, setLogs]             = useState<LogEntry[]>([])
  const [running, setRunning]       = useState(false)
  const [tab, setTab]               = useState<'styles' | 'margins' | 'logs'>('styles')

  // Request Figma styles on mount
  useEffect(() => {
    post({ type: 'get-styles' })
  }, [])

  // Listen to messages from plugin main thread
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data.pluginMessage as PluginMessage
      if (!msg) return
      switch (msg.type) {
        case 'styles-list':
          setFigmaStyles(msg.styles)
          break
        case 'log':
          setLogs(prev => [...prev, { level: msg.level, message: msg.message, ts: Date.now() }])
          if (msg.level === 'error') setRunning(false)
          break
        case 'done':
          addLog('info', `✓ ${msg.pageCount} page(s) generated`)
          setRunning(false)
          setTab('logs')
          break
        case 'error':
          addLog('error', msg.message)
          setRunning(false)
          setTab('logs')
          break
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  function addLog(level: LogEntry['level'], message: string) {
    setLogs(prev => [...prev, { level, message, ts: Date.now() }])
  }

  function buildSettings(): PluginSettings {
    return { notionUrl, styleMap, margins, proxyUrl, newPageOnDivider, newPageOnH1, newPageOnH2 }
  }

  function handleCompose() {
    if (!notionUrl.trim()) { addLog('error', 'Paste a Notion URL first'); setTab('logs'); return }
    setLogs([])
    setRunning(true)
    setTab('logs')
    post({ type: 'compose', settings: buildSettings() })
  }

  function handleRepaginate() {
    setLogs([])
    setRunning(true)
    setTab('logs')
    post({ type: 'repaginate', settings: buildSettings() })
  }

  function setStyleField(type: BlockType, field: 'figmaStyleId' | 'marginTop' | 'marginBottom', value: any) {
    setStyleMap(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }))
  }

  function setMargin(key: keyof MarginSettings, value: number) {
    setMargins(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="plugin">

      {/* URL input */}
      <div className="section">
        <input
          className="url-input"
          type="text"
          placeholder="Notion page URL (must be public)"
          value={notionUrl}
          onChange={e => setNotionUrl(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={tab === 'styles' ? 'tab active' : 'tab'} onClick={() => setTab('styles')}>Styles</button>
        <button className={tab === 'margins' ? 'tab active' : 'tab'} onClick={() => setTab('margins')}>Margins</button>
        <button className={tab === 'logs' ? 'tab active' : 'tab'} onClick={() => setTab('logs')}>
          Logs {logs.some(l => l.level === 'error') ? '⚠' : ''}
        </button>
      </div>

      {/* Styles tab */}
      {tab === 'styles' && (
        <div className="tab-content">
          <div className="table-header">
            <span className="col-label">Block type</span>
            <span className="col-style">Figma style</span>
            <span className="col-margin">↑</span>
            <span className="col-margin">↓</span>
          </div>
          {BLOCK_TYPES.map(type => (
            <div key={type} className="style-row">
              <span className="col-label">{BLOCK_TYPE_LABELS[type]}</span>
              <select
                className="col-style"
                value={styleMap[type].figmaStyleId ?? ''}
                onChange={e => setStyleField(type, 'figmaStyleId', e.target.value || null)}
              >
                <option value="">— none —</option>
                {figmaStyles.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input
                className="col-margin"
                type="number"
                value={styleMap[type].marginTop}
                onChange={e => setStyleField(type, 'marginTop', Number(e.target.value))}
              />
              <input
                className="col-margin"
                type="number"
                value={styleMap[type].marginBottom}
                onChange={e => setStyleField(type, 'marginBottom', Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      )}

      {/* Margins tab */}
      {tab === 'margins' && (
        <div className="tab-content margins-tab">
          <div className="margin-row">
            <label>Top</label>
            <input type="number" value={margins.top} onChange={e => setMargin('top', Number(e.target.value))} />
            <span>pt</span>
          </div>
          <div className="margin-row">
            <label>Bottom</label>
            <input type="number" value={margins.bottom} onChange={e => setMargin('bottom', Number(e.target.value))} />
            <span>pt</span>
          </div>
          <div className="margin-row">
            <label>Left</label>
            <input type="number" value={margins.left} onChange={e => setMargin('left', Number(e.target.value))} />
            <span>pt</span>
          </div>
          <div className="margin-row">
            <label>Right</label>
            <input type="number" value={margins.right} onChange={e => setMargin('right', Number(e.target.value))} />
            <span>pt</span>
          </div>
          <div className="divider" />
          <div className="margin-row">
            <label style={{ fontSize: 10, color: 'var(--figma-color-text-secondary)' }}>Proxy URL</label>
            <input
              type="text"
              value={proxyUrl}
              onChange={e => setProxyUrl(e.target.value)}
              style={{ flex: 1, fontSize: 10 }}
            />
          </div>
        </div>
      )}

      {/* Logs tab */}
      {tab === 'logs' && (
        <div className="tab-content logs-tab">
          {logs.length === 0 && (
            <div className="logs-empty">No logs yet</div>
          )}
          {logs.map((entry, i) => (
            <div key={i} className={`log-entry log-${entry.level}`}>
              {entry.message}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="actions">
        <button className="btn-primary" onClick={handleCompose} disabled={running}>
          {running ? 'Running…' : 'Compose'}
        </button>
        <button className="btn-secondary" onClick={handleRepaginate} disabled={running}>
          Re-paginate
        </button>
      </div>

    </div>
  )
}
