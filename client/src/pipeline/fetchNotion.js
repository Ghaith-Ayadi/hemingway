// fetchNotion — Fetches Notion page blocks from the local API server and converts them to the
// normalized block format (same shape as parseMarkdown output) so the rest of the pipeline is unchanged.

const API_BASE = 'http://localhost:3001'

// Convert a Notion rich_text array to RichTextRun[]
function notionRichTextToRuns(richText = []) {
  return richText.map(rt => {
    const run = { text: rt.plain_text ?? '' }
    if (rt.annotations?.bold)   run.bold   = true
    if (rt.annotations?.italic) run.italic = true
    if (rt.annotations?.code)   run.code   = true
    return run
  }).filter(run => run.text.length > 0)
}

// Rewrite a Notion image URL through the local proxy so the browser and react-pdf can load it
function proxyImageUrl(notionImageBlock) {
  const raw = notionImageBlock.type === 'external'
    ? notionImageBlock.external?.url
    : notionImageBlock.file?.url

  if (!raw) return null
  return `${API_BASE}/api/image?url=${encodeURIComponent(raw)}`
}

export async function fetchNotion(pageId, log) {
  const url = `${API_BASE}/api/notion/page/${pageId}`
  log({ step: 'fetchNotion', message: `Page ID: ${pageId}`, type: 'info' })
  log({ step: 'fetchNotion', message: `GET ${url}`, type: 'info' })

  let response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error(`Request to API server timed out after 30s — the page may be too large or the server is slow`)
    }
    throw new Error(
      `Cannot reach API server at ${API_BASE} — is it running?\n` +
      `Start both servers with: npm run dev (from the project root)\n` +
      `(original error: ${err.message})`
    )
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body.error ?? `HTTP ${response.status}`
    throw new Error(`Notion API error: ${detail}`)
  }

  const { blocks: rawBlocks } = await response.json()
  log({ step: 'fetchNotion', message: `Received ${rawBlocks.length} raw blocks from Notion`, type: 'info' })

  const normalized = notionBlocksToNormalized(rawBlocks, log)
  log({ step: 'fetchNotion', message: `Converted to ${normalized.length} normalized blocks`, type: 'info' })

  return normalized
}

function notionBlocksToNormalized(rawBlocks, log) {
  const blocks = []
  let numberedListIndex = 0

  for (const raw of rawBlocks) {
    // Reset numbered list counter when a non-numbered block appears
    if (raw.type !== 'numbered_list_item') numberedListIndex = 0

    switch (raw.type) {

      case 'paragraph':
        blocks.push({
          id:      raw.id,
          type:    'paragraph',
          content: notionRichTextToRuns(raw.paragraph?.rich_text),
        })
        break

      case 'heading_1':
        blocks.push({
          id:      raw.id,
          type:    'heading_1',
          content: notionRichTextToRuns(raw.heading_1?.rich_text),
        })
        break

      case 'heading_2':
        blocks.push({
          id:      raw.id,
          type:    'heading_2',
          content: notionRichTextToRuns(raw.heading_2?.rich_text),
        })
        break

      case 'heading_3':
        blocks.push({
          id:      raw.id,
          type:    'heading_3',
          content: notionRichTextToRuns(raw.heading_3?.rich_text),
        })
        break

      case 'bulleted_list_item':
        blocks.push({
          id:        raw.id,
          type:      'bulleted_list_item',
          content:   notionRichTextToRuns(raw.bulleted_list_item?.rich_text),
          hasNested: raw.has_children ?? false,
        })
        break

      case 'numbered_list_item':
        numberedListIndex++
        blocks.push({
          id:        raw.id,
          type:      'numbered_list_item',
          content:   notionRichTextToRuns(raw.numbered_list_item?.rich_text),
          index:     numberedListIndex,
          hasNested: raw.has_children ?? false,
        })
        break

      case 'to_do':
        blocks.push({
          id:        raw.id,
          type:      'to_do',
          content:   notionRichTextToRuns(raw.to_do?.rich_text),
          checked:   raw.to_do?.checked ?? false,
          hasNested: raw.has_children ?? false,
        })
        break

      case 'quote':
        blocks.push({
          id:      raw.id,
          type:    'quote',
          content: notionRichTextToRuns(raw.quote?.rich_text),
        })
        break

      case 'callout': {
        const iconObj = raw.callout?.icon
        const icon = iconObj?.type === 'emoji' ? iconObj.emoji : null
        blocks.push({
          id:      raw.id,
          type:    'callout',
          icon,
          content: notionRichTextToRuns(raw.callout?.rich_text),
        })
        break
      }

      case 'code':
        blocks.push({
          id:       raw.id,
          type:     'code',
          content:  notionRichTextToRuns(raw.code?.rich_text),
          language: raw.code?.language ?? '',
        })
        break

      case 'divider':
        blocks.push({ id: raw.id, type: 'divider', content: [] })
        break

      case 'image': {
        const url = proxyImageUrl(raw.image)
        if (url) {
          blocks.push({ id: raw.id, type: 'image', url, alt: '', content: [] })
        } else {
          log({ step: 'fetchNotion', message: `Skipping image block ${raw.id} — no URL`, type: 'warning' })
        }
        break
      }

      default:
        log({
          step:    'fetchNotion',
          message: `Skipping unsupported block type: "${raw.type}" (${raw.id})`,
          type:    'warning',
        })
        break
    }
  }

  return blocks
}
