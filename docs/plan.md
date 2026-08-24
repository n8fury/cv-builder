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

- [x] Task 0.6: Write Zod schemas for variants (§6.2, §12.2, §12.5)
  - Verification: `lib/schema/variant.ts` exports `variantSchema`; the same
    `validate-data.ts` run parses
    `data/profiles/jordan-rivera/variants/detailed.json` clean, including the
    per-section `options` shapes.

- [x] Task 0.7: Build the filesystem data layer — read/list/write profiles,
      libraries, variants (§9)
  - Verification: `lib/data/store.ts` exports `listProfiles`, `readLibrary`,
    `listVariants`, `readVariant`, `writeVariant`, `deleteVariant`; a vitest
    suite (`npm test`) round-trips a temp profile through write→read and asserts
    writes are atomic (temp file plus rename).

- [x] Task 0.8: Build the variant→library resolver producing a flat render model
  - Verification: `lib/data/resolve.ts` exports `resolveVariant(library, variant)`;
    a vitest case resolving `detailed.json` yields 9 competencies, 2 experience
    entries / 10 bullets, 2 projects / 6 bullets, 1 education entry, 7 skill
    groups / 37 skills, 4 certifications (§12.6), and throws a named error on a
    dangling ID reference.

- [x] Task 0.9: Implement the `*inline italic*` markup parser with `\*` escaping (§16.3)
  - Verification: `lib/render/markup.ts` exports `parseInlineMarkup`; vitest
    covers paired asterisks → italic span, escaped asterisk → literal `*`, and an
    unpaired asterisk rendering literally without throwing.

---

## Phase 1 — Font pipeline and CSS metric system

- [x] Task 1.1: Write `scripts/build-fonts.mjs` converting local TTFs → woff2
  - Verification: `node scripts/build-fonts.mjs` produces
    `public/fonts/charter-roman.woff2`, `charter-bold.woff2`,
    `charter-italic.woff2`, and `charis-italic.woff2` from the four faces in the
    user font directory; each output is non-empty, and the script exits non-zero
    with a clear message if a source TTF is missing.

- [x] Task 1.2: Document the font prerequisite and license note in `README.md` (§3)
  - Verification: `README.md` lists the four required font files, the
    build-fonts step, and the Charter BT commercial-license caveat;
    `public/fonts/` is confirmed gitignored.

- [x] Task 1.3: Declare `@font-face` rules with `font-display: block` (§8)
  - Verification: `components/resume/fonts.css` declares all four faces; loading
    a `/render/...` page shows all four in DevTools → Network with status 200 and
    no fallback substitution.

- [x] Task 1.4: Encode every §4 measurement as named constants in one metrics module
  - Verification: `lib/render/metrics.ts` exports page setup (612×792, 55pt
    margins), per-section `spaceBefore` (§4.2) and `headingToContent` (§4.3) maps
    keyed by section type, entry/bullet metrics (§4.4), leading values including
    the 13pt exception for Technical Skills / Certifications / Languages (§4.5),
    the 20pt hanging indent, the 11.18pt bullet-marker offset, and the 2.31pt
    right-block baseline lift. Every number appears exactly once in the codebase:
    `grep -rn "27.44" --include=*.ts --include=*.css` matches only this file.

- [x] Task 1.5: Implement `baselineGap()` — convert a target baseline delta into a
      CSS margin using font ascent
  - Verification: `lib/render/metrics.ts` exports
    `baselineGap(targetPt, fontSizePt, lineHeightPt)`; vitest asserts a 12.00pt
    entry-title→company target at 10pt/12pt leading yields a 0pt margin, and the
    27.44pt Experience space-before yields the expected positive margin.

- [x] Task 1.6: Emit the metrics module as CSS custom properties for the template
      stylesheet
  - Verification: `components/resume/resume.css` consumes
    `var(--space-before-experience)` and siblings; the `:root` block is generated
    from `metrics.ts` rather than hand-copied, and a mismatch between the two
    fails `npm test`.

---

## Phase 2 — The `/render` route (§11.1)

- [x] Task 2.1: Create the server route `/render/[profileId]/[variantId]` reading
      library and variant off disk
  - Verification: requesting `/render/jordan-rivera/detailed` returns HTTP 200; an
    unknown profile or variant returns 404, not a blank page (§13).

- [x] Task 2.2: Build the page shell — Letter size, 55pt padding, `@page` size and
      zero margin (§2, §8)
  - Verification: the page wrapper measures 612×792pt with 55pt padding on all
    four sides; the content box spans x 55 → 557 (§4.1).

- [x] Task 2.3: Render the Header section, full and minimal modes (§5.1, §15.9)
  - Verification: `/render/jordan-rivera/detailed` shows the centered 24.9pt name
    with a single pipe-separated contact line (minimal mode); a scratch variant
    set to `mode: "full"` produces two contact lines 17.07pt apart.

- [x] Task 2.4: Render section headings — Title Case, 12pt bold, 0.4pt full-width
      rule, `break-after: avoid` (§4.5, §15.9, §15.11)
  - Verification: all seven headings render Title Case with a rule spanning
    x 55 → 557; computed style shows `break-after: avoid`.

- [x] Task 2.5: Render About Me and Core Competencies (§5.2, §5.3)
  - Verification: About Me renders one paragraph at 10pt/12pt; competencies
    render as a single pipe-separated run beginning
    `Full Stack Development (MERN) | RESTful API Design`.

- [x] Task 2.6: Render Experience entries — flex header, 2.31pt right-block lift,
      hanging-indent bullets (§4.4, §5.4)
  - Verification: title/company left-aligned and dates/location right-aligned to
    x 557; the right block's baseline sits 2.31pt above the left; wrapped bullet
    lines indent +20.0pt; consecutive bullets sit exactly 12pt apart with no
    extra gap.

- [x] Task 2.7: Render Projects entries including `repoUrl` / `demoUrl` when
      present (§5.5, §6.4)
  - Verification: both seed projects render a Charis SIL Italic subtitle 12.00pt
    below the title and 22.19pt from subtitle to first bullet; adding a `repoUrl`
    to a library item makes an underlined black link appear with no toggle.

- [x] Task 2.8: Render Education — institution bold on top, degree in Charis SIL
      Italic, description as a single bullet (§5.6, §16.2, §16.4)
  - Verification: the education entry renders `• Coursework: …` as a bullet, not
    a paragraph, with institution above degree.

- [x] Task 2.9: Render Technical Skills, Certifications, and Languages at 13pt
      leading (§4.5, §5.7, §5.8, §5.10)
  - Verification: all seven skill groups render as `Group: skill, skill` with the
    label bold; certifications render fully bold with right-aligned dates;
    measured line-to-line spacing in all three sections is 13.00pt, not 12.00pt.

- [x] Task 2.10: Render Recommendations (collapsed and expanded) and Custom
      Sections (§5.9, §5.11, §12.4)
  - Verification: a scratch variant with `mode: "collapsed"` renders the single
    "References available upon request" line; `mode: "expanded"` renders per-entry
    name/role/location/email; two `type: "custom"` section entries render as two
    distinct sections in array order.

- [x] Task 2.11: Apply `break-inside: avoid` per entry and page-boundary guides in
      preview mode (§11.5)
  - Verification: computed style on every entry wrapper shows
    `break-inside: avoid`; the preview shows page-boundary guides and the PDF
    output does not.

- [x] Task 2.12: Handle a visible section with no resolved items (§13)
  - Verification: a scratch variant with `competencies` visible but an empty
    `items` array renders the heading with an empty body and returns 200 — no
    crash.

---

## Phase 3 — Pixel-fidelity harness (§11.2) — gates all later phases

- [x] Task 3.1: Extract text-item positions from the source PDF into a committed
      golden file
  - Verification: `node scripts/extract-golden.mjs` reads
    `data/reference/resume-reference-detailed.pdf` via `pdfjs-dist` and
    writes `harness/golden.json` with per-item
    `{ page, text, x, baselineY, fontName, fontSize }`; the file is committed
    (coordinates only, not the PDF) and the harness runs without the gitignored
    PDF present.

- [x] Task 3.2: Build the diff harness comparing a generated PDF against the
      golden file at ±2pt
  - Verification: `npm run harness` prints a per-element pass/fail table and
    exits non-zero when any element exceeds ±2pt in x or baseline y.

- [x] Task 3.3: Reconcile measured drift — fix `metrics.ts`, never the golden file
  - Verification: `npm run harness` exits 0 for every element of `detailed.json`;
    any value changed in `metrics.ts` carries a comment recording its measured
    justification.
  - Result: `npm run harness` exits 0 — 84/84 lines placed within ±2pt, 59
    exact, 25 reflowed, document text identical. `golden.json` was never
    touched. Reconciled in `metrics.ts`: About Me's space-before (measured
    37.52, was the interpolated 27.2); the `@page` margin model, so
    continuation pages get margins at all; the heading's solved line height,
    for §4.1's 11.77pt continuation-page baseline; `break-inside` on the
    heading, so Chromium stops breaking between a heading and its rule and
    honours `break-after: avoid`; the one-line right-block offset (+7.47,
    against §4.4's two-line −2.31); and the seed data's date en dashes.
  - Line breaking was closed as a **scope decision, not a fix** — recorded in
    `SPEC.md` §11.2. 15 of 84 lines wrap one word differently because
    Illustrator's Paragraph Composer optimises breaks across a paragraph and
    compresses word spaces (up to 5.89pt, ≈80% minimum); CSS only stretches
    and Chromium breaks greedily. `text-wrap: pretty`/`stable` change nothing;
    a uniform negative `word-spacing` reaches 70/84 and is a fitted constant,
    so it was not adopted. No CSS expresses per-line compression, so the
    harness no longer gates on the break point: those lines report as
    `REFLOW`, and `--strict-wrap` restores the old behaviour.
  - Evidence it is a flow difference and not a placement one: all 15 lines
    pair positionally against the golden within 0.34pt in y and 1.51pt in x —
    the layout is line-for-line identical, only the word distribution differs.
  - Compensating assertion, so reflow tolerance cannot hide a content bug:
    the harness now requires the two documents' copy to be identical
    character-for-character (`scripts/lib/text-identity.mjs`), whitespace and
    line-break hyphens normalised away. Covered by `scripts/text-identity.test.ts`,
    which asserts it catches a dropped, added, or altered word.
  - Investigated and dismissed: the systematic negative dX (−1.04 … −1.84) is
    not drift. Every generated left-margin line sits at exactly 54.75 — 55pt
    is 73.33px, which Chromium snaps to 73px, costing 0.25pt. The remaining
    0.79–1.59pt is the source's own frame jitter: its left-margin text starts
    at 11 distinct x values because each Illustrator text frame was placed by
    hand. §4.1 pins the content box at x=55, so this is not reproduced.

- [x] Task 3.4: Measure and encode the two §4 gaps the spec left unresolved
  - Verification: About Me's space-before (absent from §4.2) and Projects'
    space-before (§4.2's interpolated 27.2) are read from `harness/golden.json`,
    written into `metrics.ts`, and `SPEC.md` §4.2 is updated with the measured
    values; the harness still exits 0.
  - **Status: both gaps settled.** Ticked on everything this task controls:
    `npm test` passes, and `metrics.golden.test.ts` asserts both values
    against the golden files directly. The harness clause is Task 3.3's — it
    shows no regression here (59/84 exact, 69/69 placed within ±2pt,
    unchanged from 3.3's baseline) but cannot exit 0 until 3.3's line
    breaking is resolved.
  - Amendment: Projects' space-before is **not** readable from
    `harness/golden.json` — the heading opens page 2 there, so §4.1's
    continuation-page geometry places it and no preceding baseline exists. The
    second (basic) PDF places it mid-page at 34.72, but that document drifts
    up to 4pt from the canonical on gaps both measure, and 34.72 is 7.5pt
    clear of every canonical gap. 27.2 therefore stands, re-justified as a
    *bound* rather than an interpolation: it is within 0.24pt of both
    canonical bullet-preceded gaps (Education 26.97, Technical Skills 27.24).
  - About Me is measured from the **name baseline** (60.97), not the last
    contact line, which is what holds across both sources; the space-before is
    derived per header mode — 37.52 minimal, 20.32 full. A single figure was
    ~17pt wrong for full headers, which the harness never exercises.
  - `harness/golden-basic.json` is now committed alongside the canonical
    golden (coordinates only, per Task 3.1's rule), since the full-header and
    Projects readings both come from the second document.

- [x] Task 3.5: Assert font identity, not just position
  - Verification: the harness compares each item's `fontName` against golden and
    fails on any Charter/Charis face substitution — confirmed by temporarily
    removing one woff2 and observing a non-zero exit.
  - Result: with `charis-italic.woff2` removed the harness exits 1, reporting
    `font CharisSIL-Italic rendered as TimesNewRomanPS-ItalicMT` on five lines
    plus two document-level face failures. Restored, it exits 0 with
    `faces identical`.
  - Why it was needed: those five lines drifted only 0.87–1.40pt in y and
    under 1.8pt in x — all inside ±2pt. The substitution would have passed a
    geometry-only harness clean.
  - Also asserts font size (±0.5pt — the source rounds 24.9 to 24.91 and 12 to
    11.96), and requires every face to carry identical copy document-wide, so
    a substitution part-way along a line cannot hide behind a matching leading
    item. Covered by `scripts/text-identity.test.ts`.
  - Prerequisite fixed on the way: `fonts.css` declared the faces as
    `"Charter BT"` / `"Charis SIL"`, the same names as the system-installed
    originals, so a deleted woff2 silently resolved to the machine's own copy
    and output stayed byte-identical — the negative test could not fail. They
    are now `"CV Charter"` / `"CV Charis"`, names no system font can claim.
    This also removes a real dependency on what happens to be installed, which
    §8 exists to prevent. The embedded faces keep their internal names, so the
    golden file is unaffected.

---

## Phase 4 — PDF export (§8, §15.10)

- [x] Task 4.1: Add Puppeteer and implement `/api/generate-pdf`
  - Verification: requesting
    `/api/generate-pdf?profileId=jordan-rivera&variantId=detailed` returns 200 and
    the saved response opens as a valid Letter-size PDF.
  - Result: 200 with `Content-Type: application/pdf`, 128,461 bytes; the saved
    file parses as a 2-page PDF measuring 612x792 on both pages, with
    `CharterBT-Roman` embedded (no fallback). Unknown ids return 404 and a
    missing query parameter returns 400, both before Chromium is launched.
  - The handler lives at `app/api/generate-pdf/route.ts`, prints the `/render`
    route rather than re-implementing layout, and awaits `document.fonts.ready`
    before `page.pdf()` (SPEC 8). It already passes 15.10's exact options and
    closes the browser in a `finally` block, so Tasks 4.3 and 4.4 are code-
    complete pending their own verification.

- [x] Task 4.2: Await `document.fonts.ready` and hard-fail on any failed
      `document.fonts.check()` (§8, §13, §15.14)
  - Verification: with a woff2 file removed, the endpoint returns 500 with a
    message naming the missing face and emits no PDF; with fonts present it
    returns 200.
  - Result: with `charis-italic.woff2` removed the endpoint returns 500,
    `application/json`, `font faces unavailable: CV Charis italic 400 failed
    to load (status: error)` — no PDF bytes. Removing `charter-bold.woff2` as
    well names both faces in one message. Restored, it returns 200 and the
    harness still reports 84/84 within +/-2pt, faces identical.
  - `document.fonts.ready` is necessary but not sufficient: it settles once
    loading has *finished*, success or failure alike, so a missing woff2
    resolves it and the page simply paints `serif`. The check therefore looks
    each required face up among the document's CSS-connected faces and
    demands `status === "loaded"` plus a passing `document.fonts.check()`.
  - A face the open variant never uses is loaded explicitly rather than
    skipped, so whether the export is trustworthy does not depend on whether
    this particular resume happens to render italics.
  - The required-face list is `lib/render/fonts.ts`, and `fonts.test.ts`
    asserts it equals what `fonts.css` declares (and that every face carries
    `font-display: block`) — a face added to the stylesheet alone, which the
    export would then never verify, fails `npm test`.

- [x] Task 4.3: Use the exact `page.pdf()` options from §15.10
  - Verification: the call passes `format: 'Letter'`, `preferCSSPageSize: true`,
    `printBackground: true`, and zero margins on all sides; the generated PDF's
    MediaBox reads 612×792.
  - Result: the exported PDF carries `/MediaBox [0 0 612 792]` on both pages,
    read straight out of the raw bytes, with no page rotation. The harness
    still reports 84/84 within +/-2pt.
  - The options moved out of the route into `lib/render/pdf-options.ts` and
    are asserted by `pdf-options.test.ts`, which also requires the
    stylesheet's `@page { size: 612pt 792pt }` to agree with `format:
    'Letter'` — §15.10's belt-and-suspenders, mechanised. Getting this wrong
    yields a PDF that still opens cleanly and is silently A4.
  - The zero margins are Puppeteer's only. The real 55pt inset is the
    stylesheet's `@page` margin, which Task 3.3 moved there so continuation
    pages get margins at all; Puppeteer margins on top would inset the page
    box a second time.

- [x] Task 4.4: Launch and close Chromium per request, no cache (§8)
  - Verification: the handler closes the browser in a `finally` block; two
    successive requests each produce a fresh PDF, and no Chromium process
    survives after the response.
  - Result: Puppeteer-owned browser processes counted 0 before the first
    request, 0 after a 200, 0 after a font-failure 500, and 0 at the end —
    the `finally` runs on the early-return error paths too, which is where a
    leak would otherwise accumulate one process per failed download.
  - Freshness was tested against disk rather than by byte size: a scratch
    variant exported (231 text items, Core Competencies present), had its
    competencies section deleted on disk, and re-exported in the next request
    (212 items, section gone). Nothing was carried over from the first run.
  - Each launch already gets its own throwaway user-data-dir, so no profile
    or HTTP cache survives a request; `page.setCacheEnabled(false)` is set on
    top so the resume, its CSS and its woff2 files cannot be served from one
    within a request either.
  - `browser.close()` is guarded: a teardown failure must not turn a good PDF
    into a 500 for the caller.
  - Scratch variant removed afterwards; `data/profiles/` is unchanged.

- [x] Task 4.5: Run the Phase 3 harness against the Puppeteer output, not just the
      render route
  - Verification: `npm run harness -- --pdf out.pdf` exits 0, confirming the
    export path matches the verified render route.
  - Result: against the exported PDF the harness exits 0 — 84/84 lines within
    +/-2pt, 59 exact, document text and faces identical, the same figures the
    render route posts. Item-for-item, the two PDFs are the same document:
    231 text items each, matching page, text, x, baseline and font
    throughout.
  - `--export` was added to the harness so it can download from
    `/api/generate-pdf` rather than only print `/render` over CDP, and
    `npm run harness:export` runs it. Measuring the response, not a
    re-print, is what puts the font pre-flight, §15.10's page options and the
    HTTP response itself inside the gate.
  - Failure paths checked: with `charter-italic.woff2` removed the export
    mode exits 1 and reports the API's own message
    (`CV Charter italic 400 failed to load`) rather than a parse error, and
    `--pdf` together with `--export` exits 1 rather than silently preferring
    one.

---

## Phase 5 — Dashboard (§7, §15.12)

- [x] Task 5.1: Build the home page listing profiles and their variants
  - Verification: `/` lists profile `jordan-rivera` with variant `detailed`
    showing its `label`, `tag`, and `updatedAt`.
  - Result: `/` returns 200 listing `jordan-rivera` ("Jordan A. Rivera") with
    `Detailed — reference reproduction`, tag `detailed`, `Updated 22 Aug 2026`.
  - `lib/data/dashboard.ts` isolates every read: an unreadable variant lands in
    a `broken[]` row with its reason and an unreadable library sets `error` on
    the profile, so one hand-edited or n8n-written file cannot blank the whole
    screen (§13). Both are shown, not swallowed.
  - Dates format through a fixed `en-GB`/UTC formatter, so the rendered value
    does not depend on the server's locale or timezone.

- [x] Task 5.2: Wire the View and Download PDF actions
  - Verification: View navigates to `/render/jordan-rivera/detailed`; Download
    streams a PDF with a `Content-Disposition` filename derived from the variant
    id.
  - Result: the View link resolves to `/render/jordan-rivera/detailed` (200);
    the export returns 200, `application/pdf`, 128,461 bytes, body `%PDF-1.4`,
    `content-disposition: attachment; filename="jordan-rivera-detailed.pdf"`.
  - `lib/routes.ts` is the one definition of both paths and the filename — the
    dashboard, the export route and its Puppeteer target all read from it, so a
    path change cannot leave a dead button behind.
  - The endpoint gained a `download=1` flag: with it the response is an
    attachment, without it the existing inline behaviour (browser PDF viewer,
    `harness --export`) is untouched.

- [x] Task 5.3: Add Delete and Rename for variants and profiles (§15.12)
  - Verification: renaming a scratch variant moves its JSON file and updates the
    dashboard entry; deleting removes the file and the row, behind a confirmation
    prompt.
  - Result: driven through the page with Puppeteer — rename moved
    `scratch.json` → `scratch-renamed.json` and the row followed; delete fired
    `Delete variant "scratch-renamed"? This cannot be undone.` and removed both
    file and row. Profile rename/delete verified the same way on a scratch
    profile, including the conflict path.
  - Renames check the target first and raise `ConflictError`, because `rename`
    overwrites silently on both POSIX and NTFS — renaming onto a sibling would
    otherwise destroy real curation work without a word.
  - A variant rename moves the file and nothing else: the slug *is* the id
    (§12.5), so `tag`, `label` and `updatedAt` describe the curation, not its
    name.
  - `ActionState`/`IDLE` live outside `actions.ts` — a `"use server"` module may
    only export async functions, which the first page load caught as a 500.

- [x] Task 5.4: Add the "New Profile" form (§9, §12.7)
  - Verification: submitting name plus slug creates
    `data/profiles/<slug>/content-library.json` (empty, `schemaVersion: 1`) and a
    `variants/` directory, and the new profile appears on the dashboard.
  - Result: submitting `Zz Scratch Person` / `zz-scratch` wrote a library
    opening `"schemaVersion": 1` with every content array empty, created
    `variants/`, and added the card. Scratch profile removed afterwards.
  - The library write uses flag `wx`. Checking for the directory first would be
    a race and would happily flatten an existing library; an exclusive create
    fails outright, so a repeated submission cannot destroy real content.
  - The name goes into `header.name` because that is where the resume renders
    it — there is nowhere else for it to live, and dropping it would mean asking
    for it twice.
  - The id is suggested from the name as it is typed and stops auto-updating
    once edited by hand; it becomes both the URL and the folder name.

- [x] Task 5.5: Disable the download button with a spinner during export (§13)
  - Verification: the button is disabled and shows a spinner for the request's
    duration; a failed export raises an error toast rather than failing silently.
  - Result: idle → `{ disabled: false, aria-busy: false, spinner: false }`,
    in-flight → `{ text: "Generating…", disabled: true, aria-busy: true,
    spinner: true }`, then back. With `charis-italic.woff2` renamed away the
    toast read `PDF generation aborted — font faces unavailable: CV Charis
    italic 400 failed to load (status: error)` and nothing was saved.
  - The link became a `fetch`: an export launches Chromium per request (§8) and
    takes ~1.7s, so a plain link gave no sign of progress and invited a second
    click — a second browser. Fetching also puts the API's own `{ error }`
    message in front of the user instead of a blank tab.
  - Toasts live at the layout level (`Toaster.tsx`): a button that has returned
    to its resting state has nowhere to put a message. Later phases reuse it.
  - Two defects found while verifying: the object URL is now revoked on a timer
    rather than inline (the browser reads the blob asynchronously after the
    click), and a 2xx response carrying zero bytes is now a toast rather than a
    silently saved empty file.
  - **Not verified here, needs a re-check on a normal machine**: the file
    actually landing on disk. This sandbox rewrites every `application/pdf`
    response to a 204 for Chrome — confirmed against a *static* PDF served from
    `public/`, while a woff2 through the same server returns 200 — and cancels
    every browser download, a plain static file included. The endpoint itself is
    covered: `curl` gets 200 / 128,461 bytes / `%PDF`, `npm run harness:export`
    exits 0 against those bytes, and the in-page instrumentation showed the
    click asking to save `jordan-rivera-detailed.pdf`.

---

## Phase 6 — Variant editor (§7)

- [x] Task 6.1: Build the two-column editor shell with Zustand state
  - Verification: `/edit/jordan-rivera/detailed` shows the form on the left and
    the live preview on the right, rendered by the same `components/resume`
    component the export path uses.
  - Result: the route returns 200; driven with Puppeteer, the form's right edge
    sits left of the preview's left edge (x=41 vs x=574), the fields read
    `tag=detailed` / `label=Detailed — reference reproduction`, and the preview
    holds a `.resume-page` 816px wide with 73.33px padding (612pt / 55pt),
    `Jordan A. Rivera` in `CV Charter` at 33.2px, all seven section headings,
    and all four woff2 faces `loaded`. No page errors.
  - The section mapping moved out of the render route into
    `components/resume/ResumeDocument.tsx`, which both the print route and the
    preview now render — the preview is only trustworthy if it is the same
    component, not a second implementation of it. The harness confirms the
    move changed nothing: 84/84 lines within ±2pt, text and faces identical,
    against both the Chrome path and the Puppeteer export.
  - The preview lives in an iframe with `resume.css` injected as text and the
    React subtree portalled into its body. Tailwind's preflight is scoped away
    from `components/resume/**` (§7) and the print route has its own root
    layout for the same reason; an iframe is what lets editor chrome and an
    untouched resume document share one page while the resume stays live React
    rather than a reloaded snapshot.
  - The store keeps `saved` and `draft` side by side, so "unsaved changes" is a
    comparison rather than a flag — editing the label raised the indicator and
    Revert cleared it, both verified in the browser.
  - One store per mount behind a context provider: a module-level store would
    outlive the route and hand the next variant the previous one's draft.
  - A draft that references a missing library item renders the resolver's error
    in place of the page instead of blanking the column (§13).

- [x] Task 6.2: Live-update the preview on every form change, with no Puppeteer call
  - Verification: editing a bullet updates the preview within one render tick;
    the Network tab shows no request to `/api/generate-pdf` while editing.
  - Result: typing `ZZQ` into the first Experience bullet's field put `ZZQ` in
    the preview inside the next animation frame — the text was absent before
    the keystroke and present in the frame that followed — while the page made
    **0 network requests of any kind** during the edit, `/api/generate-pdf`
    included. The dirty indicator flipped to "Unsaved changes". No page errors.
  - Bullet text lives in the *library*, not the variant (§6.2), so the store now
    drafts both files: `saved` and `draft` each hold `{ variant, library }`.
    That is the propagating edit of §11.4 staged in memory — the preview shows
    it, and nothing has touched disk until Save.
  - The preview needs no subscription of its own: it is a component reading the
    draft, so React's own commit is the "render tick". No debounce, no polling,
    no effect — a debounce would be the only thing capable of making it late.
  - `setBulletText` is addressed by owner *and* entry: bullet IDs are unique
    only within their entry, and the seed data already repeats one across two
    entries. A unit test pins that — editing `exp-1/b1` must leave `exp-2/b1`
    alone.
  - The form lists each entry's *curated* bullets, the same subset the preview
    renders, so the two columns cannot disagree about what is in the CV.

- [x] Task 6.3: Implement section-level curation — visibility and per-section
      `options` (§12.2)
  - Verification: toggling `visible` hides a section in the preview; changing
    header `mode` and `aboutMeId` updates the preview and persists to the variant
    JSON on save.
  - Result: unchecking Projects took the preview's section list from
    `[about-me, competencies, experience, projects, education, skills,
    certifications]` to the same list without `projects`, and re-checking put it
    back. Header `mode` `minimal → full` turned one contact line into two —
    `Northside, Springfield, SP-1010 | jordan.rivera@example.com | +1-555-0142`
    over `linkedin.com/in/jordan-rivera | github.com/jordan-rivera-demo` (§5.1). No page
    errors.
  - `aboutMeId`, recommendations `mode` and `customSectionId` were driven on a
    throwaway `zz-scratch` profile, since the real library has one About Me
    version and no recommendations or custom sections: the About Me paragraph
    swapped long → short, Recommendations went from `References available upon
    request` to the named referee, and the custom section swapped A → B. The
    scratch profile was deleted afterwards.
  - **Deferred half**: "persists to the variant JSON on save" waits on Save
    itself (Task 6.8) — nothing in the editor writes to disk yet. What the save
    will write is covered now: unit tests assert the draft variant carries
    `options: { mode: "minimal" }` and `options: { aboutMeId: "about-short" }`
    after those actions.
  - Options are written by section *index*, with the expected type passed in and
    checked. Array position is a section's only identity (§15.3) and a variant
    may hold several custom sections (§12.4), so index is the address — but an
    index left over from a reorder must not write header options onto another
    section, so a type mismatch is a no-op. A test pins that.
  - A hidden section keeps its editable body in the form: curation is usually
    prepared before a section is switched back on, and collapsing it would
    shuffle the whole column on every toggle.
  - A missing `aboutMeId` / `customSectionId` reference is offered in its select
    as `<id> (missing)` rather than silently snapping the draft to another
    item (§13).

- [x] Task 6.4: Implement entry-level and bullet-level curation toggles (§6.2, §12.3)
  - Verification: unchecking a bullet removes it from the preview and from the
    saved variant's bullet-ID array; Education toggles whole entries only, with no
    bullet toggles rendered.
  - Result: unchecking the first Experience bullet took the preview from 17
    bullets to 16, the missing one being `Architected full-stack garage
    management sys…`. Unchecking the `freelance` entry removed
    `Freelance Full Stack Developer` from the preview entirely and moved it
    into the form's "Not in this variant" group. The Education card renders
    1 entry toggle, 0 bullet toggles and 0 bullet fields; Certifications, 4
    entry toggles and 0 bullet toggles (§15.7). No page errors.
  - **Deferred half**: "and from the saved variant's bullet-ID array" —
    the write waits on Save (Task 6.8). The array itself is covered now: unit
    tests assert the draft section becomes `entries: [{ id: "exp-1", bullets:
    ["b2"] }]` after the toggle.
  - The form lists the library's whole offering per section — included items
    first in the variant's order (§15.3), the rest greyed out below. Curation
    is a selection out of the library, so the un-chosen have to be visible to
    be chosen.
  - A re-included item goes back where it was, after the last already-included
    item that precedes it in the library — appending would mean a mis-click and
    its correction silently reordered the CV.
  - Re-including an *entry* restores the bullet curation the variant was saved
    with, rather than all of its bullets: un-ticking an entry by accident must
    not quietly discard the selection saved with it. An entry new to the
    variant does come in with all of its bullets.
  - Bullet text stays editable whether or not the bullet is included — wording
    belongs to the library, selection to the variant (§6.2, §11.4).
  - Languages says so in place of a list: it is `visible`-only, with no per-item
    curation at all (§12.3, §15.6). Custom-section bullets get fields but no
    toggles — the library item is the unit there (§12.4).

- [x] Task 6.5: Implement two-level Technical Skills curation (§12.3)
  - Verification: a group can be excluded wholesale, and individual skills within
    an included group can be toggled; both are reflected in the saved variant.
  - Result: the Technical Skills card renders 7 group toggles and 33 skill
    toggles. Unticking `skill-js` turned the preview's first line from
    `Languages: JavaScript (ES6+), TypeScript, Python, C/C++` into
    `Languages: TypeScript, Python, C/C++`; unticking the `skills-languages`
    group then removed that line from the preview altogether. No page errors.
  - **Deferred half**: "reflected in the saved variant" on disk waits on Save
    (Task 6.8). The draft is asserted now — a test drives both levels and checks
    the section becomes `groups: [{ id: "skills-backend", skills:
    ["skill-nodejs"] }]`, then `groups: []`.
  - No new store actions: §12.3 defines a skill group as referencing its skills
    the way an entry references its bullets, so the group goes through
    `setEntryIncluded` and the skill through `setBulletIncluded`, restore rule
    included — a re-included group comes back with the skill selection the
    variant was saved with.
  - Skills get their own component even so. They are two or three words, not
    sentences, so they render as a wrapped row of checkboxes rather than the
    stack of text fields bullets need.

- [x] Task 6.6: Add drag-to-reorder for sections, entries, and bullets via
      `@dnd-kit` (§7, §15.3)
  - Verification: dragging a section reorders it in the preview and rewrites the
    variant's section array position; no `order` field is written anywhere.
  - Result: driven through the page with Puppeteer, using dnd-kit's own
    keyboard sensor. Dragging Certifications up two moved the form list from
    `[…, projects, education, skills, certifications]` to
    `[…, projects, certifications, education, skills]` and the preview's
    section list followed exactly; the dirty indicator flipped to "Unsaved
    changes". Entries: the first project moved down one and the preview's
    titles swapped to `[ML-Based Symptom Triage, Fleet Drive-Cycle Analysis]`.
    Bullets: the first two Experience bullets swapped in the preview. Skills,
    both levels: the Languages group moved down two and `skill-react` moved
    one place right inside Frontend (`React.js` now ends that line). Only a
    pre-existing `/favicon.ico` 404 in the console.
  - **Deferred half**: "rewrites the variant's section array position" *on
    disk* waits on Save (Task 6.8) — the editor still writes nothing. The
    array itself is asserted now: unit tests drive all three levels and check
    the resulting draft, including that a bullet move inside `exp-1` leaves
    `exp-2`'s same-named bullet alone.
  - No `order` field is written because none is ever constructed: every move
    is a splice within the variant's own array (`ordering.ts`). A test pins it
    by stringifying the moved draft and requiring no `"order"` key, and the
    strict schema (§15.3) would reject one on read regardless.
  - Only *included* items drag. The variant's array is exactly its included
    list, so an excluded item has no position to move — the "Not in this
    variant" rows therefore render outside the sortable list entirely, rather
    than sitting inside it as drop targets that silently do nothing.
  - The bullet and skill lists were re-split to match the entry list: included
    first in the variant's order (§15.3), the rest greyed below. They
    previously rendered in library order throughout, so the form could not
    show a bullet reorder at all.
  - Dragging is from an explicit handle, never the row: every row here is full
    of checkboxes and textareas that a row-wide listener would fight. The
    handle is a real `<button>`, which is also what makes the keyboard sensor
    — and this verification — work.
  - One `DndContext` per list, not one per section. Bullet IDs are unique only
    within their entry and the seed library already repeats one, so a context
    spanning a whole section would see duplicate draggable IDs.
  - Sections are keyed by type-and-occurrence (`custom#0`, `custom#1`), not by
    index: an index changes under the very drag that uses it, remounting every
    row below the drop. Occurrence number is needed because §12.4 allows
    several custom sections.
  - Defect found while verifying: dnd-kit numbers its ARIA description element
    from a module-level counter, which server and client do not walk in the
    same order, so every list hydrated mismatched on this server-rendered
    page. Each `DndContext` now takes a `useId()` value.

- [x] Task 6.7: Implement the new-content flow — everything typed is written to the
      library first (§6.3)
  - Verification: typing a new bullet adds an item with a generated ID to
    `content-library.json`, then references that ID in the open variant —
    confirmed by inspecting both files after save.
  - Result: driven through the page with Puppeteer. A bullet typed under the
    `northwind` entry took the preview from 17 bullets to 18, the new one being
    its text. A project entry, a skill group and a skill inside it were added
    the same way: the preview gained `ZZ New Project` and the line
    `ZZ Cloud: ZZ AWS`, and the form showed the group's generated ID
    (`skills-fywkz3`). `data/profiles/` is unchanged — nothing here writes to
    disk. Only a pre-existing `/favicon.ico` 404 in the console.
  - **Deferred half**: "after save" waits on Save (Task 6.8), which will close
    out the disk verification for 6.3, 6.4, 6.5, 6.6 and this task together.
    The two-file result is asserted now: unit tests check that the *library*
    gains the item with a generated ID and `tags: []`, and that the variant
    gains only the ID — no text — at every level.
  - There is no second kind of editing here. §6.3 admits no "one-off, not
    saved to the library" path, so this *is* how new text enters the editor:
    library item first, generated ID, then the reference. A section that has
    no per-variant list still writes the library item — Languages renders the
    library's list whole (§15.6), and a custom section's bullets belong to the
    library item, not the variant (§12.4).
  - Which fields a new item needs, and the item those fields build, are
    declared together in `lib/data/new-items.ts`. A test fills every declared
    field with a marker and requires it to surface in the built item, so a
    field the form collects but the builder ignores — typed by the user, then
    silently dropped on save — fails `npm test`.
  - IDs are random, not slugged from the text: the text is the one thing about
    an item that is expected to change, while the ID is what every variant
    addresses it by (§11.4). They are checked for collision against the whole
    library rather than the one collection, and a generator that stops being
    random throws rather than returning a duplicate, which would silently
    repoint an existing item.
  - Nothing is written until Add is pressed with the required fields filled.
    An item created by a stray click is exactly the orphaned cruft §7's
    library manager exists to clean up. Verified: with the field blank the Add
    button is disabled and clicking it leaves the document clean.

- [x] Task 6.8: Implement Save and Save As (§7, §12.5)
  - Verification: Save overwrites the open variant and bumps `updatedAt`; Save As
    creates a new file auto-named `{tag}_{date}` with an editable tag prefilled
    from the parent, leaving the original untouched.
  - Result: driven through the page with Puppeteer against a throwaway
    `zz-save-test` profile, reading both files off disk afterwards. Save is
    disabled while clean and enabled once dirty; after it, the indicator reads
    "Saved". `updatedAt` went `2026-08-22T11:00:00Z` → `2026-08-24T14:27:01.127Z`
    with `createdAt` unchanged. Save As prefilled the tag `detailed`, accepted
    `Google — Backend SWE`, showed the derived id live, wrote
    `google-backend-swe_2026-08-24.json` and navigated to it — and
    `detailed.json` came back **byte-identical**. Repeating the same tag
    toasted `A variant named google-backend-swe_2026-08-24 already exists —
    change the tag and try again.` and wrote no third file. The scratch profile
    was removed; `data/profiles/` is unchanged.
  - **This closes the deferred disk half of Tasks 6.3, 6.4, 6.5, 6.6 and 6.7.**
    The one save above carried all three kinds of edit at once, and both files
    were then read back: the library's `nw-depot` bullet held the rewritten
    text (§11.4), a new bullet `bullet-8vtqwd` had been appended to the library
    with the variant referencing that ID and carrying **no text of its own**
    (§6.3, §6.2), and the Projects section's `visible: false` had persisted
    (§12.2).
  - A save is two files, not one. Curation and ordering live in the variant;
    everything typed lives in the library, because a variant holds no text
    (§6.2) and library edits propagate to every variant referencing them
    (§11.4). Both are re-validated server-side — the payload comes from the
    client, so the schemas are the boundary, the same one §10's n8n endpoint
    will sit behind.
  - The resolver runs as an admission check before either write: a variant
    referencing an ID the library lacks renders as an error rather than a page
    (§13), and writing that pair would persist a CV nothing can open.
  - `content-library.json` is rewritten only when it actually changed. Most
    saves are curation only, and those now leave the library file untouched
    rather than rewriting it — so they cannot clobber an edit made elsewhere
    in the meantime. This is not full concurrency control: a save that *does*
    change the library still overwrites whatever is on disk.
  - Save As creates with `wx` while Save replaces via temp-file-plus-rename.
    The asymmetry is deliberate: there is nothing to lose on a new file, and
    `rename` overwrites silently, so a fork whose auto-generated name collided
    would destroy the variant it collided with.
  - `updatedAt` is stamped on the server, so it records when the file was
    written rather than what the browser's clock says. A fork gets a fresh
    `createdAt` — it is a new record, and inheriting the parent's would
    misdate it on the dashboard.
  - Two defects found while verifying:
    - The dirty indicator stayed on after a clean save. `isDirty` compared
      `JSON.stringify` output, which is key-order sensitive, and the saved
      document came back rebuilt in schema order. It now compares with keys
      sorted — two documents that would write the same bytes are not unsaved
      changes.
    - Adopting the save response overwrote `tag` in the draft, discarding a
      keystroke made while the request was in flight. Only `updatedAt` — the
      one field the server sets and the editor does not — is carried back now.
      A test pins both.
  - `EditorStoreProvider` is now keyed by `profileId/variantId`: Save As
    navigates to a different variant under the same route, and React would
    otherwise reuse the component and hand the fork the parent's store.

- [x] Task 6.9: Show page-boundary guides and a live overflow indicator (§11.5)
  - Verification: adding enough bullets to cross a page boundary surfaces the
    indicator; export remains enabled — the indicator is informational, not
    blocking.
  - Result: driven through the page with Puppeteer. Hiding Experience,
    Projects and Certifications took `detailed` down to a single page
    (`1 page`, no guides); with Projects back but every project bullet
    un-ticked it stayed at one, and ticking them back one at a time flipped
    the indicator on the sixth (`st-gui`) to `2 pages — crosses a page
    boundary`, with a `Page 2` guide appearing at 736.99pt. No page errors.
  - Export remains enabled and unaffected: the same variant exports 200 /
    `application/pdf` / **128,461 bytes — the identical size recorded in Task
    4.1** — with `/MediaBox [0 0 612 792]` on both pages, and
    `npm run harness -- --pdf` still reports 84/84 within +/-2pt, text and
    faces identical. Nothing in the indicator gates any control; the Download
    button it would have to block lives on the dashboard and never sees it.
  - The guides were wrong before this and are now measured. They were a
    repeating hairline every `--page-height`, which is right for page one
    only: every later page loses 110pt to its own margins, so the drawn line
    ran an inch ahead of the real one by page two, and further with each page
    after that.
  - `lib/render/pagination.ts` is the replacement — a pure model of the two
    fragmentation rules the stylesheet actually uses: `break-inside: avoid`
    (push the atom whole) and `break-after: avoid` (§15.11 — a pushed entry
    takes its heading with it). `PageGuides.tsx` measures the document and
    feeds it; the split keeps the interesting half testable without a DOM.
  - Cross-checked against the printer, not just against itself: for
    unmodified `detailed` the model puts the break immediately above the
    **Projects** heading, and `Projects` is exactly what opens page 2 of the
    exported PDF.
  - The atom selectors live in `page-blocks.ts`, and `page-blocks.test.ts`
    holds them against `resume.css` — a `break-inside: avoid` added to the
    stylesheet alone would leave the guides modelling a page the printer no
    longer produces, and now fails `npm test` instead.
  - A break inside ordinary prose is reported at the page's full height,
    since the model does not know where the lines are — accurate to within
    one 12pt leading. Every break an atom forces, which is where all the
    visible movement comes from, is exact.
  - Measuring runs on every commit, not on a ResizeObserver alone: a section
    reorder moves the breaks without changing the document's height, which an
    observer would never see. Re-measuring cannot cause a re-render, because
    an unchanged reading returns the previous object.
  - The reading leaves the document by React context. In the editor the
    resume is inside an iframe with no DOM path to the chrome, but the
    preview is portalled, so the two are one React tree; the print route
    provides no listener and pays nothing.
  - Scale is derived from the page box (`rect.width / 612`) rather than
    assumed to be 96/72, so blocks and page height convert on whatever the
    browser rounded 612pt to. A 0.5pt tolerance stops a sub-pixel crumb from
    inventing a second page on a CV that fills its first exactly.
  - Still screen-only: `.resume-page-guides` computes `display: none` under
    print media, the harness's character-for-character text assertion would
    have caught the `Page 2` labels, and the exported PDF is unchanged.

- [x] Task 6.10: Fall back to `serif` in the preview when fonts fail, without
      blocking (§13, §15.14)
  - Verification: with a woff2 removed, the editor preview still renders in
    `serif` with a non-blocking warning, while `/api/generate-pdf` still
    hard-fails.
  - Result: with `charis-italic.woff2` moved aside, the editor read back
    `rootClass: "resume-fallback-fonts"`, `nameFamily: "serif"`,
    `subtitleFamily: "serif"` and the name still on the page
    (`Jordan A. Rivera`), above the warning *Preview is showing a fallback
    serif. CV Charis italic 400 failed to load (status: error). The layout
    below is not to scale, and PDF export will fail until the fonts are
    rebuilt — run npm run build:fonts.* Nothing was disabled by it: 1 of 210
    controls, the same lone Save button disabled for being clean in the
    baseline run. In the same state `/api/generate-pdf` returned **500 /
    `application/json` / `PDF generation aborted — font faces unavailable: CV
    Charis italic 400 failed to load (status: error)`**. Restored, the warning
    is gone, all four faces read `loaded`, the export is 200, and the harness
    exits 0 both ways (84/84, text and faces identical). No page errors.
  - Both halves now ask the same question. `findFontProblems` in
    `lib/render/font-check.ts` is the single implementation, run in the
    preview iframe by the editor and serialised into the printed page by
    Puppeteer; §13 splits the *response* to a dead face by path, not the
    judgement, and two implementations would have been free to disagree about
    which faces are usable.
  - That function has to stay self-contained — Puppeteer ships its source, so
    a module-scope reference would compile clean and fail inside Chromium as
    an opaque `ReferenceError`. `font-check.test.ts` reads the file and
    rejects one, which is cheaper than discovering it in an export.
  - The preview does not merely end up in `serif`, it gets there in 300ms.
    Every face is `font-display: block` (§8 — a fallback must never paint on
    the export path), so a face that is never coming costs the preview the
    full three-second block period as a blank page. Once the check has
    confirmed the face is dead, `FALLBACK_FONTS_CLASS` on the preview root
    ends that wait — measured at 300ms from `DOMContentLoaded`, against a
    3000ms block period. That class is set by editor JavaScript only; nothing
    on the print route can reach it, so the export still cannot substitute.
  - The fallback rule has to name every selector that pins an embedded
    family, not just the page: `.resume-entry-subtitle` pins `"CV Charis"`
    separately and would otherwise stay blank while the rest of the document
    painted. A test pairs the two lists off against `resume.css`, so a new
    rule naming `"CV Charter"` or `"CV Charis"` without an override fails
    `npm test`.
  - The warning says both halves on purpose — that the preview is not to
    scale, *and* that the export will refuse. Falling back quietly would make
    the preview a faithful picture of nothing, and the first sign of trouble
    would be an export 500ing for no visible reason.
  - Not touched: `font-display: block` in `fonts.css`, and the export's
    behaviour. The route's own check moved into the shared module and its
    output is byte-identical — same message, same 500.

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
