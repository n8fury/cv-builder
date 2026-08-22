# CV Builder — Implementation Plan

Derived from `SPEC.md` (§14's build order, expanded). `SPEC.md` remains the
source of truth for values; this file is the source of truth for sequencing
and completion state.

**Conventions**
- Every task carries a **Verification:** line — a command, file, or observable
  outcome. A task is `[x]` only when its verification actually passes.
- Spec section references (`§4.2`) point into `SPEC.md`.
- Where `SPEC.md` contradicts itself, later rounds win. Two known cases,
  resolved here once:
  - **Spacing model**: §4 (baseline-to-baseline, measured) supersedes §11.3
    (box-edge assumption). Implement baselines.
  - **Education `description`**: §16.4 (renders as a single bullet)
    supersedes §15.7 (paragraph).

---

## Phase 0 — Repo scaffold and data layer

- [x] Task 0.1: Rename `spec.md` → `docs/SPEC.md` per §12.1
  - Verification: `git mv --force spec.md docs/SPEC.md` completed;
    `git ls-files` lists `docs/SPEC.md` and no lowercase `spec.md` is tracked.
  - Note: §12.1 originally placed the file at repo root; amended there and
    here to `docs/SPEC.md`, beside this plan.

- [x] Task 0.2: Initialize Next.js (App Router) + TypeScript project at repo root
  - Verification: `package.json`, `tsconfig.json`, `next.config.ts`, and
    `app/layout.tsx` exist; `npm run dev` serves `http://localhost:3000` with a
    200 response; `npx tsc --noEmit` passes.

- [x] Task 0.3: Configure Tailwind for editor chrome only, scoped away from the
      resume template
  - Verification: `app/globals.css` registers `app` and `components/editor` as
    sources and leaves `components/resume` unregistered; a Tailwind class used
    inside a `components/resume/**` file produces no generated CSS (§7) —
    `npm run check:tailwind-scope` exits 0.
  - Note: Tailwind v4 replaced `tailwind.config.ts` content globs with
    `@import "tailwindcss" source(none)` plus `@source` directives in CSS;
    the verification above is the v4 equivalent of the original.

- [x] Task 0.4: Extend `.gitignore` for build output and generated fonts
  - Verification: `.gitignore` contains `node_modules/`, `.next/`,
    `public/fonts/`, `out/`, and retains `data/reference/`; `git status --short`
    is clean after `npm install`.

- [x] Task 0.5: Write Zod schemas for the content library (§6.1, §12.3, §12.4, §15.2)
  - Verification: `lib/schema/library.ts` exports `contentLibrarySchema`;
    `npx tsx scripts/validate-data.ts` parses
    `data/profiles/jordan-rivera/content-library.json` without error and reports
    `schemaVersion: 1`.

- [ ] Task 0.6: Write Zod schemas for variants (§6.2, §12.2, §12.5)
  - Verification: `lib/schema/variant.ts` exports `variantSchema`; the same
    `validate-data.ts` run parses
    `data/profiles/jordan-rivera/variants/detailed.json` clean, including the
    per-section `options` shapes.

- [ ] Task 0.7: Build the filesystem data layer — read/list/write profiles,
      libraries, variants (§9)
  - Verification: `lib/data/store.ts` exports `listProfiles`, `readLibrary`,
    `listVariants`, `readVariant`, `writeVariant`, `deleteVariant`; a vitest
    suite (`npm test`) round-trips a temp profile through write→read and asserts
    writes are atomic (temp file plus rename).

- [ ] Task 0.8: Build the variant→library resolver producing a flat render model
  - Verification: `lib/data/resolve.ts` exports `resolveVariant(library, variant)`;
    a vitest case resolving `detailed.json` yields 9 competencies, 2 experience
    entries / 10 bullets, 2 projects / 6 bullets, 1 education entry, 7 skill
    groups / 37 skills, 4 certifications (§12.6), and throws a named error on a
    dangling ID reference.

- [ ] Task 0.9: Implement the `*inline italic*` markup parser with `\*` escaping (§16.3)
  - Verification: `lib/render/markup.ts` exports `parseInlineMarkup`; vitest
    covers paired asterisks → italic span, escaped asterisk → literal `*`, and an
    unpaired asterisk rendering literally without throwing.

---

## Phase 1 — Font pipeline and CSS metric system

- [ ] Task 1.1: Write `scripts/build-fonts.mjs` converting local TTFs → woff2
  - Verification: `node scripts/build-fonts.mjs` produces
    `public/fonts/charter-roman.woff2`, `charter-bold.woff2`,
    `charter-italic.woff2`, and `charis-italic.woff2` from the four faces in the
    user font directory; each output is non-empty, and the script exits non-zero
    with a clear message if a source TTF is missing.

- [ ] Task 1.2: Document the font prerequisite and license note in `README.md` (§3)
  - Verification: `README.md` lists the four required font files, the
    build-fonts step, and the Charter BT commercial-license caveat;
    `public/fonts/` is confirmed gitignored.

- [ ] Task 1.3: Declare `@font-face` rules with `font-display: block` (§8)
  - Verification: `components/resume/fonts.css` declares all four faces; loading
    a `/render/...` page shows all four in DevTools → Network with status 200 and
    no fallback substitution.

- [ ] Task 1.4: Encode every §4 measurement as named constants in one metrics module
  - Verification: `lib/render/metrics.ts` exports page setup (612×792, 55pt
    margins), per-section `spaceBefore` (§4.2) and `headingToContent` (§4.3) maps
    keyed by section type, entry/bullet metrics (§4.4), leading values including
    the 13pt exception for Technical Skills / Certifications / Languages (§4.5),
    the 20pt hanging indent, the 11.18pt bullet-marker offset, and the 2.31pt
    right-block baseline lift. Every number appears exactly once in the codebase:
    `grep -rn "27.44" --include=*.ts --include=*.css` matches only this file.

- [ ] Task 1.5: Implement `baselineGap()` — convert a target baseline delta into a
      CSS margin using font ascent
  - Verification: `lib/render/metrics.ts` exports
    `baselineGap(targetPt, fontSizePt, lineHeightPt)`; vitest asserts a 12.00pt
    entry-title→company target at 10pt/12pt leading yields a 0pt margin, and the
    27.44pt Experience space-before yields the expected positive margin.

- [ ] Task 1.6: Emit the metrics module as CSS custom properties for the template
      stylesheet
  - Verification: `components/resume/resume.css` consumes
    `var(--space-before-experience)` and siblings; the `:root` block is generated
    from `metrics.ts` rather than hand-copied, and a mismatch between the two
    fails `npm test`.

---

## Phase 2 — The `/render` route (§11.1)

- [ ] Task 2.1: Create the server route `/render/[profileId]/[variantId]` reading
      library and variant off disk
  - Verification: requesting `/render/jordan-rivera/detailed` returns HTTP 200; an
    unknown profile or variant returns 404, not a blank page (§13).

- [ ] Task 2.2: Build the page shell — Letter size, 55pt padding, `@page` size and
      zero margin (§2, §8)
  - Verification: the page wrapper measures 612×792pt with 55pt padding on all
    four sides; the content box spans x 55 → 557 (§4.1).

- [ ] Task 2.3: Render the Header section, full and minimal modes (§5.1, §15.9)
  - Verification: `/render/jordan-rivera/detailed` shows the centered 24.9pt name
    with a single pipe-separated contact line (minimal mode); a scratch variant
    set to `mode: "full"` produces two contact lines 17.07pt apart.

- [ ] Task 2.4: Render section headings — Title Case, 12pt bold, 0.4pt full-width
      rule, `break-after: avoid` (§4.5, §15.9, §15.11)
  - Verification: all seven headings render Title Case with a rule spanning
    x 55 → 557; computed style shows `break-after: avoid`.

- [ ] Task 2.5: Render About Me and Core Competencies (§5.2, §5.3)
  - Verification: About Me renders one paragraph at 10pt/12pt; competencies
    render as a single pipe-separated run beginning
    `Full Stack Development (MERN) | RESTful API Design`.

- [ ] Task 2.6: Render Experience entries — flex header, 2.31pt right-block lift,
      hanging-indent bullets (§4.4, §5.4)
  - Verification: title/company left-aligned and dates/location right-aligned to
    x 557; the right block's baseline sits 2.31pt above the left; wrapped bullet
    lines indent +20.0pt; consecutive bullets sit exactly 12pt apart with no
    extra gap.

- [ ] Task 2.7: Render Projects entries including `repoUrl` / `demoUrl` when
      present (§5.5, §6.4)
  - Verification: both seed projects render a Charis SIL Italic subtitle 12.00pt
    below the title and 22.19pt from subtitle to first bullet; adding a `repoUrl`
    to a library item makes an underlined black link appear with no toggle.

- [ ] Task 2.8: Render Education — institution bold on top, degree in Charis SIL
      Italic, description as a single bullet (§5.6, §16.2, §16.4)
  - Verification: the education entry renders `• Coursework: …` as a bullet, not
    a paragraph, with institution above degree.

- [ ] Task 2.9: Render Technical Skills, Certifications, and Languages at 13pt
      leading (§4.5, §5.7, §5.8, §5.10)
  - Verification: all seven skill groups render as `Group: skill, skill` with the
    label bold; certifications render fully bold with right-aligned dates;
    measured line-to-line spacing in all three sections is 13.00pt, not 12.00pt.

- [ ] Task 2.10: Render Recommendations (collapsed and expanded) and Custom
      Sections (§5.9, §5.11, §12.4)
  - Verification: a scratch variant with `mode: "collapsed"` renders the single
    "References available upon request" line; `mode: "expanded"` renders per-entry
    name/role/location/email; two `type: "custom"` section entries render as two
    distinct sections in array order.

- [ ] Task 2.11: Apply `break-inside: avoid` per entry and page-boundary guides in
      preview mode (§11.5)
  - Verification: computed style on every entry wrapper shows
    `break-inside: avoid`; the preview shows page-boundary guides and the PDF
    output does not.

- [ ] Task 2.12: Handle a visible section with no resolved items (§13)
  - Verification: a scratch variant with `competencies` visible but an empty
    `items` array renders the heading with an empty body and returns 200 — no
    crash.

---

## Phase 3 — Pixel-fidelity harness (§11.2) — gates all later phases

- [ ] Task 3.1: Extract text-item positions from the source PDF into a committed
      golden file
  - Verification: `node scripts/extract-golden.mjs` reads
    `data/reference/resume-reference-detailed.pdf` via `pdfjs-dist` and
    writes `harness/golden.json` with per-item
    `{ page, text, x, baselineY, fontName, fontSize }`; the file is committed
    (coordinates only, not the PDF) and the harness runs without the gitignored
    PDF present.

- [ ] Task 3.2: Build the diff harness comparing a generated PDF against the
      golden file at ±2pt
  - Verification: `npm run harness` prints a per-element pass/fail table and
    exits non-zero when any element exceeds ±2pt in x or baseline y.

- [ ] Task 3.3: Reconcile measured drift — fix `metrics.ts`, never the golden file
  - Verification: `npm run harness` exits 0 for every element of `detailed.json`;
    any value changed in `metrics.ts` carries a comment recording its measured
    justification.

- [ ] Task 3.4: Measure and encode the two §4 gaps the spec left unresolved
  - Verification: About Me's space-before (absent from §4.2) and Projects'
    space-before (§4.2's interpolated 27.2) are read from `harness/golden.json`,
    written into `metrics.ts`, and `SPEC.md` §4.2 is updated with the measured
    values; the harness still exits 0.

- [ ] Task 3.5: Assert font identity, not just position
  - Verification: the harness compares each item's `fontName` against golden and
    fails on any Charter/Charis face substitution — confirmed by temporarily
    removing one woff2 and observing a non-zero exit.

---

## Phase 4 — PDF export (§8, §15.10)

- [ ] Task 4.1: Add Puppeteer and implement `/api/generate-pdf`
  - Verification: requesting
    `/api/generate-pdf?profileId=jordan-rivera&variantId=detailed` returns 200 and
    the saved response opens as a valid Letter-size PDF.

- [ ] Task 4.2: Await `document.fonts.ready` and hard-fail on any failed
      `document.fonts.check()` (§8, §13, §15.14)
  - Verification: with a woff2 file removed, the endpoint returns 500 with a
    message naming the missing face and emits no PDF; with fonts present it
    returns 200.

- [ ] Task 4.3: Use the exact `page.pdf()` options from §15.10
  - Verification: the call passes `format: 'Letter'`, `preferCSSPageSize: true`,
    `printBackground: true`, and zero margins on all sides; the generated PDF's
    MediaBox reads 612×792.

- [ ] Task 4.4: Launch and close Chromium per request, no cache (§8)
  - Verification: the handler closes the browser in a `finally` block; two
    successive requests each produce a fresh PDF, and no Chromium process
    survives after the response.

- [ ] Task 4.5: Run the Phase 3 harness against the Puppeteer output, not just the
      render route
  - Verification: `npm run harness -- --pdf out.pdf` exits 0, confirming the
    export path matches the verified render route.

---

## Phase 5 — Dashboard (§7, §15.12)

- [ ] Task 5.1: Build the home page listing profiles and their variants
  - Verification: `/` lists profile `jordan-rivera` with variant `detailed`
    showing its `label`, `tag`, and `updatedAt`.

- [ ] Task 5.2: Wire the View and Download PDF actions
  - Verification: View navigates to `/render/jordan-rivera/detailed`; Download
    streams a PDF with a `Content-Disposition` filename derived from the variant
    id.

- [ ] Task 5.3: Add Delete and Rename for variants and profiles (§15.12)
  - Verification: renaming a scratch variant moves its JSON file and updates the
    dashboard entry; deleting removes the file and the row, behind a confirmation
    prompt.

- [ ] Task 5.4: Add the "New Profile" form (§9, §12.7)
  - Verification: submitting name plus slug creates
    `data/profiles/<slug>/content-library.json` (empty, `schemaVersion: 1`) and a
    `variants/` directory, and the new profile appears on the dashboard.

- [ ] Task 5.5: Disable the download button with a spinner during export (§13)
  - Verification: the button is disabled and shows a spinner for the request's
    duration; a failed export raises an error toast rather than failing silently.

---

## Phase 6 — Variant editor (§7)

- [ ] Task 6.1: Build the two-column editor shell with Zustand state
  - Verification: `/edit/jordan-rivera/detailed` shows the form on the left and
    the live preview on the right, rendered by the same `components/resume`
    component the export path uses.

- [ ] Task 6.2: Live-update the preview on every form change, with no Puppeteer call
  - Verification: editing a bullet updates the preview within one render tick;
    the Network tab shows no request to `/api/generate-pdf` while editing.

- [ ] Task 6.3: Implement section-level curation — visibility and per-section
      `options` (§12.2)
  - Verification: toggling `visible` hides a section in the preview; changing
    header `mode` and `aboutMeId` updates the preview and persists to the variant
    JSON on save.

- [ ] Task 6.4: Implement entry-level and bullet-level curation toggles (§6.2, §12.3)
  - Verification: unchecking a bullet removes it from the preview and from the
    saved variant's bullet-ID array; Education toggles whole entries only, with no
    bullet toggles rendered.

- [ ] Task 6.5: Implement two-level Technical Skills curation (§12.3)
  - Verification: a group can be excluded wholesale, and individual skills within
    an included group can be toggled; both are reflected in the saved variant.

- [ ] Task 6.6: Add drag-to-reorder for sections, entries, and bullets via
      `@dnd-kit` (§7, §15.3)
  - Verification: dragging a section reorders it in the preview and rewrites the
    variant's section array position; no `order` field is written anywhere.

- [ ] Task 6.7: Implement the new-content flow — everything typed is written to the
      library first (§6.3)
  - Verification: typing a new bullet adds an item with a generated ID to
    `content-library.json`, then references that ID in the open variant —
    confirmed by inspecting both files after save.

- [ ] Task 6.8: Implement Save and Save As (§7, §12.5)
  - Verification: Save overwrites the open variant and bumps `updatedAt`; Save As
    creates a new file auto-named `{tag}_{date}` with an editable tag prefilled
    from the parent, leaving the original untouched.

- [ ] Task 6.9: Show page-boundary guides and a live overflow indicator (§11.5)
  - Verification: adding enough bullets to cross a page boundary surfaces the
    indicator; export remains enabled — the indicator is informational, not
    blocking.

- [ ] Task 6.10: Fall back to `serif` in the preview when fonts fail, without
      blocking (§13, §15.14)
  - Verification: with a woff2 removed, the editor preview still renders in
    `serif` with a non-blocking warning, while `/api/generate-pdf` still
    hard-fails.

---

## Phase 7 — Library manager (§7, §12.7)

- [ ] Task 7.1: Build the library browser screen, separate from the variant editor
  - Verification: `/library/jordan-rivera` lists every library item grouped by
    type with its ID and tags.

- [ ] Task 7.2: Implement edit-with-propagation (§11.4)
  - Verification: editing a bullet's text updates `content-library.json` and
    every variant referencing that ID renders the new text — verified by
    re-rendering a second variant that shares the bullet.

- [ ] Task 7.3: Implement "Fork this bullet" (§11.4)
  - Verification: forking creates a new library item with a new ID, repoints only
    the currently open variant at it, and leaves other variants on the original.

- [ ] Task 7.4: Implement tagging on library items (§6.1)
  - Verification: adding a tag persists to the item's `tags` array and the
    browser can filter by it.

- [ ] Task 7.5: Implement orphan detection and delete
  - Verification: an item referenced by no variant is flagged as orphaned;
    deleting it removes it from `content-library.json`, and deletion of a
    referenced item is blocked with a message naming the referencing variants.

---

## Phase 8 — n8n integration (§10)

- [ ] Task 8.1: Expose a variant-write API endpoint for external drafting
  - Verification: `POST /api/variants` with a schema-valid body creates a variant
    file and returns its id; a body with a dangling library ID returns 400 with
    the offending ID named.

- [ ] Task 8.2: Build the n8n workflow — webhook → fetch library → LLM draft →
      save → render → email
  - Verification: posting
    `{ profileId, variantId, targetRole, jobDescription, notifyEmail }` to the
    webhook results in a new variant on disk and a PDF delivered to
    `notifyEmail`.

- [ ] Task 8.3: Constrain the LLM system prompt to selection and reordering only (§10)
  - Verification: the prompt explicitly forbids inventing experience, metrics, or
    skills; a test run against an unrelated job description produces a variant
    whose every referenced ID already exists in the library — asserted
    programmatically, not by eye.

- [ ] Task 8.4: Document the n8n setup
  - Verification: `docs/n8n.md` records the webhook payload, the node sequence,
    and the exported workflow JSON path.

---

## Phase 9 — Polish

- [ ] Task 9.1: Complete the §13 error-handling table end to end
  - Verification: each of the five rows in §13 is exercised manually or by test
    and behaves as specified; failures surface as toasts, never silently.

- [ ] Task 9.2: Add loading states across dashboard, editor, and library manager
  - Verification: every async action shows a pending state and no action can be
    double-submitted.

- [ ] Task 9.3: Write the project `README.md`
  - Verification: covers setup, the font build step, `npm run dev`,
    `npm run harness`, the data layout under `data/profiles/`, and the
    localhost-only / no-auth caveat from §9.

- [ ] Task 9.4: Re-run the full harness and test suite as a release gate
  - Verification: `npm test` and `npm run harness` both exit 0 on a clean
    checkout after `npm install` followed by `node scripts/build-fonts.mjs`.
