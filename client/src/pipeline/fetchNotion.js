// fetchNotion — Fetches Notion page blocks via the Cloudflare Worker proxy.
// The worker returns blocks already in the normalized format (same shape the pipeline expects).

const WORKER_URL = 'https://hemingway-notion-proxy.reflow-app.workers.dev'

export async function fetchNotion(pageId, log) {
  // Reconstruct a Notion URL from the page ID so the worker can parse it
  const notionUrl = `https://www.notion.so/${pageId.replace(/-/g, '')}`
  log({ step: 'fetchNotion', message: `Page ID: ${pageId}`, type: 'info' })
  log({ step: 'fetchNotion', message: `POST ${WORKER_URL}`, type: 'info' })

  let response
  try {
    response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: notionUrl }),
      signal: AbortSignal.timeout(30000),
    })
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error('Request to worker timed out after 30s — the page may be too large')
    }
    throw new Error(`Cannot reach worker at ${WORKER_URL} (${err.message})`)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body.error ?? `HTTP ${response.status}`
    throw new Error(`Notion API error: ${detail}`)
  }

  const { blocks } = await response.json()
  log({ step: 'fetchNotion', message: `Received ${blocks.length} normalized blocks`, type: 'info' })

  return blocks
}
