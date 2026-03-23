// syntax.ts — Prism.js tokenization → flat color ranges for Figma setRangeFills
// Supports the most common languages used in Notion code blocks.

import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-swift'
import 'prismjs/components/prism-kotlin'
import 'prismjs/components/prism-markup'  // html/xml

export interface ColorRange {
  start: number
  end: number
  color: { r: number; g: number; b: number }
}

// GitHub Light palette — designed for light (#f6f8fa) background
const TOKEN_COLORS: Record<string, { r: number; g: number; b: number }> = {
  keyword:             { r: 0.812, g: 0.133, b: 0.180 },  // #cf222e red
  builtin:             { r: 0.020, g: 0.314, b: 0.682 },  // #0550ae blue
  'class-name':        { r: 0.584, g: 0.220, b: 0.000 },  // #953800 orange-brown
  function:            { r: 0.510, g: 0.314, b: 0.875 },  // #8250df purple
  'function-variable': { r: 0.510, g: 0.314, b: 0.875 },
  string:              { r: 0.039, g: 0.188, b: 0.412 },  // #0a3069 dark blue
  'template-string':   { r: 0.039, g: 0.188, b: 0.412 },
  'string-interpolation': { r: 0.039, g: 0.188, b: 0.412 },
  number:              { r: 0.020, g: 0.314, b: 0.682 },  // #0550ae blue
  boolean:             { r: 0.020, g: 0.314, b: 0.682 },
  constant:            { r: 0.020, g: 0.314, b: 0.682 },
  comment:             { r: 0.431, g: 0.467, b: 0.506 },  // #6e7781 gray
  'block-comment':     { r: 0.431, g: 0.467, b: 0.506 },
  operator:            { r: 0.812, g: 0.133, b: 0.180 },
  punctuation:         { r: 0.141, g: 0.161, b: 0.184 },  // #24292f foreground
  property:            { r: 0.020, g: 0.314, b: 0.682 },
  tag:                 { r: 0.067, g: 0.388, b: 0.161 },  // #116329 green (HTML)
  'attr-name':         { r: 0.020, g: 0.314, b: 0.682 },
  'attr-value':        { r: 0.039, g: 0.188, b: 0.412 },
  regex:               { r: 0.039, g: 0.188, b: 0.412 },
  important:           { r: 0.812, g: 0.133, b: 0.180 },
  variable:            { r: 0.584, g: 0.220, b: 0.000 },
  namespace:           { r: 0.584, g: 0.220, b: 0.000 },
  decorator:           { r: 0.510, g: 0.314, b: 0.875 },
  annotation:          { r: 0.510, g: 0.314, b: 0.875 },
  type:                { r: 0.584, g: 0.220, b: 0.000 },
  symbol:              { r: 0.039, g: 0.188, b: 0.412 },
}

// Language aliases → Prism grammar names
const LANG_MAP: Record<string, string> = {
  js: 'javascript', javascript: 'javascript',
  ts: 'typescript', typescript: 'typescript',
  py: 'python',     python: 'python',
  java: 'java',
  go: 'go',
  sql: 'sql',
  css: 'css',
  sh: 'bash',  bash: 'bash', shell: 'bash',
  json: 'json',
  rs: 'rust',  rust: 'rust',
  swift: 'swift',
  kotlin: 'kotlin', kt: 'kotlin',
  html: 'markup', xml: 'markup', markup: 'markup',
}

type TokenOrString = string | Prism.Token

// Flatten the Prism token tree into {start, end, color} ranges
function flattenTokens(tokens: TokenOrString[], offset = 0): { ranges: ColorRange[]; length: number } {
  const ranges: ColorRange[] = []
  let pos = offset

  for (const token of tokens) {
    if (typeof token === 'string') {
      pos += token.length
    } else {
      const color = TOKEN_COLORS[token.type]
      const content = token.content
      if (typeof content === 'string') {
        if (color) ranges.push({ start: pos, end: pos + content.length, color })
        pos += content.length
      } else {
        // nested tokens
        const nested = flattenTokens(Array.isArray(content) ? content : [content], pos)
        if (color) {
          // Apply parent color to entire range if no children override
          ranges.push({ start: pos, end: pos + nested.length, color })
        }
        ranges.push(...nested.ranges)
        pos += nested.length
      }
    }
  }

  return { ranges, length: pos - offset }
}

export function tokenize(code: string, language: string): ColorRange[] {
  const grammarName = LANG_MAP[language] ?? null
  if (!grammarName) return []
  const grammar = Prism.languages[grammarName]
  if (!grammar) return []

  try {
    const tokens = Prism.tokenize(code, grammar)
    return flattenTokens(tokens).ranges
  } catch {
    return []
  }
}
