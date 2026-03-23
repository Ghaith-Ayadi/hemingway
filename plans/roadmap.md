# Hemingway — Roadmap

---

## v0.1 — Markdown File Input

### Phase 1 — Project Scaffold
- Init Vite + React project (frontend only, no backend)
- Configure `package.json` scripts
- Init Git repo

### Phase 2 — UI Shell
- 3-column layout (equal, max-width 1920px, independent scroll)
- Column 1: settings panel (typography/spacing/margins), action buttons
- Column 2: page canvas area
- Column 3: log panel
- No logic yet — just structure and state shape

### Phase 3 — Markdown Parser
- Parse static `testfile.md` (bundled) into normalized block model
- Support: paragraph, heading_1/2/3, bulleted_list, numbered_list, to_do, quote, code, image, divider, callout

### Phase 4 — Pipeline Engine
- Pipeline runner (sequential, cancellable, logs each step)
- `parseMarkdown` step (replaces `fetchNotion`)
- `validateBlocks` step (giant block + nesting warnings)
- `normalizeBlocks` step
- `resolveStyles` step
- `measureBlocks` step (hidden DOM container)
- `paginate` step

### Phase 5 — Page Renderer
- A4 page component (794×1123px, scaled via `transform: scale()`)
- Block renderers per type (paragraph, headings, list, quote, code, image, divider, callout)
- Progressive render during pagination

### Phase 6 — PDF Export
- Register Inter font with `@react-pdf/renderer`
- Map page data → PDF document (Page, View, Text, Image)
- Download trigger

### Phase 7 — Persistence
- localStorage read/write for all persisted fields
- Restore state on load

---

## v0.2 — Notion API Input

### Phase 1 — Backend
- Init Express server
- `GET /api/notion/page/:pageId` — fetch blocks from Notion API
- `GET /api/image?url=` — proxy image fetch for PDF embedding
- `.env` for Notion token

### Phase 2 — Input Swap
- Replace markdown file input with Notion URL input field
- Extract page ID from full URL (last hyphen-separated segment)
- Swap `parseMarkdown` pipeline step → `fetchNotion`

### Phase 3 — Integration QA
- Test with real Notion pages
- Validate block normalization against Notion API response shape
- Handle Notion-specific edge cases (signed image URLs, unsupported block types)

---

## v0.3 — Line-Level Splitting

- Paragraphs can split across pages at the line level
- Measure line height to determine split point
- Update pagination engine: blocks are no longer fully atomic
- Update page renderer to handle split block fragments
- Update PDF export to handle split blocks

---

## v0.4 — Widow/Orphan Rules

- Detect widows (single line left on a page after a split)
- Detect orphans (single line carried to next page)
- Adjust pagination to pull lines forward or push them back
- Log widow/orphan corrections in pipeline output

---

## v1.0 — Hemingway Figma Plugin

A free Figma plugin. User inputs a public Notion URL, assigns design system styles per block type, and Hemingway generates paginated A4 frames directly in Figma. Re-pagination incorporates user-added elements (spacers, images, footers) placed in Figma.

### Frame dimensions
- 595 × 842px per page (A4 at 72dpi — 1px = 1pt, matches Word/Google Docs point sizes)
- Margins in pt (default: 72pt = 1 inch, matching Word defaults)

### Phase 1 — Cloudflare Worker Proxy
- `POST /notion` — accepts Notion page URL, extracts page ID, calls `notion.so/api/v3/loadPageChunk`
- Normalizes Notion internal block format → clean block JSON (same shape as current pipeline)
- Handles pagination (cursor) for pages with >100 blocks
- Returns `{ blocks: NormalizedBlock[] }`
- Deploy to Cloudflare Workers free tier (100k req/day, no charges on limit)

### Phase 2 — Figma Plugin Scaffold
- TypeScript plugin + React UI (standard Figma plugin setup)
- UI panels: Notion URL input, style assignment, margin controls, Compose / Re-paginate buttons
- Plugin manifest declares network access for Cloudflare Worker domain + notion.so image URLs

### Phase 3 — Style Assignment
- UI lists all block types (h1, h2, h3, paragraph, list, quote, code, callout, divider)
- Per type: select a Figma text style from the file's published styles (dropdown)
- Per type: margin-top / margin-bottom inputs (Figma styles cannot control spacing)
- Settings persisted in `figma.clientStorage`

### Phase 4 — Compose (First Paginate)
- Fetch blocks from Worker
- Measure text heights: create hidden text nodes in Figma, apply assigned style, read `.height`, delete
- Pack blocks into 595×842 frames, respecting margins and block spacing
- Tag every generated node with `node.setPluginData()`: type, blockId, notionText (for diff detection)
- Name nodes with locked convention: `[hw] Page 1`, `[hw] paragraph · blockId`, etc.

### Phase 5 — Re-paginate
- Re-fetch latest Notion blocks
- Scan existing `[hw]` frames for user-added elements:
  - Spacers: any frame tagged `hemingway-spacer` — participates in pagination by its height and list order
  - Images: frames tagged `hemingway-image`
  - Footers: frames tagged `hemingway-footer` — pinned to bottom of each page during re-flow
- Detect text drift: compare Notion text vs stored `notionText` plugin data
  - If drift found: warn user, offer "Overwrite pages" or "Create new pages alongside"
  - Figma text edits are not incorporated into re-flow (source of truth is Notion)
- Re-measure + re-pack blocks + preserved user elements → update frames

### Phase 6 — Plugin Distribution
- Submit to Figma Community (free, public listing)
- Plugin page with setup instructions (make Notion page public before using)