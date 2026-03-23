// Shared types between plugin main thread and UI

export interface RichTextRun {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  strikethrough?: boolean
  link?: string
}

export type BlockType =
  | 'heading_1' | 'heading_2' | 'heading_3'
  | 'paragraph'
  | 'bulleted_list_item' | 'numbered_list_item'
  | 'to_do' | 'quote' | 'callout' | 'code'
  | 'image' | 'divider'

export interface Block {
  id: string
  type: BlockType
  content: RichTextRun[]
  index?: number      // numbered list
  checked?: boolean   // to_do
  icon?: string | null   // callout
  url?: string | null    // image
  language?: string      // code block
  isCodeContinuation?: boolean  // code block split across pages
  codeLineStart?: number        // 1-based starting line number for continuation chunks
}

export interface StyleAssignment {
  figmaStyleId: string | null   // Figma text style ID
  marginTop: number             // pt
  marginBottom: number          // pt
}

export type StyleMap = Record<BlockType, StyleAssignment>

export interface MarginSettings {
  top: number
  bottom: number
  left: number
  right: number
}

export interface PluginSettings {
  notionUrl: string
  styleMap: StyleMap
  margins: MarginSettings
  proxyUrl: string
  newPageOnDivider: boolean
  newPageOnH1: boolean
  newPageOnH2: boolean
}

// Messages from UI → plugin
export type UiMessage =
  | { type: 'compose'; settings: PluginSettings }
  | { type: 'repaginate'; settings: PluginSettings }
  | { type: 'get-styles' }
  | { type: 'resize'; width: number; height: number }

// Messages from plugin → UI
export type PluginMessage =
  | { type: 'styles-list'; styles: { id: string; name: string }[] }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'done'; pageCount: number }
  | { type: 'error'; message: string }

// ── Constants ────────────────────────────────────────────────────────────────

export const A4_WIDTH  = 595   // pt / px in Figma
export const A4_HEIGHT = 842

export const DEFAULT_STYLE_MAP: StyleMap = {
  heading_1:          { figmaStyleId: null, marginTop: 48, marginBottom: 24 },
  heading_2:          { figmaStyleId: null, marginTop: 32, marginBottom: 16 },
  heading_3:          { figmaStyleId: null, marginTop: 24, marginBottom: 12 },
  paragraph:          { figmaStyleId: null, marginTop: 0,  marginBottom: 12 },
  bulleted_list_item: { figmaStyleId: null, marginTop: 0,  marginBottom: 6  },
  numbered_list_item: { figmaStyleId: null, marginTop: 0,  marginBottom: 6  },
  to_do:              { figmaStyleId: null, marginTop: 0,  marginBottom: 6  },
  quote:              { figmaStyleId: null, marginTop: 12, marginBottom: 12 },
  callout:            { figmaStyleId: null, marginTop: 12, marginBottom: 12 },
  code:               { figmaStyleId: null, marginTop: 12, marginBottom: 12 },
  image:              { figmaStyleId: null, marginTop: 12, marginBottom: 12 },
  divider:            { figmaStyleId: null, marginTop: 16, marginBottom: 16 },
}

export const DEFAULT_MARGINS: MarginSettings = { top: 60, bottom: 60, left: 40, right: 40 }

export const PROXY_URL = 'https://hemingway-notion-proxy.reflow-app.workers.dev'

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  heading_1: 'Heading 1',
  heading_2: 'Heading 2',
  heading_3: 'Heading 3',
  paragraph: 'Paragraph',
  bulleted_list_item: 'Bulleted List',
  numbered_list_item: 'Numbered List',
  to_do: 'To-Do',
  quote: 'Quote',
  callout: 'Callout',
  code: 'Code',
  image: 'Image',
  divider: 'Divider',
}
