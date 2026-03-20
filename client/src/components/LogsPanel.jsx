function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export default function LogsPanel({ logs }) {
  return (
    <div className="column">
      <div className="column-header">Logs</div>
      <div className="column-body logs-body">
        {logs.length === 0
          ? <p className="logs-empty">Pipeline logs will appear here.</p>
          : logs.map((entry, i) => (
              <div key={i} className={`log-entry ${entry.type}`}>
                <span className="log-time">{formatTime(entry.timestamp)}</span>
                <span className="log-message">
                  <span className="log-step">[{entry.step}]</span>
                  {entry.message}
                </span>
              </div>
            ))
        }
      </div>
    </div>
  )
}
