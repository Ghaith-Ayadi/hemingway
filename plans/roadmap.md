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