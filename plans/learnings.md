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

## Workflow

- **`/done` skill**: project-level skill at `.claude/commands/done.md`. Steps: (1) update learnings, (2) commit, (3) push. Must be invoked manually at end of each unit of work. Skill files are loaded at session start — newly created skills require a new session to become available
