# CV Maker — Product Specification

**Version**: 0.1.0  
**Date**: 2026-05-29  
**Author**: Jordan Rivera  
**Status**: Draft

---

## 1. Overview

CV Maker is an open-source, locally-run resume builder. Users clone the repo, run it on localhost, edit their resume through a split-panel UI, and export a pixel-perfect A4 PDF via Puppeteer. There is no cloud deployment, no backend service, no auth — just a Next.js app that runs on the user's machine.

The target user is anyone who wants full control over their resume's content, typography, and layout without being locked into a SaaS product. The repo is public. Contributions and custom templates are welcome.

---

## 2. Goals

- A user can clone the repo, run `npm install && npm run dev`, and have a working resume editor in under 2 minutes
- A user can customize every aspect of their resume — content, fonts, colors, spacing, layout, sections — without touching code
- A user can export a pixel-perfect A4 PDF that matches what they see in the preview
- The codebase is clean enough that developers can fork it and add their own templates

## 3. Non-Goals

- No cloud hosting or deployment (Puppeteer requires local Chromium)
- No user accounts, saving to a database, or multi-device sync
- No real-time collaboration
- No mobile support (desktop browser only)
- No template marketplace at v0.1

---

## 4. Architecture

### 4.1 Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) | Single repo for frontend + API routes |
| PDF Generation | Puppeteer | Pixel-perfect Chromium-based PDF output |
| State | Zustand | Lightweight, no boilerplate, reactive |
| Sidebar UI | Tailwind CSS | Fast utility styling for editor panels |
| Resume Renderer | Plain CSS + CSS variables | Print-safe, no framework interference |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable | Section reordering in sidebar |

### 4.2 How PDF Export Works

1. User clicks **Download PDF**
2. Client calls `POST /api/export-pdf` with the full resume JSON
3. API route launches Puppeteer, navigates to `http://localhost:3000/preview?data=<encoded>`
4. Puppeteer waits for `networkidle0` (fonts must finish loading)
5. Calls `page.pdf({ format: 'A4', printBackground: true })`
6. Returns PDF buffer — browser downloads as `resume.pdf`

The `/preview` route is a clean, sidebar-free page that renders only the resume. It is the Puppeteer target. It should never be linked to from the main UI.

### 4.3 Why Not Vercel / Cloud

Puppeteer requires a local Chromium binary. Vercel serverless functions cannot install it at runtime, and `chrome-aws-lambda` workarounds are unreliable and hit bundle size limits. Running on localhost is the correct solution for this use case.

---

## 5. Project Structure

```
cv-maker/
├── app/
│   ├── page.tsx                        # Main editor (sidebar + preview)
│   ├── layout.tsx
│   ├── globals.css
│   ├── preview/
│   │   └── page.tsx                    # Puppeteer render target (resume only)
│   └── api/
│       └── export-pdf/
│           └── route.ts                # Puppeteer PDF generation endpoint
│
├── components/
│   ├── sidebar/
│   │   ├── Sidebar.tsx                 # Tab shell: Content / Style / Sections
│   │   ├── ContentPanel.tsx            # Edit all text fields and items
│   │   ├── StylePanel.tsx              # Fonts, color, spacing, layout
│   │   └── SectionPanel.tsx            # Reorder, rename, toggle, add custom
│   │
│   ├── resume/
│   │   ├── ResumePreview.tsx           # Root resume renderer
│   │   ├── resume.css                  # All resume styles + CSS variable declarations
│   │   ├── fonts.css                   # @font-face declarations
│   │   └── sections/
│   │       ├── HeaderSection.tsx
│   │       ├── AboutSection.tsx
│   │       ├── ExperienceSection.tsx
│   │       ├── ProjectsSection.tsx
│   │       ├── EducationSection.tsx
│   │       ├── SkillsSection.tsx
│   │       ├── CertificationsSection.tsx
│   │       ├── LanguagesSection.tsx
│   │       └── CustomSection.tsx
│   │
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Textarea.tsx
│       ├── ColorPicker.tsx
│       ├── Slider.tsx
│       ├── Toggle.tsx
│       └── DraggableList.tsx
│
├── store/
│   ├── resumeStore.ts                  # Zustand store
│   └── defaultData.ts                  # Lorem ipsum starter content
│
├── lib/
│   └── exportPdf.ts                    # Client-side export trigger
│
└── public/
    └── fonts/
        ├── Charter Bd BT Bold.ttf
        ├── Charter BT Roman.ttf
        ├── Charter BT Italic.ttf
        ├── CharisSIL-Italic.ttf
        └── MyriadPro-Regular.otf
```

---

## 6. Data Model

### 6.1 Top-Level Shape

```ts
interface ResumeData {
  meta: ResumeMeta
  sections: Section[]
  styles: ResumeStyles
}
```

### 6.2 Meta

```ts
interface ResumeMeta {
  name: string
  tagline: string        // e.g. "Backend Software Engineer"
  email: string
  phone: string
  location: string
  linkedin: string
  github: string
  website?: string
}
```

### 6.3 Sections

```ts
type SectionType =
  | 'about'
  | 'experience'
  | 'education'
  | 'projects'
  | 'skills'
  | 'certifications'
  | 'languages'
  | 'custom'

interface Section {
  id: string
  type: SectionType
  title: string          // user-renameable, e.g. "Work Experience"
  visible: boolean
  order: number          // determines render order
  items: SectionItem[]
}
```

### 6.4 Section Items

```ts
interface SectionItem {
  id: string

  // experience & projects
  title?: string         // job title or project name
  subtitle?: string      // company name or tech stack string
  dateRange?: string     // e.g. "Feb 2024 – Jan 2026"
  location?: string
  bullets?: string[]

  // education
  degree?: string
  institution?: string
  year?: string
  coursework?: string

  // skills / certifications / languages
  label?: string         // e.g. "English" or "AWS Certified"
  value?: string         // e.g. "Native" or "2023"

  // custom section
  rawText?: string       // free-form text block
}
```

### 6.5 Styles

```ts
interface ResumeStyles {
  fontBody: string        // CSS font-family string
  fontBold: string
  fontItalic: string
  accentColor: string     // hex, used for name, section rules, accents
  fontSize: number        // base body size in px
  lineHeight: number      // e.g. 1.45
  pageMarginX: number     // horizontal margin in mm
  pageMarginY: number     // vertical margin in mm
  sectionSpacing: number  // gap between sections in px
  columnLayout: '1-col' | '2-col'
}
```

### 6.6 Zustand Store

```ts
interface ResumeStore extends ResumeData {
  // meta
  setMeta: (meta: Partial<ResumeMeta>) => void

  // sections
  setSection: (id: string, updates: Partial<Section>) => void
  reorderSections: (orderedIds: string[]) => void
  toggleSection: (id: string) => void
  renameSection: (id: string, title: string) => void
  addSection: (title: string) => void
  deleteSection: (id: string) => void

  // items
  addItem: (sectionId: string) => void
  updateItem: (sectionId: string, itemId: string, updates: Partial<SectionItem>) => void
  deleteItem: (sectionId: string, itemId: string) => void
  reorderItems: (sectionId: string, orderedIds: string[]) => void

  // styles
  setStyle: (updates: Partial<ResumeStyles>) => void

  // export
  isExporting: boolean
  setExporting: (v: boolean) => void
}
```

---

## 7. Default Template (`store/defaultData.ts`)

Users land on a fully rendered CV, not a blank page. All placeholder content uses the name **Alex Morgan**.

### Meta defaults
```
name:     Alex Morgan
tagline:  Full Stack Software Engineer
email:    alex.morgan@email.com
phone:    +1 (555) 000-1234
location: San Francisco, CA
linkedin: linkedin.com/in/alexmorgan
github:   github.com/alexmorgan
```

### Default sections (in order)

| # | Type | Title | Items |
|---|---|---|---|
| 1 | about | About Me | 2–3 sentence lorem ipsum paragraph |
| 2 | experience | Experience | 2 jobs, 3–4 bullets each |
| 3 | projects | Projects | 2 projects with tech stack + bullets |
| 4 | education | Education | 1 university, coursework list |
| 5 | skills | Skills | 4 groups: Languages, Frontend, Backend, DevOps |
| 6 | certifications | Certifications | 2 entries |
| 7 | languages | Languages | English (Native), one other |

### Default styles
```ts
{
  fontBody:        'Charter BT Roman, serif',
  fontBold:        'Charter Bd BT, serif',
  fontItalic:      'Charis SIL, serif',
  accentColor:     '#1a1a1a',
  fontSize:        10,
  lineHeight:      1.45,
  pageMarginX:     18,
  pageMarginY:     18,
  sectionSpacing:  14,
  columnLayout:    '1-col'
}
```

---

## 8. UI Specification

### 8.1 Main Editor Layout (`app/page.tsx`)

```
┌─────────────────────────────────────────────────────────────┐
│  [CV Maker]                          [Download PDF]  [?]    │  ← topbar
├───────────────────┬─────────────────────────────────────────┤
│                   │                                         │
│   SIDEBAR         │         RESUME PREVIEW                  │
│   340px fixed     │         A4 paper, centered              │
│                   │         shadow border                   │
│  [Content]        │         scrollable if overflow          │
│  [Style  ]        │                                         │
│  [Sections]       │                                         │
│                   │                                         │
└───────────────────┴─────────────────────────────────────────┘
```

- Preview updates in real-time (no save button)
- Sidebar is scrollable independently
- Download PDF button shows a spinner while exporting

### 8.2 Content Panel

- **Header block** at top: inputs for all `meta` fields
- **Section accordions** below: one per section, collapsed by default
- Each expanded section shows its items; each item has relevant fields
- Bullet points are individually editable with add/remove controls
- "Add Item" button at the bottom of each section

### 8.3 Style Panel

| Control | Type | Range |
|---|---|---|
| Body font | Dropdown | Available locally-hosted fonts |
| Bold font | Dropdown | Available locally-hosted fonts |
| Italic font | Dropdown | Available locally-hosted fonts |
| Accent color | Color picker | Any hex |
| Font size | Slider | 8 – 14 px |
| Line height | Slider | 1.1 – 2.0 |
| Page margin X | Slider | 10 – 30 mm |
| Page margin Y | Slider | 10 – 30 mm |
| Section spacing | Slider | 8 – 32 px |
| Layout | Toggle | 1-col / 2-col |

### 8.4 Sections Panel

- Draggable list of all sections (drag handle on the left)
- Each row: `⠿ drag` · `Section Title (editable inline)` · `👁 toggle` · `🗑 delete`
- **"+ Add Section"** button opens a small modal: enter section name → creates a `custom` type section
- Sections of built-in types cannot be deleted, only hidden (to prevent data loss accidents)

---

## 9. Resume Renderer

### 9.1 Principles

- Driven entirely by Zustand state — stateless component, no internal state
- No Tailwind inside the resume — only semantic CSS classes and CSS variables
- CSS variables are set as inline styles on the root resume element from the `styles` object
- Sections render in `section.order` ascending order; `visible: false` sections are skipped

### 9.2 Dimensions

- A4: `210mm × 297mm`
- In browser preview: rendered at `794px × 1123px` (96dpi equivalent), centered with a paper shadow
- Puppeteer uses `format: 'A4'` — no mismatch

### 9.3 CSS Variables

Set on `.resume-root`:

```css
--font-body:        Charter BT Roman, serif;
--font-bold:        Charter Bd BT, serif;
--font-italic:      Charis SIL, serif;
--accent:           #1a1a1a;
--font-size:        10px;
--line-height:      1.45;
--margin-x:         18mm;
--margin-y:         18mm;
--section-gap:      14px;
```

### 9.4 Typography Hierarchy

| Element | Font | Size | Style |
|---|---|---|---|
| Full name | Charter Bd BT | ~22px | Bold |
| Tagline | Charter BT Roman | ~11px | Normal |
| Section titles | Charter Bd BT | ~9px | Bold, uppercase, + `<hr>` below |
| Job title / project name | Charter Bd BT | base | Bold |
| Company / tech stack | Charter BT Roman | base | Normal |
| Date ranges / locations | Charis SIL | base | Italic, right-aligned |
| Body text / bullets | Charter BT Roman | base | Normal |
| Contact line | Charter BT Roman | ~9px | Normal, separator `·` |

### 9.5 Section Components

Each section component receives its `Section` object and renders:
1. A section heading (`<h2>`) — bold, uppercase, with a full-width `<hr>` below
2. Its items in the layout appropriate for the section type

**Experience / Projects**: title + date on one line, subtitle + location on next, then bullet list  
**Education**: degree + year, institution + location, optional coursework paragraph  
**Skills**: label groups with comma-separated values  
**Certifications / Languages**: simple label + value pairs  
**About**: single paragraph  
**Custom**: raw text block, rendered as-is with `white-space: pre-wrap`

---

## 10. PDF Export Implementation

### `lib/exportPdf.ts`

```ts
export async function exportPdf(data: ResumeData): Promise<void> {
  const res = await fetch('/api/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  })
  if (!res.ok) throw new Error('PDF export failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'resume.pdf'
  a.click()
  URL.revokeObjectURL(url)
}
```

### `app/api/export-pdf/route.ts`

```ts
import puppeteer from 'puppeteer'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { data } = await req.json()
  const encoded = encodeURIComponent(JSON.stringify(data))

  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto(`http://localhost:3000/preview?data=${encoded}`, {
    waitUntil: 'networkidle0'
  })

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' }
  })

  await browser.close()

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="resume.pdf"'
    }
  })
}
```

### `app/preview/page.tsx`

```ts
import { ResumePreview } from '@/components/resume/ResumePreview'

export default function PreviewPage({
  searchParams
}: {
  searchParams: { data?: string }
}) {
  const data = searchParams.data
    ? JSON.parse(decodeURIComponent(searchParams.data))
    : null

  if (!data) return null

  return <ResumePreview data={data} />
}
```

---

## 11. Font Setup

### Files

Place in `public/fonts/`:

```
Charter Bd BT Bold.ttf
Charter BT Roman.ttf
Charter BT Italic.ttf
CharisSIL-Italic.ttf
MyriadPro-Regular.otf
```

### `components/resume/fonts.css`

```css
@font-face {
  font-family: 'Charter Bd BT';
  src: url('/fonts/Charter Bd BT Bold.ttf') format('truetype');
  font-weight: bold;
  font-style: normal;
}

@font-face {
  font-family: 'Charter BT Roman';
  src: url('/fonts/Charter BT Roman.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: 'Charter BT Italic';
  src: url('/fonts/Charter BT Italic.ttf') format('truetype');
  font-weight: normal;
  font-style: italic;
}

@font-face {
  font-family: 'Charis SIL';
  src: url('/fonts/CharisSIL-Italic.ttf') format('truetype');
  font-weight: normal;
  font-style: italic;
}

@font-face {
  font-family: 'Myriad Pro';
  src: url('/fonts/MyriadPro-Regular.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
}
```

> **Note for users**: Font files are not included in the repo (licensing). Add your own copies to `public/fonts/`. The app falls back to `serif` if fonts are missing.

---

## 12. Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "zustand": "^4.5.0",
    "puppeteer": "^22.0.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^7.0.0",
    "@dnd-kit/utilities": "^3.2.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@types/react": "^18.3.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 13. Error Handling

| Scenario | Behaviour |
|---|---|
| Puppeteer launch fails | API returns 500, client shows toast "PDF export failed. Is the dev server running?" |
| Font files missing | Falls back to `serif`, PDF still generates |
| Section has no items | Section heading still renders, no items below |
| Invalid `?data=` on `/preview` | Page renders nothing (no crash) |
| PDF export in progress | Button disabled + spinner, store `isExporting: true` |

---

## 14. Build Order

Implement in this sequence to always have a working state:

1. Scaffold Next.js 15 project with Tailwind and TypeScript
2. Set up Zustand store with default lorem ipsum data (`defaultData.ts`)
3. Build `ResumePreview` with all section components, CSS variables, and fonts
4. Build `/preview` page (Puppeteer target) — verify it renders correctly in browser
5. Build `/api/export-pdf` route — test PDF output matches preview
6. Build Sidebar shell with 3 tabs (Content / Style / Sections)
7. Build **ContentPanel** — header fields first, then section item editors
8. Build **StylePanel** — all sliders and color picker wired to store
9. Build **SectionsPanel** — drag-to-reorder, visibility toggle, rename, add custom
10. Polish — export loading state, error toasts, empty state handling, README

---

## 15. Future Scope (v0.2+)

- Additional templates (minimal, two-column, academic)
- Import from LinkedIn / JSON resume standard
- Local save/load (export/import JSON)
- Undo/redo
- Section item drag-to-reorder within a section
- Custom color themes / presets