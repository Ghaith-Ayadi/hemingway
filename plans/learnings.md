# Hemingway — Learnings

Decisions and learnings from each phase that aren't covered by the PRD or roadmap.

---

## Phase 1 — Project Scaffold

- Frontend only for v0.1 — no backend scaffolded, no `/server` directory needed yet
- Root `package.json` exists solely for the `npm run dev` convenience script; all real dependencies live in `/client`

---

## Phase 2 — UI Shell

- Inter loaded via `@fontsource/inter` (npm package), not a CDN. Ensures offline availability and deterministic font loading without network requests
- Dark theme uses CSS custom properties on `:root` — makes future theming a single-file change
- Body text color is `#e8e8e8` (light). Page content areas must explicitly override to `#111` or text will be invisible against the white page background
- The 3-column grid is on `.app`, not `body` — allows centering with `max-width: 1920px; margin: 0 auto`

---

## Phase 3 — Markdown Parser

- `testfile.md` lives in `/client/public/` and is fetched at runtime via `fetch('/testfile.md')` — it is not imported as a JS module. Vite copies `/public` contents as-is to the build output
- `unified` + `remark-parse` produce an MDAST (Markdown Abstract Syntax Tree). The tree is walked once; no intermediate representations
- Rich text is stored as a flat `RichTextRun[]` array: `{ text, bold?, italic?, code? }`. Formatting is never nested — bold+italic is a single run with both flags set
- Callout detection: a `blockquote` whose first character matches `\p{Emoji_Presentation}` is treated as a callout. The emoji is stripped from content and stored as `block.icon`
- List items with nested children (sub-lists, nested paragraphs) are flagged with `hasNested: true` for the validator to catch — the children themselves are not parsed

---

## Phase 4 — Pipeline Engine

- **Pipeline order differs from PRD**: `validateBlocks` runs *after* `measureBlocks`, not before. Giant block detection requires measured heights — it cannot run on raw blocks
- **Cancel token pattern**: a plain `{ cancelled: boolean }` object stored in a `useRef`. On Compose, the current token is marked cancelled and a new one created. All callbacks close over the token and early-return if cancelled, preventing stale state updates
- **Block height = content height + spaceBefore + spaceAfter**: `getBoundingClientRect()` does not include CSS margins. Spacing is added to the measured height manually so the paginator sees the true vertical footprint of each block
- **`onResolvedStyles` callback**: not in the original PRD — added so the renderer always uses the exact same resolved dimensions that the paginator used, rather than recomputing independently
- `document.fonts.ready` is awaited at the start of `measureBlocks` to ensure Inter is fully loaded before any height measurements are taken

---

## Phase 5 — Page Renderer

- **Render width is 1600px, not 794px (A4)**: pages are rendered at a larger logical size for visual quality, then scaled down via `transform: scale(columnWidth / 1600)`. Page height is derived from the A4 aspect ratio: `Math.round(1600 * 1123 / 794)` = 2263px
- **Scale wrapper pattern**: the outer `div` takes up the correctly scaled space in the layout (`height = pageHeight * scale`). The inner `div` renders at the full 1600px and is scaled via `transform`. Without the outer wrapper, the scaled element would still occupy its original unscaled space in the document flow
- **ResizeObserver on the column body**: scale is recomputed whenever the column width changes (e.g. window resize). This keeps the pages correctly fitted without hardcoding a pixel value
- **`resolvedStyles` stored in App state**: set by the pipeline via `onResolvedStyles` callback. This guarantees the renderer uses the exact same dimensions as the paginator — not a recomputation that might drift if settings changed mid-run
- **Page content color**: `color: #111` set on the content area `div` inside `A4Page`. Without this, text inherits the body's `#e8e8e8` and is nearly invisible on the white page

---

## Phase 6 — PDF Export

- **`@react-pdf/renderer` bundle is ~1.8MB unminified**: expected and acceptable. Code-splitting via dynamic `import()` is the mitigation if load time becomes a concern
- **Font files must be served statically and must be `.woff`, not `.woff2`**: react-pdf's font loader does not support `.woff2` — it throws `RangeError: Offset is outside the bounds of the DataView`. Use `.woff` files from `node_modules/@fontsource/inter/files/`, copied to `public/fonts/`. Must be re-copied if the package is reinstalled
- **PDF pixel scaling**: all resolvedStyles values (font sizes, margins, spacing) are in pixels at 1600px render width. PDF is 595.28pt wide (A4). Scale factor = `595.28 / 1600 ≈ 0.372`. Applied via a `px()` helper to every dimension
- **Line height in react-pdf is a ratio, not pixels**: `lineHeight` prop is a multiplier (e.g. `1.5`), not an absolute value. Converted as `lineHeight_px / fontSize_px`
- **Inline rich text uses nested `<Text>` inside a parent `<Text>`**: react-pdf renders nested `<Text>` elements inline. A flat `<View>` with sibling `<Text>` elements would stack them vertically, breaking inline bold/italic
- **Border shorthand not supported in react-pdf**: use `borderTopWidth`, `borderTopColor`, `borderTopStyle` separately — the `borderTop: '1pt solid #ddd'` shorthand silently does nothing
- **`createElement` used instead of JSX in `exportPdf.js`**: the export function is a plain JS file (not `.jsx`). `createElement(HemingwayPdf, props)` avoids needing JSX transform in a non-component file

---

## Phase 7 — Persistence

- **`useLocalStorage` hook**: wraps `useState` — lazy initializer reads from `localStorage` on first render, setter writes on every call. Functional updaters are unwrapped inside the setter before serialisation (otherwise the function itself would be JSON-serialised as `null`)
- **`isRunning` is intentionally NOT persisted**: it must always be `false` on load regardless of what happened before the page was closed
- **`resolvedStyles` must be persisted alongside `paginatedPages`**: restoring pages without resolvedStyles leaves the renderer with no style data — pages won't display and PDF export is blocked until re-compose

---

## v0.3 — Line-Level Splitting

- **`renderBlockToEl` extracted to `renderBlock.js`**: shared by `measureBlocks` and `splitBlock` to guarantee measurement and layout agree on the same DOM structure
- **Binary search on word count**: `splitBlock` measures partial renders in a hidden container at `contentWidth`, binary-searching for the max words that fit in `contentAvailable`. No text-metrics API needed — same DOM renderer used for measurement
- **Character-level formatting preservation**: runs are flattened to per-character entries before splitting into word tokens, so formatting (bold/italic/code) boundaries within words are handled correctly
- **`paginate` is now async**: the split path requires `await splitBlock(...)`. `runPipeline` now `await`s `paginate`
- **Queue pattern replaces for-loop in paginate**: `measuredBlocks` becomes a mutable queue. When a block is split, the bottom fragment is inserted at the current index with `queue.splice(i, 0, bottom)` — it processes next and can be split again if still too tall
- **`isContinuation: true`** on bottom fragments: suppresses `spaceBefore`/`marginTop` in `BlockRenderer` and `HemingwayPdf` so continuation blocks don't get extra top spacing on the new page
- **Restyle button**: runs `resolveStyles → measureBlocks → validateBlocks → paginate` using `cachedBlocks` from the last Compose. Skips fetch + normalize — fast style iteration without a network call. `runPipeline` accepts optional `cachedBlocks` parameter; when set, steps 1–2 are skipped
- **Widow/orphan rule**: after binary search finds `splitAt`, measure the bottom fragment — if ≤ 1 line it's a widow, reduce `splitAt` and retry. If the top fragment becomes ≤ 1 line it's an orphan, cancel the split entirely. The minimum for attempting any split is 2 full line heights in `contentAvailable` (guarantees both fragments can have ≥ 2 lines). Widow/orphan prevention is logged as `info` entries in the paginate step

---

## v0.2 Phase 1 — Backend

- **Express server lives in `/server/`**: ESM (`"type": "module"`), started with `node --watch index.js` so it hot-reloads on file saves without manual restart
- **CORS must allow any localhost port**: Vite may start on 5174 (or higher) if 5173 is occupied. Using a regex `origin: /^http:\/\/localhost(:\d+)?$/` covers all ports instead of hardcoding 5173
- **`@notionhq/client` paginates automatically via cursor**: loop with `has_more` + `next_cursor` until exhausted. A 299-block page takes ~4.6 seconds — this is 3 sequential Notion API calls
- **Real token goes in `server/.env`, never `server/.env.example`**: `.env.example` is committed; `.env` is gitignored. Accidentally putting the token in `.env.example` exposes it on GitHub
- **Notion returns 404 when the page isn't shared with the integration**: the error message says "Make sure the relevant pages and databases are shared with your integration". Must share the page explicitly via Notion's Share menu

## v0.2 Phase 2 — Input Swap

- **`fetchNotion` returns the same normalized block format as `parseMarkdown`**: both are interchangeable as pipeline step 1 — `normalizeBlocks` and everything downstream is unchanged
- **Numbered list index must be tracked manually**: Notion returns `numbered_list_item` blocks individually with no index field. Counter resets to 0 whenever a non-numbered block appears
- **Notion callout icon is an object, not a string**: `{ type: 'emoji', emoji: '💡' }` or `{ type: 'external', ... }`. Extract `.emoji` for emoji icons, treat external icons as null
- **Image URLs must be proxied**: Notion file images are signed S3 URLs — CORS-restricted and expire. Rewrite to `/api/image?url=...` so the browser and react-pdf fetch through the local server
- **`AbortSignal.timeout()` throws a `DOMException` with message "The user aborted a request."**: not "timeout error" as expected. Check `err.name === 'TimeoutError'` to distinguish from a genuine connection failure and show a meaningful message
- **Page URL extraction**: split on `-`, take the last segment, verify length is 32. Works for both `notion.so/Title-{id}` and `notion.so/workspace/Title-{id}` URL formats

---

## Workflow

- **`/done` skill**: project-level skill at `.claude/commands/done.md`. Steps: (1) update learnings, (2) commit, (3) push. Must be invoked manually at end of each unit of work. Skill files are loaded at session start — newly created skills require a new session to become available
