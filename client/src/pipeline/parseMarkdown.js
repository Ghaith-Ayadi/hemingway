// parseMarkdown — Fetches /testfile.md at runtime, parses it with remark-parse into an MDAST,
// then walks the tree into normalized blocks with typed content as RichTextRun[].

import { unified } from 'unified'
import remarkParse from 'remark-parse'

let _idCounter = 0
function nextId() {
  return `block-${++_idCounter}`
}

// Extract an array of rich text runs from an inline node tree
function extractRichText(node) {
  if (!node.children) {
    return [{ text: node.value ?? '' }]
  }

  return node.children.flatMap(child => {
    switch (child.type) {
      case 'text':
        return [{ text: child.value }]
      case 'strong':
        return extractRichText(child).map(r => ({ ...r, bold: true }))
      case 'emphasis':
        return extractRichText(child).map(r => ({ ...r, italic: true }))
      case 'inlineCode':
        return [{ text: child.value, code: true }]
      case 'link':
        return extractRichText(child)
      case 'image':
        return [{ text: child.alt ?? '' }]
      default:
        return child.value ? [{ text: child.value }] : []
    }
  })
}

function plainText(richText) {
  return richText.map(r => r.text).join('')
}

// Walk MDAST nodes → normalized block array
function mdastToBlocks(nodes) {
  const blocks = []

  for (const node of nodes) {
    switch (node.type) {

      case 'heading': {
        const typeMap = { 1: 'heading_1', 2: 'heading_2', 3: 'heading_3' }
        blocks.push({
          id: nextId(),
          type: typeMap[node.depth] ?? 'heading_3',
          content: extractRichText(node),
        })
        break
      }

      case 'paragraph': {
        // Image-only paragraph → image block
        if (node.children.length === 1 && node.children[0].type === 'image') {
          const img = node.children[0]
          blocks.push({
            id: nextId(),
            type: 'image',
            url: img.url,
            alt: img.alt ?? '',
            content: [],
          })
        } else {
          blocks.push({
            id: nextId(),
            type: 'paragraph',
            content: extractRichText(node),
          })
        }
        break
      }

      case 'list': {
        let orderedIndex = 1
        for (const item of node.children) {
          const firstParagraph = item.children.find(c => c.type === 'paragraph')
          const content = firstParagraph ? extractRichText(firstParagraph) : []
          const hasNested = item.children.length > 1

          if (item.checked !== null && item.checked !== undefined) {
            blocks.push({
              id: nextId(),
              type: 'to_do',
              content,
              checked: item.checked,
              hasNested,
            })
          } else if (node.ordered) {
            blocks.push({
              id: nextId(),
              type: 'numbered_list_item',
              content,
              index: orderedIndex++,
              hasNested,
            })
          } else {
            blocks.push({
              id: nextId(),
              type: 'bulleted_list_item',
              content,
              hasNested,
            })
          }
        }
        break
      }

      case 'blockquote': {
        const allContent = node.children.flatMap(child =>
          child.type === 'paragraph' ? extractRichText(child) : []
        )
        const text = plainText(allContent)
        const emojiMatch = text.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u)

        if (emojiMatch) {
          // Strip the leading emoji + space from content
          const icon = emojiMatch[1]
          const stripped = [...allContent]
          if (stripped[0]) {
            stripped[0] = {
              ...stripped[0],
              text: stripped[0].text.replace(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u, ''),
            }
          }
          blocks.push({ id: nextId(), type: 'callout', icon, content: stripped })
        } else {
          blocks.push({ id: nextId(), type: 'quote', content: allContent })
        }
        break
      }

      case 'code': {
        blocks.push({
          id: nextId(),
          type: 'code',
          content: [{ text: node.value }],
          language: node.lang ?? '',
        })
        break
      }

      case 'thematicBreak': {
        blocks.push({ id: nextId(), type: 'divider', content: [] })
        break
      }

      default:
        break
    }
  }

  return blocks
}

export async function parseMarkdown(log) {
  _idCounter = 0

  log({ step: 'parseMarkdown', message: 'Fetching testfile.md…', type: 'info' })

  const response = await fetch('/testfile.md')
  if (!response.ok) {
    throw new Error(`Failed to fetch testfile.md — status ${response.status}`)
  }

  const markdown = await response.text()
  log({ step: 'parseMarkdown', message: `Fetched ${markdown.length} chars`, type: 'info' })

  const tree = unified().use(remarkParse).parse(markdown)
  const blocks = mdastToBlocks(tree.children)

  log({ step: 'parseMarkdown', message: `Parsed ${blocks.length} blocks`, type: 'info' })

  return blocks
}
