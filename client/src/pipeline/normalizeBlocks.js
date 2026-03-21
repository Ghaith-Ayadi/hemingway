// normalizeBlocks — Filters out unsupported block types and logs skips. Pass-through for v0.1
// since parseMarkdown already produces the normalized format.

const SUPPORTED_TYPES = new Set([
  'heading_1', 'heading_2', 'heading_3',
  'paragraph',
  'bulleted_list_item', 'numbered_list_item', 'to_do',
  'quote', 'callout',
  'code',
  'image',
  'divider',
])

export function normalizeBlocks(blocks, log) {
  log({ step: 'normalizeBlocks', message: `Processing ${blocks.length} blocks…`, type: 'info' })

  const normalized = []

  for (const block of blocks) {
    if (!SUPPORTED_TYPES.has(block.type)) {
      log({
        step: 'normalizeBlocks',
        message: `Skipping unknown block type: "${block.type}" (${block.id})`,
        type: 'warning',
      })
      continue
    }

    normalized.push(block)
  }

  log({ step: 'normalizeBlocks', message: `${normalized.length} blocks normalized`, type: 'info' })

  return normalized
}
