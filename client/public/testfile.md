Here’s a clean, structured PRD you can use directly with Claude or as your build blueprint.

---

# **📄 Product Requirements Document (PRD)**

## **Product Name**

**Hemingway**

---

# **1. Overview**

Hemingway is a local-first web application that converts a **Notion page** into a **paginated A4 PDF with real text (not images)**.

The application:

- fetches structured content from the Notion API
- validates content for layout risks
- applies user-defined typography and spacing
- measures layout using the browser DOM
- paginates content into A4 pages
- renders pages in the UI
- exports a **text-based PDF**

The application is designed as a **step-by-step pipeline**, with each stage visible through logs and UI updates.

---

# **2. Goals**

## **Primary Goals**

- Convert a Notion page into a clean, paginated A4 PDF
- Ensure PDF is **text-based, selectable, and searchable**
- Provide transparent, step-by-step processing
- Make pagination behavior visible and debuggable

## **Secondary Goals**

- Allow user control over typography and layout
- Persist session (inputs + outputs) across refresh
- Build a system that is easy to extend (editor, advanced pagination)

---

# **3. Non-Goals (v0.1)**

- No multi-page Notion databases
- No nested pages
- No collaborative editing
- No authentication system
- No public Notion OAuth integration
- No advanced typography engine (widow/orphan rules deferred)
- No line-level splitting (block-level only)

---

# **4. Target User**

- Developer / technical user
- Wants to export clean PDFs from Notion
- Values transparency and control over layout

---

# **5. System Architecture**

## **Frontend**

- Vite + React
- Handles:
  - UI
  - pipeline execution
  - measurement
  - pagination
  - PDF generation

## **Backend**

- Minimal Node/Express server
- Handles:
  - Notion API requests only

## **Integration**

- Notion **internal integration**
- Pages must be shared with the integration

---

# **6. Core Pipeline**

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

Each step:

- logs its progress
- emits structured output
- updates UI

---

# **7. Functional Requirements**

## **7.1 Input**

User provides:

- Notion page URL

---

## **7.2 Settings Panel (Column 1)**

User can control:

### **Typography**

- H1 font size
- H2 font size
- H3 font size
- Body font size
- List font size
- Quote font size
- Code font size

### **Spacing**

- Line height per type
- Space before block
- Space after block

### **Layout**

- Top margin
- Bottom margin
- Left margin
- Right margin

---

## **7.3 Actions**

- **Import / Build** (fetch + run pipeline)
- **Download PDF**
- **Reset Styles**
- **Clear Output**

---

## **7.4 Output (Column 2)**

Displays:

- paginated A4 pages
- rendered exactly as layout engine defines

Behavior:

- pages appear progressively during pagination
- layout matches exported PDF structure

---

## **7.5 Logs Panel (Column 3)**

Displays:

- step-by-step pipeline logs
- warnings (validator, pagination issues)
- errors

Logs are:

- structured
- chronological
- persistent (saved in localStorage)

---

# **8. Validator**

## **Purpose**

Detect layout risks before pagination.

## **Behavior**

- scans blocks sequentially
- identifies **giant blocks**

## **Giant Block Definition**

A block is considered giant if:

- its measured height > 90% of page content height

## **Output**

```
type ValidationIssue = {
  blockId: string;
  type: "giant_block";
  message: string;
};
```

## **Behavior Rules**

- validator does NOT block execution
- issues are logged and displayed

---

# **9. Block Model**

Supported block types (v0.1):

- paragraph
- heading_1
- heading_2
- heading_3
- bulleted_list_item
- numbered_list_item
- to_do
- quote
- code
- image
- divider
- callout

All blocks are treated as **atomic in v0.1**

---

# **10. Layout & Measurement**

## **Approach**

- use hidden DOM container for measurement
- apply final styles
- measure actual rendered height

## **Output**

Each block gets:

```
{
  id,
  type,
  height,
}
```

---

# **11. Pagination Engine**

## **Page Model**

```
type Page = {
  number: number;
  blocks: LayoutBlock[];
  usedHeight: number;
  remainingHeight: number;
};
```

---

## **Pagination Rules (v0.1)**

### **Core Rule**

- blocks are atomic
- no splitting

### **Placement Logic**

For each block:

- if fits → place on current page
- if not → move to next page

---

## **Special Cases**

### **Giant Blocks**

### **Images**

- scale to fit within page content area

### **Non-image blocks**

- if larger than page:
  - log warning
  - place on dedicated page
  - allow overflow marker in UI
  - may skip in PDF if impossible

---

# **12. Rendering Strategy**

## **Important Principle**

The center panel is **not a preview**

It is the **actual page renderer**

- renders pages based on pagination output
- DOM is used for layout + visualization
- page data is the source of truth

---

# **13. PDF Export**

## **Requirements**

- text-based PDF
- selectable text
- searchable content
- no rasterization

## **Approach**

- use pdf-lib
- render pages using page data
- draw text and layout explicitly

## **Important Constraint**

Do NOT:

- convert DOM to image
- use canvas snapshots

---

# **14. State Management**

## **Approach**

- simple React state
- no global state library

---

# **15. Persistence (localStorage)**

## **Persisted Data**

```
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

## **Behavior**

- restore state on page reload
- regenerate UI from stored data

## **Do NOT persist**

- transient UI state
- DOM references
- PDF binary

---

# **16. Reset Behavior**

## **Reset Styles**

- resets typography + spacing + margins
- does NOT clear content or logs

## **Clear Output**

- clears:
  - logs
  - validation
  - blocks
  - pagination
- keeps:
  - notion URL
  - style settings

---

# **17. UI Layout**

## **Layout**

- max width: 1920px
- 3 columns

### **Column 1 — Controls**

- inputs
- settings
- actions

### **Column 2 — Pages**

- rendered pages
- step-by-step updates

### **Column 3 — Logs**

- pipeline logs
- warnings
- errors

Each column scrolls independently.

---

# **18. Execution Behavior**

## **Pipeline Trigger**

- Notion import → manual button
- Style changes → debounced rebuild (~250ms)

---

## **Step-by-Step Execution**

Each step:

- runs sequentially
- logs output
- updates UI

During pagination:

- pages appear incrementally

---

# **19. Logging System**

Each log entry:

```
{
  step: string;
  message: string;
  timestamp: number;
  type: "info" | "warning" | "error";
}
```

---

# **20. Error Handling**

- errors do NOT crash app
- errors are logged
- pipeline continues when possible

---

# **21. Development Setup**

## **Stack**

- Vite
- React
- Express
- Notion API
- pdf-lib

## **Local Development**

- .env for Notion token
- server runs locally
- frontend calls local API

---

# **22. Open Questions (Future Iterations)**

- line-level splitting (paragraphs)
- widow/orphan rules
- editor integration
- public Notion OAuth
- advanced typography system
- table support
- multi-page documents

---

# **23. Success Criteria**

- User can paste Notion link and generate PDF
- Pages are correctly paginated (block-level)
- PDF contains selectable text
- UI shows step-by-step processing
- App restores state after refresh
- Logs clearly explain pipeline behavior

---

# **Final note**

This PRD is intentionally:

- **strict**
- **minimal**
- **pipeline-first**
- **debuggable**

It is optimized for:

- AI-assisted development
- fast iteration
- correctness over polish

---

If you want next:

👉 I can convert this into **Claude-ready prompt chunks** so you can start coding immediately without architectural drift.
