// HemingwayPdf — react-pdf Document component. Maps paginated pages → PDF pages using A4 dimensions.
// All pixel values from resolvedStyles are scaled from 1600px render width down to 595pt (A4 PDF width).

import { Document, Page, View, Text, Image, Font } from '@react-pdf/renderer'

const A4_WIDTH  = 595.28  // points
const PDF_SCALE = A4_WIDTH / 1600

// react-pdf does not support .woff2 — use .woff instead
Font.register({
  family: 'Inter',
  fonts: [
    { src: '/fonts/inter-latin-400-normal.woff', fontWeight: 400 },
    { src: '/fonts/inter-latin-600-normal.woff', fontWeight: 600 },
    { src: '/fonts/inter-latin-700-normal.woff', fontWeight: 700 },
  ],
})

function px(value) {
  return value * PDF_SCALE
}

// Renders an array of RichTextRuns as inline nested <Text> elements inside a parent <Text>
function PdfRichText({ runs = [], style }) {
  if (runs.length === 0) return null
  return (
    <Text style={style}>
      {runs.map((run, i) => (
        <Text
          key={i}
          style={{
            fontWeight:  run.bold   ? 700       : undefined,
            fontStyle:   run.italic ? 'italic'  : undefined,
            fontFamily:  run.code   ? 'Courier' : undefined,
          }}
        >
          {run.text}
        </Text>
      ))}
    </Text>
  )
}

function PdfBlock({ block, resolvedStyles }) {
  const { blocks: typeStyles, spaceBefore, spaceAfter } = resolvedStyles
  const ts = typeStyles[block.type] ?? { fontSize: 16, lineHeight: 24 }

  const base = {
    fontFamily:   'Inter',
    fontWeight:   400,
    fontSize:     px(ts.fontSize),
    lineHeight:   ts.fontSize > 0 ? ts.lineHeight / ts.fontSize : 1.5,
    marginTop:    block.isContinuation ? 0 : px(spaceBefore),
    marginBottom: px(spaceAfter),
  }

  switch (block.type) {

    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
      return <PdfRichText runs={block.content} style={{ ...base, fontWeight: 700 }} />

    case 'paragraph':
      return <PdfRichText runs={block.content} style={base} />

    case 'bulleted_list_item':
      return (
        <View style={{ flexDirection: 'row', marginTop: px(spaceBefore), marginBottom: px(spaceAfter), paddingLeft: px(24) }}>
          <Text style={{ ...base, marginTop: 0, marginBottom: 0, marginRight: px(10) }}>•</Text>
          <PdfRichText runs={block.content} style={{ ...base, marginTop: 0, marginBottom: 0, flex: 1 }} />
        </View>
      )

    case 'numbered_list_item':
      return (
        <View style={{ flexDirection: 'row', marginTop: px(spaceBefore), marginBottom: px(spaceAfter), paddingLeft: px(24) }}>
          <Text style={{ ...base, marginTop: 0, marginBottom: 0, marginRight: px(10) }}>{block.index}.</Text>
          <PdfRichText runs={block.content} style={{ ...base, marginTop: 0, marginBottom: 0, flex: 1 }} />
        </View>
      )

    case 'to_do':
      return (
        <View style={{ flexDirection: 'row', marginTop: px(spaceBefore), marginBottom: px(spaceAfter), paddingLeft: px(24) }}>
          <Text style={{ ...base, marginTop: 0, marginBottom: 0, marginRight: px(10) }}>
            {block.checked ? '☑' : '☐'}
          </Text>
          <PdfRichText
            runs={block.content}
            style={{ ...base, marginTop: 0, marginBottom: 0, flex: 1, textDecoration: block.checked ? 'line-through' : 'none' }}
          />
        </View>
      )

    case 'quote':
      return (
        <View style={{ marginTop: px(spaceBefore), marginBottom: px(spaceAfter), paddingLeft: px(20), borderLeftWidth: 2, borderLeftColor: '#ccc', borderLeftStyle: 'solid' }}>
          <PdfRichText runs={block.content} style={{ ...base, marginTop: 0, marginBottom: 0, color: '#555' }} />
        </View>
      )

    case 'callout':
      return (
        <View style={{ marginTop: px(spaceBefore), marginBottom: px(spaceAfter), padding: px(12), backgroundColor: '#f7f7f7', borderRadius: 4, flexDirection: 'row' }}>
          {block.icon && <Text style={{ ...base, marginTop: 0, marginBottom: 0, marginRight: px(10) }}>{block.icon}</Text>}
          <PdfRichText runs={block.content} style={{ ...base, marginTop: 0, marginBottom: 0, flex: 1 }} />
        </View>
      )

    case 'code':
      return (
        <View style={{ marginTop: px(spaceBefore), marginBottom: px(spaceAfter), backgroundColor: '#f4f4f4', padding: px(16), borderRadius: 4 }}>
          <Text style={{ ...base, marginTop: 0, marginBottom: 0, fontFamily: 'Courier' }}>
            {block.content.map(r => r.text).join('')}
          </Text>
        </View>
      )

    case 'divider':
      return (
        <View style={{ marginTop: px(spaceBefore), marginBottom: px(spaceAfter), borderTopWidth: 0.5, borderTopColor: '#ddd', borderTopStyle: 'solid' }} />
      )

    case 'image':
      return block.url ? (
        <View style={{ marginTop: px(spaceBefore), marginBottom: px(spaceAfter) }}>
          <Image src={block.url} style={{ maxWidth: '100%' }} />
        </View>
      ) : null

    default:
      return null
  }
}

export function HemingwayPdf({ pages, resolvedStyles }) {
  const { margins } = resolvedStyles

  return (
    <Document>
      {pages.map(page => (
        <Page
          key={page.number}
          size="A4"
          style={{
            paddingTop:    px(margins.top),
            paddingBottom: px(margins.bottom),
            paddingLeft:   px(margins.left),
            paddingRight:  px(margins.right),
            fontFamily:    'Inter',
          }}
        >
          {page.blocks.map(block => (
            <PdfBlock key={block.id} block={block} resolvedStyles={resolvedStyles} />
          ))}
        </Page>
      ))}
    </Document>
  )
}
