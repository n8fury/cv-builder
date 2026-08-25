# CV Builder — Build Spec

Compiled from planning conversation. This is the brief for implementation
in Claude Code / VS Code. Nothing here should require further design
decisions — where a value was measured from the source PDF, it's marked
exact; where it's a behavioral/architectural decision, it's marked as such.

---

## 1. Purpose

A self-hosted tool to maintain one master library of CV content (every
job, bullet, project, skill you've ever had) and generate tailored,
pixel-perfect PDF CVs per job application — without retyping or
maintaining multiple divergent documents. Supports multiple people
(profiles), managed by a single admin (you) — no self-serve access for
others, no auth needed.

---

## 2. Page setup (exact, from source PDF)

| Property | Value |
|---|---|
| Page size | US Letter — 8.5 × 11in (612 × 792pt) |
| Margins | 55pt, uniform on all four sides |
| Border | None visible — margins are padding only |
| Color | Black (`#000000`) everywhere, no accent color, including links (links are distinguished by underline only) |

---

## 3. Fonts (exact, from embedded font table)

| Role | Font | Size |
|---|---|---|
| Name (header) | CharterBT-Roman | ~25pt (24.9pt exact) |
| Section headings | CharterBT-Bold | 12pt |
| Body text / bullets | CharterBT-Roman | 10pt |
| Job/project titles, competencies | CharterBT-Bold | 10pt |
| Dates | CharterBT-Bold | 10pt |
| Locations, inline emphasis within bullets | **CharterBT-Italic** | 10pt |
| Company name, project subtitle, degree | **Charis SIL Italic** | 10pt |
| Contact info lines | CharterBT-Roman | 10pt |

**Correction (round 4)**: earlier rounds of this spec incorrectly unified
all italics onto Charis SIL. The source uses **two distinct italic
fonts** for different roles — matched exactly rather than simplified,
consistent with this round's fidelity-over-convenience decisions (see
§17). `Charter BT Italic.ttf` is already available; no new font sourcing
needed.

**Note on licensing**: CharterBT (Bitstream Charter) is commercial — verify
the license permits self-hosting as a web font, even for personal/private
use. Charis SIL is free/open (SIL Open Font License) — no concern there.

**Line height**: body text uses a 1.2 ratio (10pt font → 12pt line height),
confirmed exact from the source.

---

## 4. Spacing system (measured from the canonical detailed PDF)

All values below are **baseline-to-baseline, in points**, extracted from
`data/reference/resume-reference-detailed.pdf` via pdfjs. Baselines
are unambiguous; where these disagree with §11.3's box-edge assumption,
these win. The second (basic) PDF is a corroborating source, not an equal
one: its per-section space-befores drift from these by up to 4pt, and its
Certifications gap carries a stray blank 13pt line where a Technical
Skills group was emptied. Where the two disagree, the detailed PDF wins;
`harness/golden-basic.json` records the basic PDF's coordinates so the
comparison is reproducible (`npm run extract:golden:basic`).

### 4.1 Page and header
| Relationship | Value |
|---|---|
| Content box | x 55 → 557 (55pt L/R margins); top margin edge y=737 |
| Top margin → first heading baseline (page 2) | 11.77 — equals the 12pt heading's ascent, i.e. its box top lands exactly on the 55pt margin |
| Name baseline | y=716.37, 24.9pt, centered — its box top overshoots the top margin by ~3.4pt |
| Name → contact line 1 | 23.45 (minimal header) / 23.58 (full header) |
| Contact line 1 → contact line 2 | 17.07 (full header only) |

### 4.2 Per-section space-before (previous section's last baseline → this heading's baseline)
Per §16.1, encoded per section type — **not** averaged into one constant.

| Section | Value |
|---|---|
| About Me | derived per header mode — see below |
| Core Competencies | 25.03 |
| Experience | 27.44 |
| Education | 26.97 |
| Technical Skills | 27.24 |
| Certifications | 27.14 |
| Projects | not measurable in either source — bounded at 27.2, see below |

**About Me.** Measured from the **name baseline**, not from the last
contact line: the header occupies a fixed slot and its contact lines fill
it rather than pushing About Me down. Name → About Me heading is 60.97 in
the detailed PDF (716.37 → 655.40) and 60.74 in the basic (715.63 →
654.89) — one measurement, agreeing to 0.23pt across a one-line and a
two-line header. The space-before follows from it by subtracting the
contact lines the mode draws (§5.1):

| Header mode | Space-before | Check |
|---|---|---|
| minimal (one contact line) | 60.97 − 23.45 = **37.52** | exactly the detailed PDF's 692.92 → 655.40 |
| full (two contact lines) | 60.97 − 23.58 − 17.07 = **20.32** | basic PDF reads 20.09 |

A single figure here would be right for one mode and ~17pt wrong for the
other, so this gap is the one §4.2 entry that is derived rather than
tabulated.

**Projects.** Neither source measures it. In the detailed PDF the
Projects heading opens page 2, so it is placed by §4.1's continuation-page
geometry and has no preceding baseline. The basic PDF does place it
mid-page, at 34.72 — but that document is 4pt off the detailed on Core
Competencies, a gap both measure, so it cannot settle one only it
measures; and 34.72 is 7.5pt clear of every gap the detailed PDF does
give, well outside §11.2's ±2pt. **27.2 stands, now as a bound rather
than an interpolation**: Projects always follows a bullet list, and the
two detailed-PDF gaps that also follow a bullet list are Education's
26.97 and Technical Skills' 27.24. 27.2 is within 0.24 of both, so
whatever the detailed PDF would have shown is inside tolerance of it.

### 4.3 Per-section heading → first content baseline
Also varies by section type; the old single "6.3pt underline → content"
figure cannot reproduce any of these.

| Section | Value |
|---|---|
| About Me | 17.28 |
| Core Competencies | 20.10 |
| Experience | 18.17 |
| Projects | 15.28 |
| Education | 18.17 |
| Technical Skills | 16.93 |
| Certifications | 16.92 |

### 4.4 Within and between entries
| Relationship | Value |
|---|---|
| Entry title → company (Experience/Education) or subtitle (Projects) | 12.00 |
| Company → first bullet (Experience, Education) | 19.29 |
| Subtitle → first bullet (Projects) | 22.19 |
| Entry → next entry (Experience) | 28.17 |
| Entry → next entry (Projects) | 25.41 |

### 4.5 Line and bullet metrics
| Property | Value |
|---|---|
| Body / bullet leading | 12.00 (10pt × 1.2) |
| Technical Skills, Certifications, Languages leading | **13.00** — §3's "1.2 everywhere" is wrong for these three |
| Bullet marker x | +11.18 from the 55pt margin (body text itself sits at +1.18 side bearing, so +10.0 relative to body) |
| Wrapped bullet lines | **+20.0 hanging indent** relative to body text x — omitted from every earlier draft, and essential |
| Bullet → next bullet | **no extra gap** — bullets are consecutive 12pt lines (432.09 → 420.09 → 408.09) |
| Section heading underline rule | 0.4pt, full content width |

**Superseded values.** These earlier figures do not reproduce the source
and must not be implemented: top-margin→name 18.58, name→contact 15.7,
underline→content 6.3, section-to-section 16.3, bullet-to-bullet 21.1,
and "1.2 line height everywhere". Two earlier figures *do* hold up as
box-edge readings and are consistent with the baselines above:
contact-line gap 7.0 (= 17.07 − 10) and entry-to-entry 18.4 (≈ 28.17 − 10).

**Entry header layout** (job title/company vs. dates/location): flex,
`justify-content: space-between` — title/company block left-aligned to
the left margin, dates/location block right-aligned to the right margin.
**Correction**: the right-hand block does *not* sit on a matching
baseline — it is consistently **2.31pt higher** than the left block
(463.38 vs 465.69; 451.38 vs 453.69), in both source documents. Since
that exceeds §11.2's ±2pt tolerance, it must be implemented, not ignored.
Applies to Experience, Projects, and Education entries alike.

---

## 5. Sections

Fixed section **types** (not all required per variant — see Curation
Model). Order is **not** fixed — drag-to-reorder per variant.

### 5.1 Header
Two supported display variants, each optionally carrying a title line
under the name (§16.6):
- **Full**: Name / *[Title]* / Location | Email | Phone / LinkedIn | GitHub | …links
- **Minimal**: Name / *[Title]* / Email | LinkedIn | GitHub | …links (no location/phone)

Fields: `name, title, location, email, phone, linkedin, github, links[]`

`links[]` is `{ id, text, url }` — extra contact lines past LinkedIn and
GitHub (portfolio, X, Dev.to), printed on the same line, in library order.
`url` is optional and is what the printed `text` links to (§18.1); the
named contact fields derive theirs instead of storing one.
`title` is content; whether it prints is the variant option
`options.showTitle`, alongside `mode`. See §16.6.

### 5.2 About Me
Single paragraph text block. Stored as an array of versions
(`aboutMe: [{ id, key, text }]`), referenced per variant by
`options: { aboutMeId }` — not a bare keyed map, so it stays consistent
with every other library item having a real ID (see §15.2).

### 5.3 Core Competencies
Flat list of short phrases, rendered pipe-separated (`Full Stack
Development (MERN) | RESTful API Design | ...`).
**Curation**: individually toggleable per variant, same pattern as
bullets (see §12.3).

### 5.4 Experience
Per entry: `title, company, location, dates, bullets[]`
Bullets are individually toggleable per variant. Bullet text supports
lightweight inline markup — `*text*` renders as CharterBT-Italic within
an otherwise-regular bullet (e.g. proper nouns like "BrightPath" set
in italic mid-sentence, matching the source) — see §16.3.

### 5.5 Projects
Per entry: `title, subtitle (type/technologies), dates, bullets[], repoUrl, demoUrl`
- `repoUrl` and `demoUrl` are both optional; **always rendered if present**
  (no separate visibility toggle needed — presence = shown).

### 5.6 Education
Per entry: `institution, degree/major, dates, description`
Field order (fixed, matches the canonical source): **institution bold on
top, degree in Charis SIL Italic below** — not a per-variant option.
**Curation**: entry-level only — there's no bullet array, so Education
entries are included/excluded as a whole, never trimmed line-by-line.
`description` renders as **a single bullet** (`• Coursework: …`), not a
plain paragraph — corrected in §16.4; the earlier §15.7 claim was wrong,
written from a brainstorming assumption rather than the actual source.

### 5.7 Technical Skills
Grouped: each group has a label (e.g. "Backend") and a list of skills.
Rendered as `**Group:** skill, skill, skill`.
**Curation**: two-level — both groups and individual skills within a
group are separately toggleable per variant (see §12.3).

### 5.8 Certifications
Per entry: `text, dates, credentialUrl` — `text` is one combined string
(`Career Development Program | Northwind Training Center`), rendered entirely in
CharterBT-Bold with `dates` right-aligned on the same line at 13pt leading.
**Correction**: earlier drafts specified separate `title, issuer` fields;
both source PDFs and the seeded library use one combined string, and the
issuer is not styled differently from the title.
- `credentialUrl` optional, **always rendered if present**.

### 5.9 Recommendations
Two display modes, toggle per variant:
- **Collapsed**: one line — "References available upon request"
- **Expanded**: full list, per entry:
  - Name (bold)
  - Role | Institution (combined, one line)
  - Location
  - Email: (prefixed label)

  No separate description/testimonial field.

  **Curation**: in expanded mode, individual recommendation entries are
  curated per variant, same ID-list pattern as experience bullets (see §15.5).

### 5.10 Languages
Per entry: `{ id, language, proficiency }` — two fields, not one combined
string, because the source renders them in **different faces**:
`Spanish:` in CharterBT-Bold followed by `Native (Mother Tongue)` in
CharterBT-Roman, one line per language at 13pt leading (§4.5). A single
combined string cannot produce that.
**Curation**: whole-section `visible` toggle only, not
individually curated per item — resolved from an earlier ambiguity, see §15.6.

### 5.11 Custom Section
Freeform title + **both** an optional paragraph and an optional bullet
list (either or both can be filled per instance). Use for anything
job-specific that doesn't fit the fixed schema (e.g. Publications for one
application only). Multiple instances per variant are supported — each
instance is its own library item, reusable across variants (see §12.4).

---

## 6. Data model / Curation model

### 6.1 Content library (per profile)
One `content-library.json` per profile. Holds **everything** — every
bullet, entry, section-level item — each with a stable unique ID and
optional tags (e.g. `backend`, `iot`, `ml`) for future filtering/AI
drafting use.

### 6.2 Variant (one specific CV version)
A variant references library IDs only — it never contains raw duplicated
text. It defines:
- **Section list**: which section types are included, in what order
  (drag-and-drop per variant), each visible/hidden, plus a per-section
  `options` object for settings that aren't selections (header
  variant, aboutMeKey, recommendations mode — see §12.2)
- **Entry list per section**: which entries (jobs, projects, etc.) are
  included, in what order
- **Bullet list per entry**: which bullets are included, in what order
- **Variant-level metadata**: `tag, label, createdAt, updatedAt` (see §12.5)

Three levels of curation, same pattern throughout: an item is either
referenced in the variant's list, or it isn't. No separate "visible" flag
needed below the section level — omission from the list means hidden.

### 6.3 New content flow
Any bullet/entry typed directly in the editor — for any job, at any
level — is **always** saved to the content library first (with a
generated ID), then automatically referenced in the currently open
variant. There is no "one-off, not saved to library" path — everything
compounds into the library over time.

### 6.4 Links (repoUrl, demoUrl, credentialUrl)
Stored on the library item. **Always rendered if present** — no per-variant
visibility toggle for links specifically (simpler than the section/entry/
bullet toggle system, since hiding a link is rarely needed).

---

## 7. Editor UI

- **Editor state management**: Zustand for the editor's client-side
  state (form fields, live-preview data before save) — lightweight, no
  boilerplate, avoids prop-drilling through the two-column layout.
- **Drag-to-reorder**: `@dnd-kit/core` + `@dnd-kit/sortable` for section
  reordering (§7) and entry/bullet reordering within a section.
- **Editor chrome styling**: Tailwind CSS is fine for the *editor UI
  itself* (sidebar, buttons, panels) — but never for the resume template
  component, which must stay plain CSS/CSS-variables per §8's rendering
  principles, since it's shared verbatim with the PDF export path.
- **Two-column layout**: form editor (left) / live rendered preview
  (right)
- **Live preview** renders via the *same* HTML/CSS template component
  used for final export — not a separate preview renderer. Updates on
  every form change. No Chromium/Puppeteer call while editing (fast,
  free).
- **PDF export** is a deliberate action (explicit button) — calls
  Puppeteer once, on demand, not continuously.
- **Save** overwrites the currently open variant.
- **Save As** forks a new variant, auto-named `{tag}_{date}` (e.g.
  `google-swe_2026-08-22`), editable.
- **Section reordering**: drag handles per section in the left panel;
  reordering updates the variant's section-order array directly.
- Dashboard (home page) lists all profiles and their saved variants, with
  View / Download PDF / "Generate tailored draft via AI" actions.
  Search/filter by tag is a good-to-have for later, once the variant
  count grows past a handful — not required for initial build.
- **Library manager view (v1)**: a separate screen from the variant
  editor — browse every item in a profile's content library (all
  bullets, entries, competencies, skills, custom sections), edit any
  item's text directly (propagates per §11.4/§12.4), tag items, and
  delete orphaned items no longer referenced by any variant. Needed
  precisely because propagate-on-edit with no delete path would
  otherwise let the library accumulate unreachable cruft with no way to
  see or clean it up.

---

## 8. PDF generation

- **Engine**: Puppeteer + headless Chromium. Chosen over lighter HTML→PDF
  libraries (wkhtmltopdf/WeasyPrint) because their CSS support is weaker
  and pixel-fidelity to the reference design is the top priority. Chosen
  over PDF-primitive libraries (react-pdf/PDFKit) because it lets the
  live preview and the final PDF share literally the same HTML/CSS
  template — no second layout system to keep in sync.
- **Where it runs**: in-process with the main app (not a separate
  microservice/queue) — appropriate given low personal-use volume.
- **Concurrency**: launch a Chromium instance per request, close after —
  no queue needed at this scale.
- **Caching**: none — always regenerate fresh on every download request.
  Staleness bugs aren't worth optimizing away a few seconds of wait time.
- **Font loading**: fonts self-hosted as `.woff2`, loaded via
  `@font-face` with `font-display: block`. Puppeteer must wait on
  `document.fonts.ready` before calling `page.pdf()` — the most common
  cause of silent font-fallback bugs.
- **Margins**: set `@page { margin: 0 }` in CSS; apply all real margins
  as `padding` on the page wrapper element, not via Puppeteer's own PDF
  margin option — this avoids unpredictable interaction with
  `preferCSSPageSize`.

---

## 9. Multi-profile support

Filesystem-per-profile structure:
```
data/profiles/<profileId>/content-library.json
data/profiles/<profileId>/theme.json       (font/size/spacing overrides, if a profile ever needs to diverge)
data/profiles/<profileId>/variants/<variantId>.json
```
No authentication — single admin (you) manages all profiles, but profile
creation itself is a **UI action for v1** ("New Profile" form: name +
profileId slug, scaffolds the folder structure and an empty
content-library.json), not manual folder creation. Not intended to be
public-facing; if ever exposed past localhost, put it behind basic auth
or a VPN rather than building real accounts.

---

## 10. n8n integration (AI-assisted drafting, optional layer)

Complements the manual editor rather than replacing it:

1. Webhook trigger receives `{ profileId, variantId, targetRole, jobDescription, notifyEmail }`
2. Fetches the profile's `content-library.json`
3. LLM node drafts a variant (selects/reorders existing library IDs to
   match the job description) — **system prompt must forbid inventing
   experience, metrics, or skills not already in the library**; it may
   only select, reorder, and lightly rephrase
4. Saves the drafted variant, renders a PDF via the app's render
   endpoint, emails it back for review
5. You open the draft in the visual editor to fine-tune (toggle
   bullets/entries/sections) before final save — the AI draft is a
   starting point, not the final output

---

## 11. Implementation-review resolutions

Raised during Claude Code's review of this spec; resolved here so no
open questions remain.

### 11.1 Render architecture (confirmed, no change from §7)
Puppeteer must navigate to `/render/[profileId]/[variantId]` (server
component reading the variant + library off disk) — **not** a
query-string-encoded JSON payload. A full variant exceeds practical URL
length and breaks the "variant = list of library references" model
entirely. This is the same component the live editor preview uses.

### 11.2 Pixel-fidelity verification harness (required, build early)
Before building out the rest of the editor, build a diff harness that
proves the render pipeline is actually pixel-accurate rather than
"looks right":

- Keep the source reference PDF (the Letter-size black-text version —
  **not** the blue screenshot — `resume-reference-detailed.pdf`,
  provided directly as of §15.1, no longer a guess) in the repo,
  **gitignored**.
- Extract text-item positions from both the source PDF and a
  freshly-generated PDF (via `pdfjs` or `pdfplumber`) and diff them.
- **Tolerance: ±2pt per element.** Tighter than this isn't meaningful
  given Chromium's rasterizer won't sub-pixel-match Illustrator's; looser
  risks missing real spacing bugs.
- Run this once early, before building the full editor UI, to de-risk
  the font/spacing/CSS approach before more is built on top of it.

**What the harness asserts — and what it deliberately does not.**
Settled in Phase 3 once every measurement was reconciled and only line
breaking remained.

The harness gates **geometry**: every golden line must have a generated
line within ±2pt in both x and baseline y, on the same page. It does
**not** gate where a justified line breaks. The source is composed by
Illustrator, whose Paragraph Composer optimises breaks across a whole
paragraph and compresses word spaces to fit — measured at up to 5.89pt
on one line, roughly 80% of normal word spacing. CSS justification only
ever stretches, and Chromium breaks greedily; `text-wrap: pretty` and
`stable` change nothing, and a uniform negative `word-spacing` is a
fitted constant, not a measured one (it reached 70/84 exact lines and
never 84). No CSS expresses per-line compression, so gating on the break
point would gate on something the renderer cannot do.

25 of 84 lines therefore carry a different share of the same words. They
are reported as `REFLOW` and are not fatal. `--strict-wrap` makes them
fatal again, for anyone attacking the composition problem itself.

**Font identity is asserted, not inferred.** Position cannot tell Charter
from a fallback serif at the same size: with `charis-italic.woff2`
deleted, the five affected lines drifted only 0.87–1.40pt in y and under
1.8pt in x — inside ±2pt, and so a clean pass on geometry alone. The
harness therefore compares each line's face and size against the golden,
and additionally requires every face to carry identical copy
document-wide, which catches a substitution part-way along a line that a
leading-item check would miss.

For that check to mean anything, `fonts.css` declares the faces under
private family names (`CV Charter`, `CV Charis`) rather than their real
ones. Charter BT and Charis SIL are normally installed system-wide — they
must be, to build the woff2 files — and under their real names a failed
`@font-face` silently resolves to the machine's own copy, leaving output
byte-identical and the failure invisible. Under a name no system font can
claim, only the self-hosted files can satisfy the stack. The embedded
faces keep their internal names (`CharterBT-Roman` and friends), which is
what the golden is keyed on, so the renaming is invisible to the diff.

This is only safe because of a second, stronger assertion the harness
gained at the same time: **the two documents' copy must be identical
character-for-character**, whitespace and line-break hyphens normalised
away (the source hyphenates `Agile Development` as `Agile -` /
`Development`). A line may hold a different share of the text; no word
may appear, vanish, or change. Line counts must match too — 84 golden
lines, 84 generated. Together these are a tighter guarantee than the
original text-keyed diff gave, which let a reflowed line disappear into
`MISSING`/`EXTRA` and never checked the document's copy at all.

### 11.3 Spacing measurement model (default assumption, verify via 11.2)
All spacing values in §4 were read off Illustrator's gap/measure
indicator, which measures **bounding-box edge to bounding-box edge**,
not baseline-to-baseline. Implement on that assumption first. If the
harness in 11.2 shows systematic offset, adjust the CSS margin model
(the fix is mechanical — swap box-gap margins for baseline-corrected
ones — not a re-measurement of the source values).

### 11.4 Bullet/entry editing model (confirmed, no change from §6.3)
Editing an existing library item's text **propagates to every variant
referencing it** (single source of truth) — plus an explicit **"Fork
this bullet"** action for the rare case of wanting job-specific wording
without affecting other variants. Already-exported PDFs remain frozen
regardless of later library edits, since export is a snapshot.

### 11.5 Overflow / page count (confirmed)
- CVs **may span multiple pages** — no one-page restriction, no export
  block on overflow.
- The editor preview shows page-boundary guides and a live indicator
  when content crosses a page boundary (informational, not blocking).
- Each entry (Experience/Project/Education item) uses `break-inside:
  avoid` in the PDF/print CSS so a single entry's title and bullets don't
  get split awkwardly across a page break. **Amended by §18.2**: that rule
  forbids every split, where this sentence asks only to prevent the
  awkward ones. Experience and Projects can opt in to a split governed by
  rules about *where*; the default stays exactly as written here.

---

## 12. Second implementation-review resolutions

Raised during Claude Code's schema review, before writing any
code/schema files. Resolved here — this section is the authoritative
schema reference; §5/§6 are updated with pointers into it but keep this
section for the actual shapes.

### 12.1 Canonical spec file
This file must be named `SPEC.md` (matching what this document has
called itself since §12.1 was first written) and live at `docs/SPEC.md`,
alongside `docs/plan.md` — an amendment to this section's original "repo
root" placement, decided when the plan was written. If the repo has it
as lowercase `spec.md`, rename it (`git mv --force spec.md docs/SPEC.md`
if on a case-insensitive filesystem) rather than editing this document
to match the wrong casing. Any other `spec.md` in the repo (e.g. an
earlier A4/style-panel/no-persistence draft) must be **deleted**, not
archived — confirmed done as of this round.

### 12.2 Per-section `options` object
Every entry in a variant's section list gets an `options` object for
settings that are configuration, not selection-from-a-list. **Ordering
is array position only** — no separate `order` field, to avoid two
sources of truth that could desync the first time a drag-reorder writes
one and not the other (see §15.3). Note also `mode` (not `variant` —
"variant" already means a CV version everywhere else in this spec, see
§15.4) and `aboutMeId` (not `aboutMeKey`, see §15.2):
```
[
  { type: "header",          visible: true, options: { mode: "full" } },
  { type: "aboutMe",         visible: true, options: { aboutMeId: "about-default" } },
  ...
  { type: "recommendations", visible: true, options: { mode: "collapsed" } }
]
```
Sections with nothing to configure just carry `options: {}`.

### 12.3 Flat-list curation — resolved per section
- **Core Competencies**: curated. Each phrase is a library item with an
  ID; the variant references a list of competency IDs, same pattern as
  bullets.
- **Technical Skills**: curated at **two levels**. Each group has an ID;
  each skill within a group also has its own ID. Library shape:
  ```
  "skillGroups": [
    { "id": "skills-backend", "label": "Backend", "skills": [
        { "id": "skill-nodejs", "text": "Node.js" },
        { "id": "skill-express", "text": "Express.js" }
    ]}
  ]
  ```
  The variant references which group IDs are included, and within each,
  which skill IDs — mirroring how experience entries reference bullet
  IDs. This supersedes the flat `{ "Backend": ["Node.js", ...] }` shape
  used in the earlier scaffold.
- **Languages**: **not** individually curated. Whole-section `visible`
  flag only — no `options` involved for this section, no per-language ID
  list needed in the variant, even though library items may still carry
  IDs for editing purposes in the library manager (§7).

### 12.4 Custom sections live in the library
Consistent with §6.3 ("everything typed goes to the library"), a custom
section instance is itself a library item (own ID, holding its title +
optional paragraph + optional bullets), not something stored only inside
one variant. Multiple custom-section instances per variant are just
multiple section-list entries of the same `type`, distinguished by which
library item they point to (array position determines order, per §12.2):
```
[
  { type: "custom", visible: true, options: { customSectionId: "cs-open-source" } },
  { type: "custom", visible: true, options: { customSectionId: "cs-publications" } }
]
```

### 12.5 Variant metadata
Each variant file carries:
```
{
  "schemaVersion": 1,
  "tag": "google-swe",
  "label": "Google — Backend SWE",
  "createdAt": "2026-08-22T10:00:00Z",
  "updatedAt": "2026-08-22T14:30:00Z",
  ...section list, entry/bullet references, etc.
}
```
`variantId` (the filename/slug, e.g. `google-swe_2026-08-22`) doubles as
the record's `id` — no separate id field needed. `tag` is typed at
**Save As** time, pre-filled with the parent variant's tag as a starting
suggestion, always editable. `content-library.json` carries the same
`schemaVersion: 1` field — see §15.13.

### 12.6 Seed data (in the repo as of round 5)
All seed assets now exist on disk — no longer pending, no longer
"attached to a message":
```
data/reference/resume-reference-detailed.pdf       canonical fidelity target (gitignored)
data/reference/resume-reference-basic.pdf        secondary, visual sanity check only (gitignored)
data/profiles/jordan-rivera/content-library.json        seeded, schema-current
data/profiles/jordan-rivera/variants/detailed.json      seed variant reproducing the canonical PDF
```

**Round-5 library corrections** (applied, all verified against the
canonical PDF):
- Added the missing `Testing & Practices` skill group (Unit Testing,
  Agile/Scrum, Technical Documentation, Performance Optimization) — 7
  groups / 37 skills now, matching the source.
- Restored four Freelance bullets that had been silently truncated
  during transcription (`serving regional student market`,
  `for research methodology content`, `(Multi-industry supply chain
  solutions company)`, `for product catalog management`).
- Applied `*inline italic*` markup (§16.3) to `*BrightPath*` and
  `*Atlas Traders*`, which the source sets in CharterBT-Italic mid-bullet.
- Converted `languages` to `{ id, language, proficiency }` per §5.10.
- Normalized all date separators to hyphens per §15.9.

**Seed variant** `detailed.json`: minimal header, section order About Me
→ Core Competencies → Experience → Projects → Education → Technical
Skills → Certifications; 9 competencies, 2 experience entries / 10
bullets, 2 projects / 6 bullets, 1 education entry, 7 skill groups / 37
skills, 4 certifications. Languages and Recommendations are omitted —
neither appears in the canonical PDF.

`recommendations: []` and the `repoUrl`/`demoUrl`/`credentialUrl` fields
remain `null`/empty — real reference contacts and repo links weren't part
of the source and shouldn't be fabricated; fill them in via the library
manager (§12.7) or by hand. The `.ai` source file was never provided; the
PDF alone is sufficient for §11.2's harness.

### 12.7 Editor scope for v1
- **Library manager**: in scope for v1 (see §7's new bullet) — browse,
  edit, tag, and delete content-library items independent of any single
  variant.
- **Profile creation**: a UI action for v1 (see §9) — a "New Profile"
  form, not manual folder creation.

---

## 13. Error handling

| Scenario | Behavior |
|---|---|
| Puppeteer launch/render fails | API returns 500; UI shows an error toast, not a silent failure |
| Font file missing/fails to load | **Split by path.** Live-editor preview: falls back to `serif`, non-blocking — it's a working-draft view, not a final artifact. **PDF export path**: must call `document.fonts.check()` for each required Charter/Charis face before `page.pdf()`, and **hard-fail with an error** if any check fails, rather than emit a mis-rendered PDF in the wrong typeface. A plausible-looking wrong-font PDF is worse than an explicit error — you might not notice until after sending it. This corrects an earlier draft of this table that allowed silent fallback on both paths. |
| Section has no visible entries | Section heading still renders if `visible: true`; empty body, no crash |
| Invalid/missing `profileId` or `variantId` on `/render` | 404, not a blank page — a silent blank render is hard to debug from the dashboard |
| PDF export in progress | Download button disabled + spinner during the request |

## 14. Suggested build order

Sequenced so there's always a working state to check against, and so
§11.2's fidelity harness can run as early as possible:

1. Scaffold Next.js app + data layer (content-library/variant read
   functions per §6)
2. Build the `/render/[profileId]/[variantId]` route with real seeded
   data (§12.6) and the full CSS/font system (§2–§4)
3. Run the §11.2 fidelity harness against the source PDF — fix
   font/spacing issues before building anything else on top
4. Build `/api/generate-pdf` (Puppeteer) — confirm PDF output matches
   the now-verified render route
5. Build the dashboard (profile/variant list, view/download actions)
6. Build the variant editor (two-column, curation toggles, drag-reorder)
7. Build the library manager (§12.7)
8. Wire up n8n integration (§10)
9. Polish — error states (§13), loading states, README

---

## 15. Third implementation-review resolutions (final round)

### 15.1 File placement (unblocks §14 steps 2–3)
Resolved — see corrected §12.6. Real source PDF and a schema-corrected
`content-library.json` provided directly with this round; drop both
into the paths specified there. `SPEC.md` casing note also in §12.1.

### 15.2 `aboutMe` follows the ID-everywhere pattern
Changed from a keyed map to `aboutMe: [{ id, key, text }]`, referenced
via `options: { aboutMeId }` — consistent with every other library item
being individually addressable for the library manager (§12.7) to
tag/edit/delete uniformly. Reflected in §5.2, §12.2, and the delivered
`content-library.json`.

### 15.3 Ordering: array position only
Dropped the redundant `order` field from the section-list schema —
array position is the sole source of truth, avoiding a desync bug where
a drag-reorder writes one but not the other. Reflected in §12.2 and §12.4.

### 15.4 `mode`, not `variant`, for header display option
`options: { variant: "full" } }` renamed to `options: { mode: "full" }`
— "variant" is reserved for "a CV version" everywhere else in this
spec; reusing it for the header's full/minimal setting was overloaded
and confusing. Now matches Recommendations' existing `mode` field.
Reflected in §12.2.

### 15.5 Recommendations curation
In expanded mode, individual recommendation entries are curated per
variant — same ID-list pattern as experience bullets, not all-or-nothing.
Reflected in §5.9.

### 15.6 Languages curation — picked `visible`
Resolved the "options vs. visible" ambiguity from the previous round in
favor of the simpler option: whole-section `visible` flag, no `options`
object involved for this section at all. Reflected in §5.10 and §12.3.

### 15.7 Education curation scope
Stated explicitly: Education entries have no bullet array, so curation
is entry-level only (include/exclude the whole entry, never partial).
`description` renders as a single paragraph, not a bullet. Reflected in §5.6.

### 15.8 `theme.json` — reserved, not implemented in v1
Global font/color/spacing values (§2–§4) apply to all profiles for now.
`theme.json` stays a placeholder path in §9's directory structure but
has no defined schema and no code reads it in v1 — build it only if/when
a specific profile (e.g. a friend with different typographic
preferences) actually needs to diverge from the global values.

### 15.9 Literal render details (extracted from the source PDF directly)
No need to wait on this — pulled from the same PDF analysis that
produced §2–§4:
- Section headings: Title Case (e.g. "About Me", "Core Competencies"),
  not uppercase
- Bullet glyph: `•`
- Date range separator: **hyphen with a space on each side** — `February
  2024 - Present`. The sources use an en dash for five of six ranges (and
  a hyphen for Education's `2018 - 2022`); normalized to hyphens
  throughout by decision in round 5, and applied to the seeded library. A
  hyphen is ~1.7pt narrower than an en dash and date blocks are
  right-aligned, so the shift stays inside §11.2's ±2pt tolerance. No em
  dash appears in any date; the three em dashes in the library are inside
  bullet prose and are left as-is.
- Contact-line separator: pipe with a space on each side — `Northside,
  Springfield, SP-1010 | jordan.rivera@example.com | +1-555-0142`
- Name: center-aligned (the only center-aligned element on the page —
  everything else is left/right per §4's flex layout rule)

### 15.10 Explicit page size in the Puppeteer call
§8 only specified `@page { margin: 0 }`. Add explicit size alongside
`preferCSSPageSize: true`:
```
page.pdf({
  format: 'Letter',
  preferCSSPageSize: true,
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }
})
```
Both the CSS `@page { size: 8.5in 11in }` and the Puppeteer `format`
option should agree — belt and suspenders, since relying on just one
risks a silent mismatch if either is edited later without the other.

### 15.11 Orphaned headings
§11.5 covered `break-inside: avoid` on entries but not headings. Add
`break-after: avoid` on every section heading element, so a heading
can't be stranded alone at the bottom of a page with its content pushed
to the next one.

### 15.12 Dashboard: add Delete and Rename
§7's dashboard listed View / Download / Generate-via-AI only. Add
**Delete** and **Rename** for both variants and profiles — omitting
these was an oversight, not a deliberate v1 exclusion; a tool meant for
ongoing curation needs basic cleanup actions from day one.

### 15.13 `schemaVersion` on both file types
Add `schemaVersion: 1` to both `content-library.json` and every variant
file. Cheap now, and the only realistic path to migrating data safely
later if the schema changes after real variants exist on disk.
Reflected in §12.5 and the delivered `content-library.json`.

### 15.14 Font-fallback policy (resolves the disagreement)
Agreed with the concern — resolved in §13's error-handling table:
silent `serif` fallback is fine for the live-editor preview (a working
view, not a final artifact) but the PDF export path must verify fonts
via `document.fonts.check()` and hard-fail rather than silently emit a
wrong-typeface PDF.

---

## 16. Fourth implementation-review resolutions

Raised after both source PDFs (detailed and basic) were compared
directly in the repo. All decisions below prioritize matching the
canonical source exactly over simplifying the implementation — consistent
with fidelity being the top priority stated from the start of this
project.

### 16.1 Fidelity target and section-spacing model
**Detailed PDF is the sole fidelity target** — already true throughout
this spec (it's what seeded `content-library.json`), now explicit. The
basic PDF is a loose visual sanity check only, never a harness input.

The earlier single "16.3pt section-to-section gap" (§4) is **wrong** and
superseded. Real gaps vary by section: 25.03pt before Core Competencies,
27.14pt before Certifications, measured in the detailed PDF specifically.
**Do not average or unify these into one constant** — a shared value
would fail §11.2's ±2pt harness against sections not yet sampled, and
fidelity has been the explicit priority since the start of this project.

Model as a **per-section-type "space-before" value** — each section type
carries its own fixed top-offset, independent of whichever section
precedes it. This is simpler than a full pairwise (predecessor ×
successor) lookup table and matches how spacing is typically hand-tuned
in a design tool. Extract the actual space-before value for **every**
section type from the detailed PDF (not just the two sampled above) and
encode each individually. If the harness later shows a section's gap
actually depends on what precedes it too, escalate to a pairwise table
then — don't build that complexity preemptively.

### 16.2 Education field order
Fixed to the detailed PDF's order: **institution (bold) on top, degree
(Charis SIL Italic) below**. Not a per-variant `options` setting — this
is a canonical-source formatting choice, not a genuine display-mode
choice like header full/minimal. See §5.6.

### 16.3 Inline italics within bullets
Bullet text is still a plain string, but supports lightweight markup:
`*text*` parses to a `CharterBT-Italic` inline span at render time (e.g.
`Delivered production website for *BrightPath*...`). Chosen over a
segment-array data model because it's far less painful to edit in a
plain textarea in the editor UI, and the use case is rare (proper nouns
mid-sentence) — not worth restructuring every bullet's schema for. See §5.4.

**Escaping**: a literal asterisk is written `\*` and renders as `*`.
Unpaired asterisks render literally rather than erroring, so a stray one
can never silently swallow the rest of a bullet.

### 16.4 Education description rendering
**Source wins over an earlier spec assumption.** §15.7 stated
`description` renders as a paragraph — that was wrong, written from an
early brainstorming guess ("some description") rather than the actual
PDF. Both source documents render it as a single bullet
(`• Coursework: …`). Corrected in §5.6; curation remains entry-level
(still one field, not an array — only the rendering glyph changes).

### 16.5 Fourth font: CharterBT-Italic vs. Charis SIL Italic
The source uses two distinct italic fonts for different roles, not one
unified italic as earlier rounds assumed:
- **CharterBT-Italic**: locations, and inline emphasis within bullets (§16.3)
- **Charis SIL Italic**: company name, project subtitle, degree

Matched exactly rather than simplified — `Charter BT Italic.ttf` is
already available locally, so this costs nothing extra to implement
correctly. Corrected in §3.

### 16.6 Header title line, extra links, and an editable header
Three gaps, one block. Resolved together because they share geometry.

**The title.** A line under the name — "Aspiring Backend Engineer",
"Software Engineer" — set at body size (10pt) in **CharterBT-Italic**,
per §16.5's split (Charis stays on company names, subtitles, degrees).
Neither source PDF contains one, so it is given no geometry of its own:
it takes the first contact line's place in the rhythm
(§4.1's name → contact gap) and steps the contact lines down by one
17.07 each. Reusing measured numbers rather than inventing a third set.

**Where it fits.** §4.2 fixes the header slot at 60.97 from the name
baseline to the About Me heading, with the contact lines filling it
rather than pushing About Me down. A title consumes one more 17.07 of
that slot:

| Slot | Lines below name | About Me space-before |
|---|---|---|
| minimal | 23.45 | **37.52** (unchanged, §4.2) |
| full | 23.45 + 17.07 | **20.32** (unchanged, §4.2) |
| minimal-title | 23.45 + 17.07 | **20.45** — fits; nothing below the header moves |
| full-title | 23.58 + 17.07 + 17.07 | 3.25 → **20.32**, floored |

A minimal header pays for the title out of dead space — ~22pt of blank
paper sits under its single contact line, and the rendered page is
unchanged below the header, so §11.2's harness against `golden.json` is
unaffected. A full header cannot: 3.25 is less than the 12pt heading's
11.77 ascent, so About Me would print through the last contact line.
That one slot therefore grows the header instead of filling the fixed
one, floored at 20.32 — the tightest gap either source document sets.
`full-title` is the only layout here with no source measurement behind
it, and the only one that moves the page.

**Split of content vs. option.** The title's text lives in the library
(`header.title`), edited once per profile; whether a given CV prints it
is `options.showTitle` on the header section — the same split §5.1
already makes for full/minimal. `showTitle` defaults to `false` so every
variant already on disk parses and renders exactly as before. A variant
asking for a title the library has not been given renders no line rather
than an empty one, for §5.1's reason: a blank line still occupies 12pt.

**Extra links.** `header.links[]` is `{ id, text }`, printed on the same
line as LinkedIn and GitHub, in library order. `text` is display text
("x.com/jordan-rivera-demo"), not a URL — matching `linkedin`/`github`, which are
already display strings, and unlike §6.4's nullable `z.url()` fields.
A line of its own would cost 17.07 the slot has not got. `linkedin` and
`github` stay named fields rather than folding into the array: §5.1 lists
them by name and §4.1's measured lines place them, so collapsing them
would rewrite every profile on disk to buy uniformity the render layer
does not want. Links carry IDs only so a form can address one row — no
variant references them, so they are not library items and never appear
in orphan detection (§7).

**Editing the header.** Until now nothing could change `name`, `email`,
`phone` or the socials except hand-editing `content-library.json`. The
library manager reaches items by ID through a collection (§12.7), and the
header is a single record with neither, so `mapLibraryItems` never visits
it and Fork and Delete are meaningless on it. It gets its own edit module
and its own form above the browser, outside the tag filter — the header
carries no tags, and filtering must never hide the one block every
variant renders. The field list is held against `headerSchema` by a test,
the same guard §12.7's `ITEM_FIELDS` carries: a header field no screen
can reach would be stored, printed on every CV, and uneditable.

---

## 17. Explicitly out of scope (for now)

- DOCX/plain-text export (PDF only)
- Self-serve access for other profile owners (admin-managed only)
- Authentication/accounts
- Version search/filtering (flat list is fine until it isn't)
- Caching of generated PDFs
---

## 18. Post-release resolutions

Raised after the §14 build order finished and the app was in daily use.
Each entry names a place the spec's own wording did not say what it
meant. None of them changes a measured value from §2–§4; where one
touches the page at all, it says so explicitly and says why the §11.2
harness still holds.

### 18.1 Header contact details carry hrefs
§16.6 settled what the header contact line *prints* and never said what
it links to, so it linked to nothing: `email`, `phone`, `linkedin` and
`github` render as plain text, and `links[]` is `{ id, text }` with
nowhere to put a URL. In an exported PDF every one of them is dead — the
one place a reader would click. §6.4 already had the answer for
repo/demo/credential links, and the header simply never adopted it.

**Printed text is unchanged.** This is a rendering addition, not a
content change: the same characters print, in the same order, at the same
positions. §4.1's measured contact lines are untouched, and §11.2's
harness compares the same text against the same golden.

**Named fields derive their href; no schema change.** They are already
display strings (§16.6), and a display string of this kind determines its
target:

| Field | Href |
|---|---|
| `email` | `mailto:` + the text |
| `phone` | `tel:` + the text, punctuation and spaces stripped |
| `linkedin` / `github` | the text as a URL when it already reads as one (`github.com/jordan-rivera-demo` → `https://github.com/jordan-rivera-demo`), otherwise the site's profile prefix + a bare handle (`jordan-rivera-demo` → `https://github.com/jordan-rivera-demo`) |
| `location` | none — it is not a link |

A field whose text cannot yield a target renders exactly as it does
today, as text. Deriving rather than storing keeps §16.6's rule that
these are display strings, and keeps every profile on disk valid
unchanged.

**`links[]` gains an explicit optional url.** `headerLinkSchema` becomes
`{ id, text, url }`, with `url` the same nullable `z.url()` §6.4 uses.
Unlike the named fields there is no site to derive from — a portfolio or
a Dev.to page is not recoverable from its display text — so it needs a
real field. `url: null` renders as text, which is what every link
already on disk becomes, so no profile needs rewriting.

**No underline.** §6.4's `.resume-link` underlines because a printed CV
has no hover state and the underline is the only affordance. The header
does not follow it: the contact line is measured against the source PDF,
which has no underline anywhere in it, and adding one would be a visible
change against the document §11.2 gates on. The href is live; the ink is
identical. Where the two rules disagree, the source wins (§16).

### 18.2 A long entry may split, on request

§11.5 asks for `break-inside: avoid` "so a single entry's title and
bullets don't get split **awkwardly**". The rule delivered is stronger
than the sentence: it forbids *all* splits, awkward or not. An entry is
one `<article>` holding its head and every bullet, so a 7-bullet entry
needing 160pt with 140pt left on the page moves all 160pt to the next one
and the 140pt becomes blank paper. With a section heading attached
(§15.11's `break-after: avoid`) both migrate and the hole grows. On a
two-page CV that hole is most of what separates a tight document from a
loose one.

**The atom is demoted, not removed.** "Do not split awkwardly" is a rule
about *where* a split falls, so the fix is to say where:

| Rule | What it prevents |
|---|---|
| the head is unbreakable, and glued to what follows | a head stranded as the last thing on a page |
| each bullet keeps `orphans: 2` / `widows: 2` | a single line of a bullet left behind or carried over |

**A bullet is prose, not an atom.** This is the correction that matters,
and it was reached the hard way. The first version of this section made
each bullet unbreakable and glued the second-to-last to the last, so that
no final bullet could travel alone. Both rules backfired on the first
real entry they met — four bullets, the last of them nine lines long:
the entry could not put its final bullet on the next page by itself, so
it sent the third bullet along too, and left roughly 130pt of blank paper
behind. Refusing to strand a nine-line "widow" is not typography; it is
the same hole this section exists to close, arrived at by a different
route.

So a long bullet breaks like any other paragraph, between its own lines
and never within one, and stranding is handled the way prose handles it.
`orphans`/`widows` **do** work for this: they govern line boxes inside a
single block, and a bullet is a single block. They do *not* work across
sibling `<li>` elements, which is why the head's rule above is
`break-after: avoid` and not a `widows` count — that distinction is the
whole reason the two halves are written differently.

**What this costs the preview.** Three things, all settled in measurement
rather than by teaching `pagination.ts` new rules:

- `break-after: avoid` glues an element to whatever immediately follows
  it *in the flow*, which is very often prose rather than the next block.
  `chainTop` reads a run of glued blocks as one chain, so reporting a
  heading as glued when its body is a paragraph builds a single chain
  from a document's first heading to its last, and the first overrun
  anywhere pushes everything onto page two. Latent before this section —
  entries carried no glue, so every chain was terminated by one — and
  immediate once entry heads became glued blocks with only prose between
  them. `FlowBlock.keepWithNext` therefore means *glued to the next
  block*, which the preview decides by asking whether that block sits
  inside the element's own next sibling.

- `paginate` consults `keepWithNext` only when a following *block*
  overruns, and what follows a head here is prose, contributing no block
  at all — so the head would model as sitting contentedly at the foot of
  a page the printer never produces. The preview reads a split head's box
  as reaching down over the two lines its `orphans` oblige it to keep,
  capped at the first bullet's own bottom, which turns the case into an
  ordinary overrun.
- A prose break has always been reported at the page's full height, off
  by up to one line's leading. That was invisible while the only prose
  was a paragraph or two; with bullets as prose it shows as a line sliced
  in half by the page window — the top of the glyphs on one sheet, the
  bottom on the next. So the preview now measures each split bullet's
  line boxes and hands `paginate` the offsets that bullet may legally
  break at, `orphans` and `widows` already applied. A boundary landing
  inside a bullet moves to the last legal offset at or above it, or to
  the bullet's top when it has none — a bullet of fewer than four lines
  cannot leave two and carry two, and the printer moves it whole.

Neither adds a glue direction, and neither fires for a document with the
flag off: `paginate` without prose runs behaves exactly as it did.

**Opt-in, per section, defaulting off.** Experience and Projects take
`options.splitEntries` (default `false`), which emits `data-split="true"`
on the section and scopes every rule above to it. Two reasons, and the
second is the binding one:
- It is an editorial decision. A split entry reads differently, and which
  page a job's bullets finish on is a judgement call about the document,
  not something that should happen to a CV silently.
- **The harness stays 84/84 by construction.** In `harness/golden.json`
  page one ends on the last Experience bullet and page two opens with the
  `Projects` heading. That boundary looks safe and is not: today the
  heading plus the first project form one glued chain too tall for page
  one's remainder, so it is pushed whole. Relax the entry atom and that
  chain shrinks to `heading + head + two lines`, which may now fit — and
  pulls content up across the boundary the golden was measured at. The
  goldens carry no flag, so with the default off nothing about them can
  move, and no re-baselining question arises.

**The preview moves with it.** `page-blocks.ts` names the same selectors
the stylesheet marks, and `page-blocks.test.ts` holds the two against
each other, so a rule changed in one and not the other fails a test
rather than silently desyncing the on-screen sheets from the printer.
