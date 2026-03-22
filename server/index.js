// server — Express API server for Hemingway. Two endpoints: Notion page fetch (keeps token server-side)
// and image proxy (Notion S3 image URLs are CORS-restricted and expire — must be fetched server-side).

import express  from 'express'
import cors     from 'cors'
import dotenv   from 'dotenv'
import { Client } from '@notionhq/client'

dotenv.config()

const app    = express()
const notion = new Client({ auth: process.env.NOTION_TOKEN })

app.use(cors({ origin: /^http:\/\/localhost(:\d+)?$/ }))

// Fetch all blocks for a page, handling Notion's cursor-based pagination
app.get('/api/notion/page/:pageId', async (req, res) => {
  try {
    const blocks = await getAllBlocks(req.params.pageId)
    res.json({ blocks })
  } catch (err) {
    const status = err.status ?? 500
    res.status(status).json({ error: err.message })
  }
})

// Proxy Notion image URLs — signed S3 URLs are CORS-restricted and expire; browser cannot fetch them directly
app.get('/api/image', async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url query parameter required' })

  try {
    const upstream = await fetch(url)
    if (!upstream.ok) return res.status(upstream.status).json({ error: 'upstream image fetch failed' })

    const contentType = upstream.headers.get('content-type') || 'image/jpeg'
    res.setHeader('Content-Type', contentType)

    const buffer = await upstream.arrayBuffer()
    res.send(Buffer.from(buffer))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

async function getAllBlocks(blockId) {
  const blocks = []
  let cursor

  do {
    const response = await notion.blocks.children.list({
      block_id:     blockId,
      start_cursor: cursor,
      page_size:    100,
    })
    blocks.push(...response.results)
    cursor = response.has_more ? response.next_cursor : null
  } while (cursor)

  return blocks
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`))
