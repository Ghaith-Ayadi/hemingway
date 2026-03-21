// exportPdf — Renders HemingwayPdf to a Blob via react-pdf's pdf() function and triggers a browser download.

import { pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import { HemingwayPdf } from './HemingwayPdf.jsx'

export async function exportPdf(pages, resolvedStyles) {
  const doc = createElement(HemingwayPdf, { pages, resolvedStyles })
  const blob = await pdf(doc).toBlob()

  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = 'hemingway.pdf'
  a.click()
  URL.revokeObjectURL(url)
}
