# Hemingway — Product Requirements Document

## Overview

Hemingway is a local-first web application that converts a Notion page into a paginated A4 PDF with real text (not images).

The application:
- Fetches structured content from the Notion API
- Validates content for layout risks
- Applies user-defined typography and spacing
- Measures layout using the browser DOM
- Paginates content into A4 pages
- Renders pages in the UI
- Exports a text-based PDF

The application is designed as a step-by-step pipeline, with each stage visible through logs and UI updates.

---

## Goals

### Primary
- Convert a Notion page into a clean, paginated A4 PDF
- Ensure PDF is text-based, selectable, and searchable
- Provide transparent, step-by-step processing
- Make pagination behavior visible and debuggable

### Secondary
- Allow user control over typography and layout
- Persist session (inputs + outputs) across refresh
- Build a system that is easy to extend (editor, advanced pagination)

---

## Releases

| Version | Scope |
|---------|-------|
| v0.1 | Markdown file input — full pipeline, no backend |
| v0.2 | Notion API input — adds backend, swaps input stage |
| v0.3 | Line-level splitting — paragraphs can split across pages |
| v0.4 | Widow/orphan rules — typographic correction layer |

---

## Non-Goals (v0.1)
- No Notion API integration
- No backend server
- No multi-page Notion databases
- No nested pages
- No collaborative editing
- No authentication system
- No public Notion OAuth integration
- No advanced typography engine (widow/orphan rules → v0.4)
- No line-level splitting (block-level only → v0.3)

---

## Target User
- Developer / technical user
- Wants to export clean PDFs from Notion
- Values transparency and control over layout

---

## System Architecture

### Frontend
- Vite + React
- Handles: UI, pipeline execution, measurement, pagination, PDF generation

### Backend
- Minimal Node/Express server
- Handles: Notion API requests, image proxying (fetch Notion-signed image URLs server-side for PDF embedding)

### Integration
- Notion internal integration
- Pages must be shared with the integration

---

## Core Pipeline

The application runs an explicit pipeline:

```
[
  fetchNotion,
  validateBlocks,
  normalizeBlocks,
  resolveStyles,
  measureBlocks,
  paginate,
  exportPDF
]
```

Each step logs its progress, emits structured output, and updates the UI.

### Style Change Rebuild
- When the user changes style settings, only `resolveStyles → paginate` re-run
- `fetchNotion` and earlier steps are skipped
- This avoids unnecessary network calls

---

## Functional Requirements

### Input

**v0.1:** Input is a static `testfile.md` bundled with the app — no user input required. Used for pipeline development and testing.

**v0.2:** User provides a full Notion page URL (e.g. `https://www.notion.so/workspace/Page-Title-32973ad56c72801a88c5f791b91ebd6e`). The page ID is extracted from the URL automatically (last hyphen-separated segment).

### Settings Panel (Column 1)

**Typography**
- Font size per block type: H1, H2, H3, body, list, quote, code

**Spacing**
- Line height per type
- Space before block
- Space after block

**Layout**
- Top / bottom / left / right margin

### Actions

**Compose** (primary button)
- Triggers the full pipeline: fetch → validate → normalize → resolve → measure → paginate
- If a pipeline is already running, it is immediately cancelled and restarted
- Every restart clears all logs before the new run begins
- Changing the URL or styles does NOT auto-trigger — user must click Compose

**Download PDF**
- Exports the current paginated output as a PDF using `@react-pdf/renderer`

**Reset Styles**
- Resets typography + spacing + margins to defaults
- Does NOT clear content or logs

**Clear Output**
- Clears: logs, validation, blocks, pagination
- Keeps: Notion URL, style settings

### Output Panel (Column 2)
- Displays paginated A4 pages rendered exactly as the layout engine defines
- Pages appear progressively during pagination
- Layout matches exported PDF structure

**Page dimensions:**
- A4: 794 × 1123px (at 96dpi)
- Logical render width: 1600px
- Scaled down via `transform: scale()` to fit viewport
- Column is equal width (1/3 of max-width container)

### Logs Panel (Column 3)
- Displays step-by-step pipeline logs, warnings, and errors
- Structured and chronological
- Cleared on every new Compose run
- Persisted to localStorage between sessions (last completed run)

---

## Validator

Detects layout risks before pagination.

**Behavior**
- Scans blocks sequentially
- Identifies giant blocks
- Identifies blocks with nested content (unsupported nesting)

**Giant block:** measured height > 90% of page content height

**Nesting warning:** any block with nested children (other than list grouping) must:
- Log a warning with ⚠️ emoji
- Skip rendering nested children
- Continue processing remaining blocks

**Output type:**
```ts
type ValidationIssue = {
  blockId: string;
  type: "giant_block" | "unsupported_nesting";
  message: string;
};
```

The validator does NOT block execution — issues are logged and displayed only.

---

## Block Model

Supported block types (v0.1):
- `paragraph`
- `heading_1`, `heading_2`, `heading_3`
- `bulleted_list_item`, `numbered_list_item`
- `to_do`
- `quote`
- `code`
- `image`
- `divider`
- `callout`

All blocks are treated as atomic in v0.1. Nested pages are not supported. Other nesting is warned and skipped.

---

## Layout & Measurement

**Approach**
- Use a hidden DOM container for measurement
- Apply final styles (Inter font, resolved typography settings)
- Measure actual rendered height

**Output per block:**
```ts
{ id, type, height }
```

---

## Pagination Engine

**Page model:**
```ts
type Page = {
  number: number;
  blocks: LayoutBlock[];
  usedHeight: number;
  remainingHeight: number;
};
```

**Core rule:** blocks are atomic — no splitting.

**Placement logic:**
- If block fits → place on current page
- If not → move to next page

**Giant block handling:**
- Images → scale to fit within page content area
- Non-image blocks larger than a page → log warning, place on dedicated page, show overflow marker in UI, may skip in PDF if impossible

---

## Rendering Strategy

The center panel is not a preview — it is the actual page renderer.

- Renders pages based on pagination output
- DOM is used for layout + visualization
- Page data is the source of truth

---

## PDF Export

**Library:** `@react-pdf/renderer`

**Requirements**
- Text-based PDF
- Selectable and searchable text
- No rasterization, no canvas snapshots, no DOM-to-image conversion

**Font:** Inter, loaded via `@react-pdf/renderer` font registration, used across all block types.

**Images:** fetched server-side via backend proxy (to avoid Notion signed URL CORS issues), embedded as binary data in the PDF.

**Approach:** render pages using `@react-pdf/renderer` JSX primitives (`Page`, `View`, `Text`, `Image`), mapping pagination output → PDF document structure.

---

## Typography Defaults

All sizes in px.

| Block Type | Font Size | Line Height |
|------------|-----------|-------------|
| H1         | 128       | 124         |
| H2         | 96        | 96          |
| H3         | 32        | 48          |
| paragraph  | 32        | 48          |
| list       | 32        | 48          |
| quote      | 32        | 48          |
| code       | 28        | 44          |

> H1 line-height (124) is intentionally less than font-size (128) — tight editorial style.

**Spacing defaults (px):**
- Space before block: 16
- Space after block: 8

**Margin defaults (px):**
- Top: 72 / Bottom: 72 / Left: 80 / Right: 80

---

## State Management
- Simple React state
- No global state library

---

## Persistence (localStorage)

**Persisted:**
```ts
{
  notionUrl,
  styleSettings,
  marginSettings,
  validationIssues,
  normalizedBlocks,
  measuredBlocks,
  paginatedPages,
  logs,
  lastRunAt,
  lastExportSummary
}
```

**Not persisted:** transient UI state, DOM references, PDF binary.

Behavior: restore state on page reload, regenerate UI from stored data.

---

## Reset Behavior

**Reset Styles:** resets typography + spacing + margins to defaults. Does NOT clear content or logs.

**Clear Output:** clears logs, validation, blocks, pagination. Keeps Notion URL and style settings.

---

## UI Layout
- Max width: 1920px
- 3 equal columns, each scrolls independently

| Column | Content |
|--------|---------|
| 1 — Controls | URL input, style settings, action buttons |
| 2 — Pages | Rendered A4 pages, step-by-step updates |
| 3 — Logs | Pipeline logs, warnings, errors |

---

## Execution Behavior

- **Compose button** → always runs full pipeline, cancels any in-progress run, clears logs
- **Style changes** → partial rebuild (`resolveStyles → paginate`) with 250ms debounce, only if blocks are already loaded
- No auto-trigger on URL or style changes without clicking Compose

---

## Logging System

```ts
{
  step: string;
  message: string;
  timestamp: number;
  type: "info" | "warning" | "error";
}
```

Logs are cleared on every new Compose run and persisted to localStorage between sessions.

---

## Error Handling
- Errors do NOT crash the app
- Errors are logged
- Pipeline continues when possible

---

## Version Control
- GitHub, `main` as primary branch
- Short-lived feature branches optional
- Commit frequently with clear intent: `feat:`, `fix:`, etc.

---

## Development Setup

**Stack:** Vite + React, Express, Notion API, `@react-pdf/renderer`, Inter font

**Local:** `.env` for Notion token, server runs locally, frontend calls local API.

---

## Future Iterations
- Editor integration
- Public Notion OAuth
- Advanced typography system
- Table support
- Multi-page documents

---

## Success Criteria
- User can paste Notion link and generate PDF
- Pages are correctly paginated (block-level)
- PDF contains selectable text
- UI shows step-by-step processing
- App restores state after refresh
- Logs clearly explain pipeline behavior

---

## Final Note

This PRD is intentionally strict, minimal, pipeline-first, and debuggable.
Optimized for AI-assisted development, fast iteration, and correctness over polish.
