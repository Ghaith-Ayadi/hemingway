<p align="center">
  <img src="hemingway.png" alt="Hemingway" width="120" />
</p>

<h1 align="center">Hemingway</h1>

<p align="center">
  <strong>Turn any public Notion page into a beautifully typeset, paginated PDF — from the browser or directly inside Figma.</strong>
</p>

---

## Why Hemingway?

Notion is great for writing. It's terrible for print layout. Hemingway bridges the gap: paste a Notion link, tweak your typography, and get pixel-perfect A4 pages — no copy-pasting, no reformatting, no fighting with export options.

- **Automatic pagination** — content flows across pages with proper margins, orphan control, and configurable page breaks on headings or dividers.
- **Full rich text** — bold, italic, links, bullet/numbered lists, to-dos, quotes, callouts, and code blocks are all preserved.
- **Syntax-highlighted code** — GitHub Light theme with line numbers, properly split across pages with continuous numbering.
- **Live style control** — adjust font sizes, line heights, spacing, and margins in real time.

---

## Two Ways to Use It

### Web App (`client/`)

A browser-based pipeline that fetches your Notion page, paginates it, and renders a live PDF preview you can download.

<p align="center">
  <img src="hemingway.png" alt="Web preview" width="60" />
</p>

**Stack:** Vite + React, react-pdf for rendering, Prism.js for syntax highlighting.

### Figma Plugin (`plugin/`)

A Figma plugin that generates native A4 frames with real text nodes — fully editable, inherits your Figma text styles, and exports to PDF natively from Figma.

**Stack:** Figma Plugin API, webpack, Prism.js for syntax highlighting.

Both share the same **Cloudflare Worker** (`worker/`) as the Notion proxy — no API key needed, works with any public Notion page.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A public Notion page URL

### Web App

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`, paste your Notion URL, hit Enter.

### Figma Plugin

```bash
cd plugin
npm install
npm run build
```

In Figma: **Plugins > Development > Import plugin from manifest** and select `plugin/manifest.json`.

### Cloudflare Worker

Each user needs to deploy their own worker instance:

```bash
cd worker
npx wrangler deploy
```

Then update the proxy URL in the web client ([client/src/pipeline/fetchNotion.js](client/src/pipeline/fetchNotion.js)) and the Figma plugin UI to point to your deployed worker URL.

---

## Project Structure

```
hemingway/
  client/          Web app (Vite + React)
  plugin/          Figma plugin
  worker/          Cloudflare Worker (Notion proxy)
  hemingway.png    Project logo
```

---

## How It Works

1. **Fetch** — The Cloudflare Worker hits Notion's internal API (`loadPageChunk`), normalizes blocks into a clean `{ type, content, ... }` format.
2. **Measure** — Each block is measured at the target width to get its exact rendered height (accounting for line wrapping).
3. **Paginate** — Blocks flow into A4-sized pages. Long code blocks are binary-search split at the line level. Page breaks can be forced on H1, H2, or dividers.
4. **Render** — The web app draws pages with react-pdf; the Figma plugin creates native text nodes with per-run formatting (bold, italic, links, syntax colors).

---

<p align="center">
  <sub>Built with unreasonable attention to typographic detail.</sub>
</p>
