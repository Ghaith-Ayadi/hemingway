// Hemingway Cloudflare Worker
// Fetches a public Notion page via the unofficial internal API and returns normalized blocks.
// Deploy: wrangler deploy

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }
    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405)
    }

    let body
    try { body = await request.json() } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    const pageId = extractPageId(body.url)
    if (!pageId) return json({ error: 'Could not extract page ID from URL' }, 400)

    try {
      const rawBlocks = await fetchAllBlocks(pageId)
      const blocks = normalizeBlocks(rawBlocks, pageId)
      return json({ blocks })
    } catch (err) {
      return json({ error: err.message }, 500)
    }
  }
}

// ── URL parsing ──────────────────────────────────────────────────────────────

function extractPageId(url) {
  if (!url) return null
  // Match 32-char hex ID at end of URL (with or without hyphens)
  const clean = url.split('?')[0].split('#')[0]
  const match = clean.match(/([a-f0-9]{32})$/) || clean.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/)
  if (!match) return null
  const raw = match[1].replace(/-/g, '')
  return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`
}

// ── Notion fetching ──────────────────────────────────────────────────────────

async function fetchAllBlocks(pageId) {
  const allBlocks = {}
  let cursor = { stack: [] }

  while (true) {
    const res = await fetch('https://www.notion.so/api/v3/loadPageChunk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId, limit: 100, cursor, chunkNumber: 0, verticalColumns: false }),
    })
    if (!res.ok) throw new Error(`Notion API error: ${res.status}`)
    const data = await res.json()
    Object.assign(allBlocks, data.recordMap.block)

    const nextStack = data.cursor?.stack
    if (!nextStack || nextStack.length === 0) break
    cursor = data.cursor
  }

  return allBlocks
}

// ── Normalization ────────────────────────────────────────────────────────────

// Notion internal type → our type
const TYPE_MAP = {
  text:            'paragraph',
  header:          'heading_1',
  sub_header:      'heading_2',
  sub_sub_header:  'heading_3',
  bulleted_list:   'bulleted_list_item',
  numbered_list:   'numbered_list_item',
  to_do:           'to_do',
  quote:           'quote',
  callout:         'callout',
  code:            'code',
  image:           'image',
  divider:         'divider',
}

function normalizeBlocks(allBlocks, pageId) {
  const page = allBlocks[pageId]?.value
  if (!page) throw new Error('Page block not found')

  const contentIds = page.content ?? []
  const blocks = []
  let numberedIndex = 0
  let prevType = null

  for (const id of contentIds) {
    const entry = allBlocks[id]
    if (!entry?.value) continue
    const v = entry.value
    const type = TYPE_MAP[v.type]
    if (!type) continue  // skip unsupported types (collection_view_page, page, etc.)

    // numbered list counter
    if (type === 'numbered_list_item') {
      numberedIndex = prevType === 'numbered_list_item' ? numberedIndex + 1 : 1
    } else {
      numberedIndex = 0
    }
    prevType = type

    const block = {
      id,
      type,
      content: parseRichText(v.properties?.title ?? []),
    }

    if (type === 'numbered_list_item') block.index = numberedIndex
    if (type === 'to_do') block.checked = v.properties?.checked?.[0]?.[0] === 'Yes'
    if (type === 'callout') block.icon = v.format?.page_icon ?? null
    if (type === 'image') block.url = v.properties?.source?.[0]?.[0] ?? null
    if (type === 'code') block.language = v.properties?.language?.[0]?.[0]?.toLowerCase() ?? 'plain'

    blocks.push(block)
  }

  return blocks
}

// Parse Notion rich text segments [[text, [[annotation, value], ...]], ...]
function parseRichText(segments) {
  return segments.map(seg => {
    const text = seg[0] ?? ''
    const annotations = seg[1] ?? []
    const run = { text }
    for (const ann of annotations) {
      const [type, value] = ann
      if (type === 'b') run.bold = true
      if (type === 'i') run.italic = true
      if (type === 'c') run.code = true
      if (type === 's') run.strikethrough = true
      if (type === 'a') run.link = value   // hyperlink
    }
    return run
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
