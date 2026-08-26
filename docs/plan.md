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

- [x] Task 7.1: Build the library browser screen, separate from the variant editor
  - Verification: `/library/jordan-rivera` lists every library item grouped by
    type with its ID and tags.
  - Result: the route returns 200 and renders all ten collections — About Me,
    Core Competencies, Experience, Projects, Education, Technical Skills,
    Certifications, Recommendations, Languages, Custom Sections. Every one of
    the **81 IDs in `content-library.json` appears on the page**, compared
    set-for-set against the file rather than counted by eye; nothing is
    missing. Tags render as chips, verified on a scratch profile carrying
    them at both levels (`backend`, `iot` on a competency, `ml` on a bullet),
    since the seed library has none yet. `npx tsc --noEmit` passes.
  - `lib/data/library-index.ts` is the one shape all four remaining tasks
    edit through: each collection becomes a group, each item a `LibraryItem`
    with its ID, tags and editable fields. Uniform rows are what let one set
    of controls edit, tag and delete twelve different item types.
  - Bullets and skills nest under the entry they belong to rather than
    forming a flat list of every bullet in the profile — a bullet's text only
    means anything next to the job it describes, and this screen exists to
    decide whether an item is still worth keeping.
  - The editable field list per kind is held against the Zod schemas by
    `library-index.test.ts`: every schema field must be offered except `id`,
    `tags` and the nested arrays. A field added to `content-library.json` that
    the manager cannot reach would otherwise be stored, rendered and
    permanently uneditable — `repoUrl`, `demoUrl` and `credentialUrl` are
    exactly that case today (§12.6 says to fill them in from here).
  - Empty collections still render. A group that vanished with its last item
    would leave nowhere to look for what used to be there.
  - `components/library/**` is registered as a Tailwind source and added to
    `check:tailwind-scope`'s probes, so the new directory is covered by the
    same §7 guarantee the editor is — and `components/resume/**` still
    generates nothing.

- [x] Task 7.2: Implement edit-with-propagation (§11.4)
  - Verification: editing a bullet's text updates `content-library.json` and
    every variant referencing that ID renders the new text — verified by
    re-rendering a second variant that shares the bullet.
  - Result: driven through the page with Puppeteer against a throwaway
    `zz-lib-scratch` profile holding **two variants that reference the same
    bullet id**. Opening `bullet-shared`, replacing its text and pressing Save
    took the file from `ORIGINAL SHARED TEXT` to `REWRITTEN VIA LIBRARY
    MANAGER`; re-rendering both variants gave 200 each with the new text
    present and the old text **absent in both** — the second one was never
    opened or edited. The bullet kept its id and its `["ml"]` tags, and its
    sibling bullet was untouched. No page errors.
  - Propagation is not a mechanism this task builds — it is what follows from
    a variant holding IDs and no text (§6.2). Rewriting the library *is* the
    whole operation, which is why nothing here touches a variant file.
  - The action re-reads the library, applies one pure edit and writes it back,
    rather than accepting a whole library from the client the way the editor's
    Save does. This screen changes one item at a time, and posting the entire
    file back would let a tab left open overwrite an edit made in the variant
    editor since it loaded.
  - `updateItemFields` writes only the fields `ITEM_FIELDS` declares for that
    kind, so a stray key cannot introduce one the schema rejects, and a key
    the form did not post leaves its field alone rather than blanking it. A
    blank link is written as `null`, not `""` — §6.4's URL fields are nullable
    and the schema rejects an empty string, so clearing one has to mean absent.
  - `mapLibraryItems` is one traversal over all twelve item kinds, children
    before parents, with the result re-parsed through the schema before it is
    returned. Fork, tagging and delete are all written against it, so an
    unwritable library fails in the pure layer with the offending field named
    rather than at the store.
  - Editing an id no item carries throws rather than silently succeeding —
    a no-op save that reports success is how a stale row quietly loses an edit.
  - Rows are collapsed by default: the library holds every bullet the person
    has ever written, and expanding all of them would bury the list this
    screen exists to scan.

- [x] Task 7.3: Implement "Fork this bullet" (§11.4)
  - Verification: forking creates a new library item with a new ID, repoints only
    the currently open variant at it, and leaves other variants on the original.
  - Result: driven through the page with Puppeteer on `zz-lib-scratch`, whose
    two variants both referenced `bullet-shared`. Forking from `?variant=alpha`
    put a second bullet `bullet-gklqja` in the library carrying a copy of the
    text, moved **alpha's** reference to it, and left **beta** on
    `bullet-shared` — file-for-file, `alpha` reads `[bullet-gklqja,
    bullet-solo]` and `beta` still reads `[bullet-shared, bullet-solo]`.
    Rewriting the fork afterwards then showed the split doing its job: alpha
    renders the new wording and not the old, beta renders the old and not the
    new. No page errors.
  - "The currently open variant" is carried in the URL, not guessed. The
    editor's header now links to `?variant=<open variant>`, and the manager
    shows that selection in a scope control — so the variant a fork repoints is
    stated on screen rather than inferred from where the user came from.
    Browsing and editing stay library-wide regardless: an edit reaches every
    variant (§11.4) whatever is selected here.
  - With no variant selected the Fork button is disabled with the reason next
    to it, rather than hidden. An absent button reads as "this item cannot be
    forked", which is the wrong lesson. The same applies when the selected
    variant does not reference the item — there is nothing to repoint, and the
    server re-checks that rather than trusting the disabled state.
  - The copy is inserted immediately after the original, not appended. Library
    order is what the editor's "not in this variant" list shows (§15.3), and a
    fork at the bottom of a long list would read as an unrelated new item
    instead of a sibling wording.
  - Forking an *entry* forks its bullets too, each with its own new ID.
    Sharing them would leave the fork only half independent — an edit to one
    of those bullets would propagate straight back into the variant the fork
    was meant to diverge from.
  - The variant is written before the library. If that write fails nothing has
    happened; the other order would leave an unreferenced copy behind — the
    orphaned cruft §7's manager exists to clean up (Task 7.5).
  - `variant-refs.ts` holds both the reference walk and the swap, and its test
    asserts the fixture covers **every** section type in `SECTION_TYPES`. A
    type handled by the schema but missed here would make a fork silently drop
    a reference, and would make Task 7.5 report a live item as an orphan.
  - New IDs are checked against the whole library *and* against each other
    within one fork, so a forked entry's bullets cannot collide with the copy,
    the original, or one another.

- [x] Task 7.4: Implement tagging on library items (§6.1)
  - Verification: adding a tag persists to the item's `tags` array and the
    browser can filter by it.
  - Result: driven through the page with Puppeteer. Typing
    `" Backend , iot,backend "` on `proj-zz` and saving wrote
    `["backend","iot"]` to the item's `tags` array on disk, leaving its title
    and every other field untouched. The filter bar then offered
    `all / backend / iot / ml`, built from what the library actually carries;
    `?tag=backend` narrowed 7 rows to `[comp-tagged, proj-zz]` ("2 items
    tagged backend"), `?tag=ml` to `[exp-shared, bullet-shared,
    bullet-gklqja]`, and `?tag=nope` to none. No page errors.
  - Tags are normalised on the way in — lowercased, trimmed, de-duplicated,
    in the order typed. `Backend`, `backend ` and `backend` being three
    different tags would split every filter three ways, and §6.1 wants these
    for AI drafting too, where a near-miss is silently worse.
  - They ride along with the item's text on one Save rather than having a
    button of their own: they are one property of one item, and two save
    buttons on a row leaves the person guessing which one they just pressed.
    They stay out of `ITEM_FIELDS` regardless — they are universal, not
    per-kind, which is what `EXCLUDED_FIELDS` records.
  - Filtering keeps a parent whose *child* matched. A bullet is only reachable
    through the entry it hangs off, so dropping unmatched parents would hide
    every bullet-level result — visible above as `ml` keeping `exp-shared`,
    which carries no tag itself. A parent that matched on its own shows only
    its matching children, so no row appears that the tag does not apply to.
  - The filter lives in the URL and each chip carries `?variant=` through, so
    filtering does not silently drop the fork scope — verified: selecting
    `alpha` then filtering left the scope control still reading `alpha`.
  - An unknown tag filters to nothing and says so, rather than falling back to
    the unfiltered library as though the filter had not applied.

- [x] Task 7.5: Implement orphan detection and delete
  - Verification: an item referenced by no variant is flagged as orphaned;
    deleting it removes it from `content-library.json`, and deletion of a
    referenced item is blocked with a message naming the referencing variants.
  - Result: driven through the page with Puppeteer on `zz-lib-scratch`, with a
    `comp-orphaned` item added that no variant referenced. The page reported
    *8 items across 10 types, referenced by 2 variants. 4 orphaned* and
    flagged exactly those four rows. Deleting `comp-orphaned` removed it from
    `content-library.json` (competencies went `[comp-tagged, comp-orphaned]`
    → `[comp-tagged]`) and the row disappeared, the count dropping to 3
    orphaned. Deleting the referenced `bullet-solo` was **refused** with
    *"Still used by alpha, beta — remove it there first, or fork it."*, and
    the bullet is still on disk. Both variants still render 200. No page
    errors.
  - The block names the variants, in the confirmation *and* in the server's
    refusal. "Cannot delete" without them leaves the person opening every
    variant to find out which one is holding it.
  - Deleting anyway would not merely lose a line: the resolver refuses a
    variant naming an ID the library lacks (§13), so those CVs would stop
    rendering altogether. The check therefore lives on the server, not in the
    disabled state of a button a stale page could talk past.
  - Nested IDs are checked with the item. Removing an entry takes its bullets
    with it, and a variant naming one of *those* would break identically —
    a test pins that `exp-used`'s block comes from its bullet, not itself.
  - **A hidden section's references still count.** Verified as a real
    behaviour, not an assumption: `resolveVariant` filters `visible: false`
    sections *before* resolving, so a dangling reference under one does not
    throw today — but it does the moment the section is switched back on, and
    §12.2 makes a hidden section curation the person chose. Counting them is
    the conservative reading, and the test asserts both halves.
  - A bullet is judged on its own reference, not its parent's: a variant that
    includes a job but drops one of its bullets leaves that bullet orphaned,
    which is exactly the wording §11.4's propagating edits leave behind.
  - An unreadable variant blocks deletion entirely, with its name. Skipping it
    would silently widen the orphan set to include everything it was using,
    and the first symptom would be a deleted item breaking a CV that had been
    fine.
  - Phase gate: `npm test` 240/240, `npx tsc --noEmit` clean,
    `npm run check:tailwind-scope` passing on all three probes, and
    `npm run harness` still **84/84 within ±2pt, 59 exact, text and faces
    identical** — the library manager changed nothing about what renders.
    The scratch profile was removed; `data/profiles/` is unchanged.

---

## Phase 8 — n8n integration (§10)

- [x] Task 8.1: Expose a variant-write API endpoint for external drafting
  - Verification: `POST /api/variants` with a schema-valid body creates a variant
    file and returns its id; a body with a dangling library ID returns 400 with
    the offending ID named.
  - Result: green — `app/api/variants/route.test.ts`, 10 cases against a real
    temp profile. A valid draft writes a file that reads back through
    `variantSchema` and returns `{ variantId, editPath, exportPath }`; a draft
    naming `about-invented` and `comp-madeup` returns 400 with both in
    `unknownIds` and nothing on disk.
  - `danglingRefs` (in `lib/data/variant-refs.ts`) reports *all* unknown ids at
    once rather than throwing on the first, the way `resolveVariant` does — a
    model that has invented content usually invents several things, and one per
    round trip wastes a round trip each time.
  - Also rejected: a real id in the wrong slot (caught by resolving before the
    write, so a stored draft always renders), an unknown key (the variant schema
    is strict), an id that would escape the profiles directory, and a second
    write over an existing variant (409 — `overwrite: true` replaces it
    deliberately). `CV_API_TOKEN`, when set, gates the whole endpoint; unset,
    the endpoint is as open as the rest of the app (§9).
  - `GET /api/library` came with it: the workflow's "fetch the library" step
    (§10 step 2) needs an HTTP surface, since n8n need not share the disk.

- [ ] Task 8.2: Build the n8n workflow — webhook → fetch library → LLM draft →
      save → render → email
  - **Left to the user** — the workflow JSON is written and committed
    (`n8n/cv-draft-workflow.json`, 8 nodes, importable), but verifying it needs
    an n8n instance, an Anthropic API key and an SMTP credential, none of which
    live in this repo. Import it, fill in the two credentials and the `baseUrl`
    in the Config node, then run the verification below.
  - Verification: posting
    `{ profileId, variantId, targetRole, jobDescription, notifyEmail }` to the
    webhook results in a new variant on disk and a PDF delivered to
    `notifyEmail`.

- [x] Task 8.3: Constrain the LLM system prompt to selection and reordering only (§10)
  - Verification: the prompt explicitly forbids inventing experience, metrics, or
    skills; a test run against an unrelated job description produces a variant
    whose every referenced ID already exists in the library — asserted
    programmatically, not by eye.
  - Result: prompt half green, live-run half deferred. `lib/n8n/prompt.ts`
    holds `DRAFT_SYSTEM_PROMPT` and `libraryDigest`; `prompt.test.ts` asserts
    the prohibition is present in so many words — no inventing experience,
    metrics or skills, no rewriting wording — and that the digest offers
    exactly `libraryIds(library)`, no more and no less. A section type the
    schema defines but the prompt never describes is also a failure: the
    drafter would silently never use it.
  - The programmatic assertion §10 asks for is enforced on every write, not
    just in a test: `POST /api/variants` rejects a draft naming an unknown id
    (Task 8.1). A prompt is a request; the endpoint is where it is settled.
  - Deferred: the live run against an unrelated job description needs an
    Anthropic key and a running n8n, so it belongs with Task 8.2.

- [x] Task 8.4: Document the n8n setup
  - Verification: `docs/n8n.md` records the webhook payload, the node sequence,
    and the exported workflow JSON path.
  - Result: green — all three, plus the two endpoints' request and response
    shapes, the credentials to attach, and the `CV_API_TOKEN` guard for running
    n8n off-machine. The workflow is at `n8n/cv-draft-workflow.json`.
  - `README.md` now points at it, and its "no authentication" section names
    `CV_API_TOKEN` as the single exception.

---

## Phase 9 — Polish

- [x] Task 9.1: Complete the §13 error-handling table end to end
  - Verification: each of the five rows in §13 is exercised manually or by test
    and behaves as specified; failures surface as toasts, never silently.
  - Result: all five rows exercised, all green. `npm run check:errors` reports
    **15/15** against a running dev server (rows 1, 2, 4, 5 in the browser);
    `app/api/generate-pdf/route.test.ts` adds 11 route-level cases for rows 1,
    2 and 4; `npm test` is 251/251 across 25 files, `eslint` and `tsc --noEmit`
    both clean, and `npm run harness:export` still exits 0 (84/84 lines within
    ±2pt, text and faces identical) — the behaviour under test is unchanged.
  - Row 1 (Puppeteer fails): the route returns 500 with the reason in `{error}`
    on both a failed launch and a render that dies mid-`goto`, closes Chromium
    on the failing path, and the dashboard shows it verbatim — the driven
    click produced the toast `PDF generation failed: Failed to launch the
    browser process`.
  - Row 2 (fonts): the export never reaches `page.pdf()` when a face is
    unusable and names every failing face in the 500. With `*.woff2` blocked at
    the browser, the preview showed the amber warning naming all four faces,
    set `resume-fallback-fonts`, painted `Jordan A. Rivera` in `serif`, and
    left the editor and its Save control fully usable — §13's split, both
    halves, from one shared check.
  - Row 3 (empty section): already covered exactly by
    `ResumeSectionBody.test.tsx`, which renders all ten section types curated
    down to nothing and asserts heading-without-body. Not duplicated in the
    browser script — ten types beats one live click.
  - Row 4 (bad ids): 404 for an unknown profile, an unknown variant and an id
    the store rejects; the export endpoint 404s with a message rather than a
    blank body, and resolves before launching Chromium, so a typo costs a file
    read. A file that exists but does not parse stays a 500 — only *missing*
    maps to 404.
  - Row 5 (export in progress): idle → `{disabled: false, aria-busy: false,
    spinner: false}`, in flight → `{"Generating…", disabled, aria-busy,
    spinner}`, then back to rest; a second click while disabled issued **no**
    second request to `/api/generate-pdf`.
  - Faults are injected client-side — the export request answered by a stub,
    the woff2s blocked via CDP — so the script runs against an ordinary
    `npm run dev` with no test-only branch in production code, and nothing is
    left renamed on disk afterwards the way the Task 5.5 check needed.
  - The route's failure branches are unreachable from a live server without a
    browser that breaks on demand, hence `vi.mock("puppeteer")` for rows 1 and
    2 rather than a second harness flag. `vitest.config.mts` now includes
    `app/**/*.test.ts?(x)`, which nothing matched before.
  - Noted, not changed: a 404 from the export endpoint carries the absolute
    path of the missing variant file into the toast. Harmless on a
    localhost-only, no-auth tool (§9) and useful while working, but it is the
    one place the UI shows a filesystem path.

- [x] Task 9.2: Add loading states across dashboard, editor, and library manager
  - Verification: every async action shows a pending state and no action can be
    double-submitted.
  - Result: `npm run check:pending` reports **19/19** driving a real server —
    every action sampled mid-flight, every one of them locked, and every
    "second click while busy" produced exactly **1 POST**. `npm test` 251/251,
    `eslint` and `tsc --noEmit` clean, `npm run check:errors` still 15/15,
    `npm run check:tailwind-scope` still passes, and the harness is unchanged
    at 84/84 within ±2pt with identical text and faces.
  - Server actions already had pending states from their own tasks; what was
    missing was everything *navigational*. Every screen is `force-dynamic` and
    reads off disk, so View, Edit, Library, the tag chips and the fork scope
    were all real round trips that looked like clicks that did nothing.
  - Two mechanisms, deliberately: `loading.tsx` for the dashboard, the editor
    and the manager gives the destination's shape once the navigation commits;
    `PendingLink` (`useLinkStatus`) covers the moment *before* that, which is
    exactly when the impatient second click lands. The editor's skeleton
    matches `EditorShell`'s two-column ratio and reserves a page-shaped block,
    so nothing jumps when the real preview arrives.
  - `VariantScope` became a client component: Apply now pushes through
    `useTransition`, so it reads "Applying…" and is disabled until the new page
    has rendered. It also carries `?tag=` through, which the old plain GET form
    silently dropped — a bug found by writing the check, not by reading it.
  - `aria-busy` added to every server-action submit (New profile, Rename,
    Delete, item Save, Fork, item Delete, editor Save). The visual pending
    state was already there; this is the half a screen reader gets.
  - The check slows requests with CDP latency rather than a stubbed `fetch`, so
    what is measured is the real navigation and the real server action, and
    counts clicks from `Network.requestWillBeSent` — a double submit shows up
    regardless of how the client sent it. `scripts/lib/chrome.mjs` gained an
    `on()` subscription for that; `once()` cannot count.
  - Mutating checks create, rename and delete a throwaway profile
    (`pending-check-tmp`) and nothing else. Verified against a dev server run
    with `CV_PROFILES_DIR` pointing at a scratch copy, so `data/profiles/` was
    never in reach — `git status` confirms it untouched.
  - Clicks fired before hydration submit the *form* — a plain GET that reloads
    the page and measures nothing. The check waits for `window.next` and
    `readyState === "complete"` first; without that the create step silently
    did nothing and the run looked like a bug in the button.

- [x] Task 9.3: Write the project `README.md`
  - Verification: covers setup, the font build step, `npm run dev`,
    `npm run harness`, the data layout under `data/profiles/`, and the
    localhost-only / no-auth caveat from §9.
  - Result: all six covered. The no-auth caveat leads the document, directly
    under the intro, rather than sitting in a footnote — it is the one thing a
    reader has to know before they run anything.
  - Every command in it was run while writing: `npm install`, `build:fonts`,
    `dev`, `harness` and `harness:export` (84/84, text and faces identical),
    `test` (251/251), `lint`, `tsc --noEmit`, `validate:data`,
    `check:tailwind-scope`. Route table, script list and schema description
    are read off the code, not off the spec.
  - `npm run harness` needs a dev server on :3000 and says so with the two
    terminals spelled out. Run without one it does not error usefully — it
    prints Next's 404 page to PDF and reports eight unpaired lines in Segoe
    UI, which reads as catastrophic drift rather than as "nothing is
    listening".
  - Documents what is *not* there as well: `theme.json` is reserved by §9 and
    read by nothing, and `extract:golden` needs the gitignored reference PDFs,
    so the goldens are regenerable only by someone holding them.
  - `CV_PROFILES_DIR` is written up next to the two mutating browser checks,
    since pointing it at a scratch copy is the difference between running
    `check:pending` and letting it near real profile data.

- [x] Task 9.4: Re-run the full harness and test suite as a release gate
  - Verification: `npm test` and `npm run harness` both exit 0 on a clean
    checkout after `npm install` followed by `node scripts/build-fonts.mjs`.
  - Result: green — but only after two real defects the gate existed to find.
    On a fresh clone: `npm install` 0, `build-fonts` 0 (4 faces), `npm test`
    **251/251**, `harness` and `harness:export` both **84/84** within ±2pt with
    text and faces identical, and every other check clean —
    `lint`, `tsc --noEmit`, `validate:data`, `check:tailwind-scope`,
    `check:errors` **15/15**, `check:pending` **19/19**, `next build` 0.
  - **Defect 1 — a clean checkout failed `npm test`.** Git for Windows
    defaults to `core.autocrlf=true` and the repo had no `.gitattributes`, so
    a fresh clone arrives with CRLF while every generator here writes `
`.
    `css-variables.test.ts` compares the committed `resume.css` against
    regenerated text byte for byte, so it failed with a diff of two lines that
    look identical — the worst possible first impression, and invisible in
    this working tree, whose files were written LF by hand. `.gitattributes`
    now pins the checkout to `* text=auto eol=lf`, with the three binary types
    excluded. Nothing else moved; the tree is already LF, so the change causes
    no churn.
  - **Defect 2 — `check:errors` was flaky, 12/15 on three runs in five.** Not
    the app: the script clicked the Download button as soon as
    `Page.loadEventFired` arrived, and the button is server-rendered, so
    before hydration the click is inert. The whole sequence then measured the
    *next* click — reporting an idle button "in flight" and a busy one
    "afterwards", with a null toast. This is the same bug Task 9.2 fixed in
    `check-pending.mjs`; `check-errors.mjs` never got the treatment. It now
    waits for `window.next` and `readyState === "complete"`: five consecutive
    15/15 runs after the fix.
  - Noted, not changed: saving any library item rewrites the file through the
    schema, which materialises defaulted `tags: []` on every item that omitted
    it. Semantically identical and it round-trips, but the first save after
    this turns a one-field edit into a 112-line diff. `check:pending` does
    exactly that, which is why it wants `CV_PROFILES_DIR` pointed at a scratch
    copy.
  - Noted, not changed: `next build` warns that `readdir(profilesRoot())` is a
    dynamic filesystem access and traces the whole project into the output.
    That warning is about deployment bundle size; this app is self-hosted and
    runs from its own checkout (§9), and the path is dynamic on purpose so
    `CV_PROFILES_DIR` works.
  - The gate ran against a real `git clone` of the repo, not this working
    tree, with the two pending fixes applied and re-checked-out so the
    `.gitattributes` conversion actually took effect. `data/profiles/` in this
    tree was never in reach — the mutating checks ran inside the clone.

---

## Phase 10 — Header links, entry splitting, and editor UX

Post-release work, raised after Phase 9 closed. Three independent strands:
two are defects the spec's own wording did not intend (10.1, 10.2), the rest
is editor experience, ordered by payoff rather than by spec section.

Two of these amend `SPEC.md` rather than implement it. Neither touches a
measured value, but both need a §15-style resolution entry written *before*
the code, so the spec stays the source of truth for values:
- **§16.6** never gave header links an href. See Task 10.1.
- **§11.5**'s `break-inside: avoid` forbids all entry splits, where its own
  sentence asks only to prevent *awkward* ones. See Task 10.2.

### 10.1 — Header contact details are dead text

- [x] Task 10.1: Make header contact details real links (§5.1, §16.6, §18.1)
  - Verification: a PDF exported from a variant whose header carries an
    email, a LinkedIn, a GitHub and one extra link has a working link
    annotation on each; the printed text of every contact line is
    byte-identical to before the change, and `npm run harness:export` still
    reports 84/84 within ±2pt with text and faces identical.
  - Result: all three hold. Exported from a scratch copy of the profile
    (`CV_PROFILES_DIR`) carrying one extra link, the PDF's page-one header
    holds exactly four Link annotations —
    `mailto:jordan.rivera@example.com`, `https://linkedin.com/in/jordan-rivera`,
    `https://github.com/jordan-rivera-demo`, `https://portfolio.example.com` — each
    boxed to its own text and nothing more. The separators sit in the ~10pt
    gaps between the boxes, so no `|` is clickable.
  - `harness:export` against the real profile: **84/84** within ±2pt, 59
    exact, 25 reflowed, document text identical, faces identical. Also clean:
    `npm test` **328/328** (up from 251 — the header test moved to `.tsx` and
    gained the href and markup cases), `tsc --noEmit`, `lint`,
    `validate:data`, `check:tailwind-scope`.
  - The byte-identical claim is a test, not a one-off reading:
    `ResumeHeader.test.tsx` renders the header, strips every tag, and holds
    the result against `contactLines()` — the function that defines the
    printed text. §18.1 turns entirely on that staying true.
  - §18 is new: a "Post-release resolutions" section for Phase 10's two spec
    amendments, with §18.1 written before any of this code. §5.1's `links[]`
    line was updated to `{ id, text, url }` alongside it.
  - The named fields derive their href and gain no schema field, so every
    profile on disk stays valid untouched. `links[]` gains `url`, defaulting
    to `null` — which renders exactly as it did before, so no profile needs
    rewriting either. As with `tags`, the first save after this materialises
    `url: null` on each existing link.
  - Header anchors are `.resume-contact-link` — `text-decoration: none`,
    deliberately unlike `.resume-link`'s underline. The contact line is
    measured against a source PDF that has no underline in it; adding one
    would be a visible change against the document the harness gates on.
  - Both editors gained a URL box next to the link text (editor and library
    manager), normalized on blur rather than on change: prefixing `https://`
    after the first keystroke would rewrite the box under the cursor. A URL
    the schema cannot store is passed through so the save reports it, rather
    than being silently discarded.
  - Not exercised by this run: `tel:`. The detailed variant's header is
    minimal mode, which prints no phone line, so its derivation is covered by
    unit tests rather than by the annotation check.

  Header contact data is display text only. `lib/schema/library.ts:160-169`
  types `email`, `phone`, `linkedin` and `github` as plain `z.string()`, and
  `headerLinkSchema` is `{ id, text }` with no url field at all.
  `ResumeHeader.tsx:36-43` joins them into one string and prints it in a
  `<div>` — there is no `<a>` anywhere in the header. In the exported PDF
  every one of them is dead text, and a URL cannot be supplied today because
  the schema has nowhere to put one.

  The pattern already exists elsewhere: `ResumeProjectLinks.tsx:37` and
  `ResumeCertifications.tsx:30` render real `<a href>` and use `linkLabel()`
  to strip `https://` so the link prints bare while staying clickable.
  Puppeteer emits real PDF link annotations for those. The header never
  adopted it.

  Two halves, both cheap:
  - **Named fields — derive, no schema change.** `email` → `mailto:`,
    `phone` → `tel:`, and `linkedin`/`github` → `https://` + the text when it
    already looks like a host path (`github.com/jordan-rivera-demo`), or
    `https://github.com/` + handle when a bare handle was typed. The printed
    text stays byte-identical, so every §4.1 metric is untouched.
  - **`links[]` — add an explicit optional url.**
    `headerLinkSchema = { id, text, url: optionalUrl }`. A portfolio or Dev.to
    entry cannot be derived from a handle, so it needs a real field.
    `url: null` renders exactly as it does now.

  One constraint: render header anchors `text-decoration: none`, unlike
  `.resume-link` (`resume.css:601-604`), which underlines. Underlining the
  contact line would be a visible change against the reference PDF the
  harness gates on.

  Editor side: the "Other links" row in `SectionCard.tsx:96-119` becomes two
  inputs (Text | URL) with a small "prints as … , links to …" hint.

### 10.2 — A long entry leaves a hole at the foot of the page

- [x] Task 10.2: Let a long entry split across a page break, opt-in (§11.5, §18.2)
  - Verification (revised after the first attempt — see below): a variant with
    `splitEntries` on, whose Experience entry would overrun, fills the page and
    continues overleaf instead of migrating whole; a bullet breaks between its
    own lines and never within one, never leaves or arrives as a single line,
    and no entry head is left as the last thing on a page. With the flag off
    (the default) pagination is byte-identical to today, and both
    `npm run harness` and `npm run harness:export` still report 84/84.
  - **The first implementation was wrong, and the spec was wrong with it.**
    §18.2 originally made each bullet an atom and glued the second-to-last to
    the last so no final bullet could travel alone. On a four-bullet entry
    whose last bullet ran to nine lines, that rule sent the third bullet over
    with the fourth and left ~130pt of blank paper — the exact hole the task
    exists to close, reached by a different route. Refusing to strand a
    nine-line "widow" is not typography. Rewritten: a bullet is prose, with
    `orphans: 2` / `widows: 2`, and the last-bullet glue is gone.
  - Result: verified against real Chromium fragmentation, printing the real
    stylesheet at the real page size:
    - **off** — the whole entry migrates, page 1 left blank below the filler.
    - **on** — heading, head, three bullets and the first two lines of the
      long fourth all stay on page 1, last baseline 59.5pt against a 55pt
      margin. The page is full. B4's remaining lines open page 2.
    - Sweeping the entry's start position, the point at which the head stops
      staying is exactly **head + two lines** — below that the whole chain
      moves rather than stranding the head. That is §18.2's rule, measured.
  - `npm run harness` **84/84** and `npm run harness:export` **84/84**, ±2pt,
    59 exact, 25 reflowed, text and faces identical. `npm test` **334/334**,
    `tsc --noEmit`, `lint` all clean.
  - One thing the plan did not foresee, found by a failing test rather than in
    review: **with bullets as prose, the model could strand a head the printer
    pushes.** `paginate` consults `keepWithNext` only when a following *block*
    overruns, and a split entry has only prose below its head — so nothing
    fired. Fixed in measurement, not in the model: `PagedDocument` reads a
    split head's box as reaching down over the two lines its `orphans` oblige
    it to keep, capped at the first bullet's bottom, which turns the case into
    an ordinary overrun. `pagination.ts` is still untouched, and gained no
    second glue direction.
  - The final rule set is two CSS rules, not four — the head is an unbreakable
    block glued forward, and a bullet carries `orphans`/`widows`. Simpler than
    the plan proposed, and it is the simplification that fixes the bug.
  - **Second correction, from the preview rather than the PDF.** With bullets
    as prose, the preview's page window cut a line of text in half — the top of
    the glyphs on one sheet, the bottom on the next. That is `pagination.ts`'s
    long-standing "a prose break is accurate to within one line's leading",
    which was invisible until §18.2 made prose common. Fixed by measuring: the
    preview now reads each split bullet's line boxes and hands `paginate` the
    offsets that bullet may legally break at, with `orphans`/`widows` already
    applied, so the sheet stack cuts exactly where the printer does. A bullet
    of fewer than four lines reports no legal offset at all, which is how the
    model reproduces the printer moving a short bullet whole.
  - **Third correction, and the worst of the three.** Switching the flag on
    threw the whole document onto page two. `break-after: avoid` glues an
    element to whatever immediately follows it *in the flow*, but `chainTop`
    read any run of glued blocks as one chain — so About Me's heading, glued
    to its own paragraph, was treated as glued to Competencies' heading, and
    so on down. The chain ran from the first heading to the last, and the
    first overrun anywhere pushed everything. Latent before this task, since
    entries carried no glue and terminated every chain; immediate once entry
    heads became glued blocks with only prose between them.
    `FlowBlock.keepWithNext` now means *glued to the next block*, decided in
    `PagedDocument` by asking whether that block sits inside the element's own
    next sibling. Pinned by a test that fails on the old semantics.
  - `paginate` gained one optional input and no new concept: called without
    prose runs it behaves exactly as before, which is what keeps every
    flag-off document's preview unchanged.
  - Verified in a browser this time, not only in the model — a second checkout
    with its own dev server, so the running one was left alone:
    - flag **off**: 3 pages, page 1's window ends at 455.3pt of 682 — a 227pt
      hole. flag **on**: 2 pages, window ends at 678.6pt. The page is full and
      the document is a page shorter.
    - no line box of any bullet, paragraph or competency run straddles the
      page-1 window in either state.
    - the exported PDF agrees: 3 pages off, 2 on, with the long bullet's last
      two lines opening page 2 — `widows: 2`, as specified.
  - Known limitation, pre-existing and unchanged by this task: a section
    heading whose body is a paragraph is glued to prose, and the model cannot
    see prose, so the preview may show such a heading at a page foot where the
    printer would push it. §18.2's head extension covers the entry case only.
  - Both editors are unaffected apart from one checkbox on Experience and
    Projects. Saving a variant now materialises `options.splitEntries: false`,
    as `showTitle` did.

### Tier 1 — the things that actually hurt right now

- [x] Task 10.3: Make fit-to-page feedback actionable (§11.5)
  - Verification: the editor reports remaining space on the last page and the
    amount of overflow past a break, and names the entry a break pushed; the
    readings agree with the sheet stack the preview draws.
  - Result: all three hold, read out of a browser on the real detailed
    variant. The editor reports **“2 pages · Page 2: 144pt free — room for 12
    more lines”**, and under it **“Page 2 holds 538pt, about 45 lines.
    ‘Fleet Drive-Cycle Analysis Toolkit’ moved here whole, leaving 38pt
    at the foot of page 1.”**
  - Agreement is checked against the sheets themselves, not against a second
    model: page one's clip measures 643.7pt of a 682pt page — 38.3pt short,
    the hole reported — and the flow runs to 1181.4pt, so page two holds
    537.8pt and has 144.2pt left. Every printed figure is one of those,
    rounded.
  - It cannot drift, because it is not a second measurement: `paginate` now
    returns a `PageFit` per page alongside the breaks, derived from the breaks
    it just committed to. The report and `pageWindows` read the same numbers.
  - `FlowBlock` gained an optional `label`, and `paginate` records what each
    break moved — the overrunning block's own name, not the chain's, so a
    heading dragged along by `break-after: avoid` does not get the credit for
    an entry that would not fit. Labels are read out of the document
    (`.resume-entry-title`, `.resume-recommendation-name`, a heading's own
    words), so nothing in the markup has a second copy to keep in step.
  - `PageCount.tsx` is gone, replaced by `PageFit.tsx` above the preview —
    beside the sheets it describes rather than up in the page header. Points
    are given in body lines as well, since a line is the unit a bullet is
    edited in. Still purely informational, as §11.5 requires: nothing here
    disables the export or turns red.
  - The one thing this changed in the model's own behaviour: `PagedDocument`
    now compares page fills as well as breaks before it re-renders. Without
    that a one-page CV's gauge would never move, since its break list is empty
    however much text is added.
  - `npm test` **358/358** (up from 334 — 8 page-fill cases plus a new
    `PageFit.test.tsx`), `tsc --noEmit`, `lint`, and `npm run harness`
    **84/84**, text and faces identical. The printed document is untouched:
    nothing outside the editor's chrome and the model's return shape moved.
  - `PageCount.tsx` says "2 pages" and stops. Tailoring a CV is largely a
    fitting problem, and the editor gives a number with no gradient to
    descend. Show *how much* — "page 2 holds 3 lines, 41pt used" — plus a
    space-left gauge on the last page. §11.5 forbids blocking the export on
    overflow; all of this stays informational.

- [x] Task 10.4: Link the form and the preview in both directions
  - Verification: hovering a bullet's field highlights that bullet in the
    preview; clicking a block in the preview scrolls to and focuses its field.
  - Result: both hold, driven in a real browser against a dev server started
    after the stylesheet changed (the editor preview caches resume.css per
    server process, so the running one would have shown the old rules).
    - **hover** — pointing at a bullet's textarea puts `resume-focus` on that
      bullet in the preview, computing to `rgb(253, 234, 168)` with a
      `pointer` cursor, and leaving the row clears it. Two copies are marked,
      not one, which is correct: the stack renders the whole document into
      every sheet and windows it, so the block exists once per sheet and only
      its own page shows it.
    - **click** — clicking that bullet in the preview focuses the TEXTAREA
      carrying the same id, scrolled into view, with the row flashed. Clicking
      an entry head focuses that entry's include checkbox. Clicking
      Education's description — a bullet with no field of its own — focuses
      its entry instead of doing nothing.
    - clicking a real link in the preview no longer takes the iframe to
      `mailto:`/GitHub and leaves the editor previewless.
  - The two sides already shared a vocabulary and nobody had written it down:
    `data-entry` and `data-bullet` are what `EntryCuration` has always put on
    its rows and fields, and the document now carries the same two with the
    same library ids. `components/resume/link-targets.ts` is that vocabulary,
    plus the selector escaping and the reader both sides use.
  - One rename fell out of it: `.resume-entry`'s `data-entry` held the entry
    *kind* (`experience`), which is what resume.css selects the per-section
    bullet indents through. It is now `data-entry-kind`, freeing `data-entry`
    for the id, and a test holds the markup and the stylesheet together so a
    half-done rename cannot quietly change §4.4's measured geometry.
  - Neither direction goes through React state, and that is deliberate:
    `PagedDocument` re-measures on every render, so a hover that re-rendered
    the resume would re-measure the whole document — line boxes included — on
    every pointer move down a long form. The highlight is a class toggled on
    the preview's own nodes, and React never runs for it.
  - Competencies and skills gave up one piece of markup: their separator moved
    out of the item's span and became a sibling text node, so a highlight
    covers the competency and not the pipe in front of it. Same text, same
    order — `harness` and `harness:export` both still report 84/84, document
    text identical.
  - The preview's affordances are gated twice: `@media screen`, and a
    `resume-linked` class the editor sets on its own iframe root. `/render` is
    screen media too, and must keep a document that is only ever printed.
  - Section headings are not linked. A heading has no control of its own —
    what it would jump to is the section card, which is Task 10.10's jump rail
    — and matching one would need a section index threaded through the render
    model, since the resolver drops hidden sections and renumbers.
  - `npm test` **368/368** (up from 358 — 10 new cases over the attributes,
    the selectors and the class names), `tsc --noEmit`, `lint`,
    `npm run harness` **84/84** and `npm run harness:export` **84/84**, text
    and faces identical.
  - The left column is long and controls are currently found by eye. The
    preview is the same React tree fed from the same draft, so the ids to
    match on already exist on both sides.

- [x] Task 10.5: Stop losing the draft on a refresh
  - Verification: with unsaved changes, a reload prompts before leaving; after
    a forced reload the editor offers to restore the draft, and declining
    leaves the on-disk variant untouched.
  - Result: all three hold, driven in a real browser (Puppeteer) against a dev
    server, eleven checks in all:
    - **the prompt** — typing in a field and reloading raises a genuine
      `beforeunload` dialog; the reload only proceeds because the driver
      accepts it.
    - **the offer** — the forced reload comes up on the *file*, with the
      recovered draft offered above both columns rather than applied. Restore
      puts the typed text back, still unsaved, with nothing written to disk.
    - **declining** — Discard removes the copy, does not offer it again on the
      next reload, and leaves `detailed.json` and the content library byte-for
      -byte as they were (both hashed before and after the whole run).
    - and the copy is removed the moment the draft is clean again: Revert
      leaves no key behind for the next session to trip over.
  - The copy is a copy, never a second truth. It is written only while the
    draft is dirty; it is read back through `variantSchema` and
    `contentLibrarySchema`, so corrupt or older-shaped JSON is dropped rather
    than loaded; and it carries the `updatedAt` it was taken against. A copy
    whose base no longer matches disk — n8n wrote, a hand edit landed, another
    tab saved — is discarded unread, because restoring it would silently undo
    that on the next Save. A copy that says nothing the file does not is
    discarded too: that is noise, not a recovery.
  - Reading precedes writing, deliberately. The recovery read happens once on
    mount and the persistence subscription does not start until it is
    answered; the other order would open the editor clean, clear the key, and
    destroy the draft it exists to recover.
  - Persistence subscribes to the vanilla store rather than selecting through
    React (`useEditorStore`, new alongside `useEditor`). A keystroke must not
    re-render the preview, because `PagedDocument` re-measures on every render
    — the same reason Task 10.4's highlight stays out of React state. Writes
    are debounced 400ms.
  - `restore(document)` is `revert`'s mirror: it replaces the draft and leaves
    `saved` — the disk — alone, so the editor comes back dirty against exactly
    the baseline the interrupted session was dirty against. `isDirty` now
    reads through an exported `documentsDiffer`, which is what tells a stored
    copy from the file it was taken against.
  - Every storage failure is the same non-event: no `window`, storage disabled,
    a privacy mode that throws on access, a full quota. The copy is lost, the
    draft in memory is not, and the editor does not notice.
  - Not covered: in-app navigation. `beforeunload` guards reloads and closed
    tabs, but clicking Dashboard or Library is a client-side route change the
    browser never sees. The draft survives it in `localStorage` and is offered
    back on return, so nothing is lost — there is simply no prompt. A router
    guard belongs with Task 10.12's shortcuts, not here.
  - `npm test` **376/376** (up from 368 — 8 cases over the stored record, its
    validation, its staleness rules and `restore`), `tsc --noEmit`, `lint`,
    and `npm run harness` **84/84**, text and faces identical. Nothing outside
    the editor's chrome moved.

- [x] Task 10.6: Add undo/redo (Ctrl+Z / Ctrl+Y)
  - Verification: every store mutation is undoable and redoable in order, and
    undo past the last save leaves the dirty flag correct.
  - Result: both hold.
    - **every mutation** is checked literally rather than by sampling:
      `undo-redo.test.ts` lists one call of each action and asserts that list
      equals the store's own function surface minus `markSaved`, `undo` and
      `redo`. All 28 are driven in sequence, each undone back onto the exact
      document that preceded it and then redone onto the exact document that
      followed — and each is asserted to have changed something, so a step
      that silently did nothing cannot pass as undone.
    - **across a save**: `markSaved` adds no step, undo goes back past it and
      the indicator reads unsaved, and the redo lands on the saved document
      *with the server's stamp*, reading Saved again.
    - and in a real browser (Puppeteer, 13/13): Ctrl+Z with the cursor still
      in a text field, Ctrl+Y and Ctrl+Shift+Z for redo, the buttons undoing a
      section toggle, both disabling themselves at the ends of the stack, and
      nothing reaching disk throughout.
  - The history is a list of whole documents, not of inverse operations. The
    draft is already one immutable value, so a step is the value that preceded
    it and every action — keystroke, toggle, drag, add, remove — is undone the
    same way. There is nothing a new action has to remember to do to be
    undoable, which is what the completeness test above is really checking.
  - Recording happens outside the actions, not inside them: `createEditorStore`
    now wraps zustand's `set`, comparing the draft before and after and
    pushing the old one. `markSaved`, `undo` and `redo` take the raw `set` and
    so stay off the stack — a save is not an edit.
  - Consecutive edits to the *same* field within 600ms coalesce into one step,
    keyed by a `tag` the text writers pass (`bullet:experience/exp-1/b1`,
    `header:email`, …). Typing a word is one Ctrl+Z, not eleven; a toggle or a
    reorder is untagged and always its own step, however fast two of them
    arrive. The stack is capped at 100.
  - A history entry is a whole document, so undoing across a save would drag
    the old `updatedAt` back with it and leave a redone draft comparing unequal
    to the disk it matches. `withCurrentStamp` carries the live stamp onto
    every restored document — the same reasoning as `markSaved`'s.
  - `revert` and `restore` are recorded, deliberately: throwing a session away
    and adopting a recovered one are the two edits it would hurt most to have
    made by accident. Undo now gets a session back out of Revert.
  - The keys are taken even while a text field has focus, and Ctrl+Z is
    `preventDefault`ed there. A bullet's field is a view of the draft, not a
    document of its own: the browser's own undo would put text back in one box
    while the preview, the crash copy and the dirty indicator carried on from
    the store. One history, one Ctrl+Z. Ctrl+Y and Ctrl+Shift+Z both redo, and
    Cmd works for Ctrl throughout.
  - Buttons sit beside the save controls, disabled at the ends of the stack —
    a shortcut nobody can see is a shortcut nobody uses, and the disabled
    states are the only place the editor says how far back it can go.
  - `npm test` **390/390** (up from 376 — 8 cases over the history itself, 6
    over the store), `tsc --noEmit`, `lint`, and `npm run harness` **84/84**,
    text and faces identical.

### Tier 2 — speed of tailoring

- [x] Task 10.7: Use tags in the editor (§6.1)
  - Verification: a section can include or exclude every entry carrying a
    given tag in one action, and the result is an ordinary curation edit no
    different from ticking the boxes by hand.
  - Result: both hold.
    - **one action**: each curated section now carries a row of tag chips, one
      per tag its own content uses, each with `+` and `−` and a live `n/m`
      count. One press curates everything the tag names.
    - **no different by hand** is checked literally rather than by sampling:
      for five tag/direction pairs across three section types, a store driven
      by the bulk action is compared whole against a second store driven
      through `setEntryIncluded` and `setBulletIncluded` over the same IDs. The
      drafts must be equal, not merely similar.
    - and in a real browser (CDP, 10/10) against the real profile: the chips
      render with the counts the library actually produces, one click clears
      six competencies at once and the chip drops to `0/6`, include-all puts
      back exactly what exclude-all took, one Ctrl+Z undoes the lot, and both
      files are hashed before and after to confirm nothing reached disk.
  - **Both curated levels, not just entries** — which the real library forced.
    Of the 25 tagged items on `jordan-rivera`, 16 sit on *bullets*; only Core
    Competencies is tagged at entry level. An entry-level-only action would
    have rendered inert chips on Experience and Projects, the two sections
    tailoring spends its time in. A tag is wherever the person put it.
  - The two levels resolve in one order: entries first, then bullets inside
    whatever the section includes *after* that pass. So a press can pull an
    entry in and curate its bullets in the same action — and a tagged bullet
    inside an *excluded* entry is left alone, because an action that silently
    adds a job to the CV is not the one the button offers. An entry joins the
    variant only when the entry itself is tagged.
  - `tags.ts` resolves; it never writes. The store's `setTaggedIncluded` folds
    `includeEntry` and `includeBullet` — the same functions the checkboxes
    call — over the resolved IDs, which is why a re-included entry still comes
    back with its saved bullet curation and in its library position (§15.3)
    rather than at the bottom of the section.
  - One `set`, so one undo step: it was one decision. `− backend` followed by
    Ctrl+Z is not six undos.
  - Chips are scoped per section, not offered once for the whole variant. A
    tag means something different in Experience than in Projects, the counts
    only make sense against one list, and a global press would reach sections
    the person is not looking at. A tag naming nothing in a section is not
    shown there at all.
  - The count is the affordance: `3/5` says what the button will do before it
    does it, and is what lets each action disable itself at its end rather
    than push an empty step. It moves as the section does — pulling a job in
    brings its tagged bullets into scope, so `2/2` can become `2/7`. That is
    the honest reading; those bullets were genuinely not on the CV before.
  - `npm test` **402/402** (up from 390 — 12 cases over the resolver, the two
    levels, the by-hand equivalence and the single undo step), `tsc --noEmit`,
    `lint`, and `npm run harness` **84/84** and `npm run harness:export`
    **84/84**, text and faces identical. Nothing outside the editor moved.

- [x] Task 10.8: Add a filter box over the whole form
  - Verification: typing a term narrows every section to matching entries and
    bullets; clearing it restores the full list with curation unchanged.
  - Result: both hold.
    - **every section** is checked literally rather than by sampling: the
      fixture's section list is asserted equal to `SECTION_TYPES`, and every
      one of the eleven is then shown whole on a cleared box and dropped
      entirely on a term nothing carries. A section type added later cannot
      quietly go unfiltered.
    - **curation unchanged** is checked as a negative, which is the real
      claim: a store is opened, every keystroke's worth of work is run over
      the whole draft — matched term, unmatched term, cleared box — and the
      draft afterwards is asserted to be the *identical object*, with an
      empty undo stack. Filtering cannot become an edit by accident.
    - and in a real browser (Puppeteer, 15/15 — the sixteenth is a
      pre-existing `favicon.ico` 404) against the real profile: `mongodb`
      takes the column from 8 sections and 25 entries to 1 and 1, the counts
      on screen agree with what is rendered, all 20 Add forms withdraw, no
      checkbox changes state, the indicator stays Saved, `qwertyuiopzz`
      empties the column and says so, Clear restores the form DOM-identical
      to how it loaded, a tag (`backend`), an entry ID (`northwind`) and a
      header field each find what they name, and both data files are hashed
      before and after to confirm nothing reached disk.
  - The filter is a *view*, not a draft field. The term is React state in
    `VariantForm`, not store state: a draft that remembered how it had been
    searched would be a draft differing from the file over nothing — dirty
    indicator, crash copy and undo stack all included.
  - Rows are narrowed in place rather than collected into a results list. A
    match keeps its section, its position (§15.3), its checkbox, its drag
    handle and its textarea; the column simply gets shorter. Nothing a person
    knows how to do to a row stops working because the row is being shown
    under a filter.
  - Searching walks an item's string fields generically rather than listing
    them per collection, and takes in `tags` and `id`. Tags because §6.1 makes
    them the vocabulary tailoring is done in — the same word that drives Task
    10.7's chips finds the rows here — and the ID because that is what a §13
    "not in the library" message names. A new schema field is searchable the
    day it is added, which is the point: a field no search can reach is a
    field the person cannot find their own writing by.
  - **A bullet inherits its entry's text.** `acme api` finds the API bullets
    of the job at Acme — a question neither level can answer alone. Terms are
    AND-ed, and a parent that matched on its own keeps *all* its children,
    because that match was the job and not one sentence in it. A parent whose
    child matched is kept showing only the children that matched — the rule
    Task 7.4's tag filter already settled, for its reason: a bullet is only
    reachable through its entry.
  - Sections that curate no list — the header, About Me, Languages, a custom
    section — are all-or-nothing. Their content is fields, not a list to
    narrow, and a half-shown header would be a contact block missing a line
    nobody could see was missing. A term naming the section itself
    (`experience`, `Core Competencies`, a custom section's own title) shows
    that card whole, which is what makes the box a way to *reach* a section
    and not only to search inside one.
  - Dragging keeps working while filtered, deliberately. Every move at all
    three levels is addressed by a pair of IDs resolved against the *full*
    array, so dropping one visible card onto another puts it exactly where the
    screen says and the hidden rows between them keep their relative order.
    There was nothing to disable.
  - Every Add is withdrawn while a list is narrowed. A new item is empty, an
    empty item matches no term, so adding one would create a row and hide it
    in the same motion.
  - Each narrowed card says what it is holding back (`Showing 1 of 7 entries,
    1 of 37 bullets`), and the box says how many sections survived. A
    shortened list read as the whole list is how someone rewords the one
    bullet they can see believing it is the only one — and a filter that
    empties the column has to say that it did, or it reads as a library that
    has lost its contents.
  - `childrenOf` moved out of `tags.ts` into shared use rather than being
    copied: "what hangs off an entry" is one answer, and two of them would
    drift the moment a section type gained a third shape.
  - Known and pre-existing: a bullet inside an *excluded* entry has no field
    in the form at all, so a match on one shows its entry row and nothing
    below it. Ticking the entry reveals it. The card's count reports what the
    filter matched in the library, which is the honest figure.
  - `npm test` **424/424** (up from 402 — 22 cases over the terms, the two
    levels, every section type, the counts and the not-an-edit guarantee),
    `tsc --noEmit`, `lint`, `check:tailwind-scope`, and `npm run harness`
    **84/84**, text and faces identical. Nothing outside the editor's left
    column moved.

- [x] Task 10.9: Add bulk curation per section
  - Verification: include-all, include-none and invert each produce the same
    draft as performing the equivalent toggles individually.
  - So a variant can start from empty rather than un-ticking twenty rows.
  - Result: all three hold, and are checked literally rather than by sampling.
    - **the same draft** is a whole-store comparison, not a spot check: for
      each mode, a store driven by one press is compared against a second
      store driven through `setEntryIncluded` over the same IDs in the same
      order. The drafts must be equal, not merely similar — and the pair is
      run over **every** section type that curates a list, since
      `includeEntry` has a branch per collection and a mode proved on
      Experience would prove nothing about Technical Skills. The list of
      those seven types is itself asserted, so a new curated section cannot
      slip past unexercised.
    - the same comparison holds for a *subset* of the rows, which is what the
      filter hands these buttons.
    - and in a real browser (Puppeteer, 16/16) against the real profile:
      None empties Experience and disables itself, the preview shrinks with
      it, Invert from empty fills the section and All then disables itself,
      Invert again empties it, three Ctrl+Z presses land exactly on the
      opening state with the indicator reading Saved, and both files are
      hashed before and after to confirm nothing reached disk.
  - **Entry level only, deliberately.** Including an entry already restores
    the bullets it was saved with (`restoredBullets`, §6.2), and an "include
    all" that also forced every bullet in would be a *different* edit from
    ticking the box — it would silently overwrite the bullet choices already
    made inside the jobs the person was keeping. Pinned by a test: All over a
    section leaves `exp-1` at its saved single bullet while a never-saved
    entry arrives with all of its own. Bulk curation of bullets is what tags
    are for (§6.1, Task 10.7); this is bulk curation of a *list*.
  - Three actions because there are three things anyone does to a whole list.
    Invert is the one that does not look worth a button until a variant needs
    the *other* four jobs, at which point it is the entire task.
  - The mode is resolved inside the store against the live draft, not by the
    component at render time — a press must not apply a decision computed
    from a section that has since moved on. `bulk.ts` resolves; the store
    folds `includeEntry` over the result, which is why a re-included entry
    still lands in its library position (§15.3) rather than at the end.
    Pinned: All on Projects puts `proj-1` *above* the already-included
    `proj-2`.
  - Only real changes are returned, so a press with nothing to do leaves the
    draft the identical object and records no step. The buttons disable
    themselves at that point anyway, but a store invariant should not rest on
    a view remembering to.
  - One `set`, so one undo step: it was one decision. `None` followed by
    Ctrl+Z is not twenty undos.
  - **The filter (10.8) scopes them.** The counts and the actions are of the
    rows the card is showing, and the label reads `Shown` rather than
    `Entries` while it is narrowed. A button sitting above a list of three
    rows that quietly cleared twenty would be offering something other than
    what it appears to. Verified in the browser: filtered to one job, the bar
    reads `1/1` and None left the other job untouched.
  - Silent on the sections that curate no list — the header, About Me,
    Languages, a custom section — for `TagActions`' reason: a control that
    can do nothing should not be drawn.
  - `npm test` **441/441** (up from 424 — 17 cases over the resolver, the
    by-hand equivalence across all seven curated types, the restored bullets
    and the single undo step), `tsc --noEmit`, `lint`,
    `check:tailwind-scope`, and `npm run harness` **84/84**, text and faces
    identical. Nothing outside the editor's left column moved.

- [ ] Task 10.10: Add a section jump rail and sticky section headers
  - Verification: every section is reachable in one click from the rail, and
    the toggling behaviour of §15.3's drag ordering is unaffected.
  - Keeps the deliberate no-collapse decision — which avoids the column
    shuffling on every toggle — while fixing the navigation cost it creates.

### Tier 3 — writing comfort

- [ ] Task 10.11: Improve the bullet editing fields (§16.3)
  - Verification: bullet fields grow with their content rather than scrolling
    inside two rows; each shows the wrapped line count the preview measures;
    Ctrl+I wraps the selection in `*…*`.
  - Three small things in one task, all on the same control. Fields are
    hardcoded `rows={2}` (`EntryCuration.tsx`), so a real bullet gets a
    scrollbar in a two-line box. The wrapped-line count tells you the true
    cost of a word before committing to it, and the preview already measures
    it. `*inline italic*` is the markup (§16.3) and currently has no helper.

- [ ] Task 10.12: Add keyboard shortcuts
  - Verification: Ctrl+S saves, Ctrl+Shift+S opens Save As, `/` focuses the
    filter, and none of them fire while a text field has focus in a way that
    would swallow a keystroke.

### Tier 4 — bigger swings

- [ ] Task 10.13: Add preview zoom and page-fit control
  - Verification: 100%, fit-width and fit-page each render correctly, and a
    one-page-at-a-time toggle pages through the sheet stack.
  - `PreviewFrame.tsx:44` auto-scales to the column width with no user
    control over it.

- [ ] Task 10.14: Add a variant diff
  - Verification: two variants of one profile are compared entry by entry,
    naming what each includes that the other does not.
  - Useful once a family of variants is being kept alive together.

- [ ] Task 10.15: Edit directly in the preview
  - Verification: editing text in the preview writes the same library draft
    the left-column field would, and the rendered result is unchanged from
    typing it in the form.
  - `InlineText` and the resume tree are already client-rendered, so
    `contentEditable` on text blocks writing back to the store is feasible.
    Highest effort here, but it is the change that would make this feel like
    a document editor rather than a form driving a document.
