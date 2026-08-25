# CV Builder

A self-hosted CV builder: one master content library per person, tailored
variants per application, pixel-perfect PDF output.

Everything you have ever written lives once, in a per-profile content library.
A *variant* is pure curation — an ordered list of references into that library,
never a copy of the text — so a tailored CV is a selection, not a fork. The
rendered result is diffed against the geometry of the original PDF and has to
land within ±2pt, which is what "pixel-perfect" means here and what the harness
enforces.

See [docs/SPEC.md](docs/SPEC.md) for the full brief and
[docs/plan.md](docs/plan.md) for build sequencing.

## ⚠️ Localhost only — there is no authentication

There are no accounts, no login, and no authorization checks anywhere (SPEC
§9). A single admin — you — manages every profile, and every route trusts
whoever can reach it: anyone who can open the app can read, edit, and delete
every profile's content. The 404 body from the export endpoint also includes
the absolute path of the missing variant file.

Run it bound to localhost and nothing else. If you ever need it off your own
machine, put it behind basic auth or a VPN rather than exposing it directly —
the app itself will not stop anyone.

## Requirements

- **Node.js 20.9+** (developed on 24.x)
- A local copy of the four source fonts — see below. Not vendored; not
  optional if you want correct output.
- Chromium, downloaded automatically by Puppeteer on `npm install`. It renders
  the PDF and drives the browser-based checks.

## Setup

```sh
npm install
npm run build:fonts     # see "Fonts" below — required before rendering
npm run dev             # http://localhost:3000
```

`npm run dev` serves the whole app:

| Route | What it is |
|---|---|
| `/` | Dashboard — profiles, their variants, Download / Edit / Library |
| `/edit/<profileId>/<variantId>` | Two-column editor: curation on the left, live preview on the right |
| `/library/<profileId>` | Library manager — edit, tag and delete library items |
| `/render/<profileId>/<variantId>` | The bare resume page. Puppeteer's print target, and the same component the editor previews |
| `/api/generate-pdf?profileId=…&variantId=…` | The PDF. Add `&download=1` for a save-to-disk attachment instead of an inline preview |

Every screen reads from disk on each request — edit a JSON file by hand and a
reload shows it.

## Fonts (required before rendering)

The resume template reproduces the source PDF exactly, which means it needs
four specific font faces (SPEC §3). They are **not** vendored in this repo —
you supply your own copies and build them into web fonts locally.

### 1. Install the four source TTFs

| File | Used for |
|---|---|
| `Charter BT Roman.ttf` | body text, contact lines, the header name |
| `Charter Bd BT Bold.ttf` | section headings, job/project titles, dates, competencies |
| `Charter BT Italic.ttf` | locations, inline `*emphasis*` within bullets |
| `CharisSIL-Italic.ttf` | company names, project subtitles, degrees |

By default the build script looks for them in your OS font directory —
on Windows `%LOCALAPPDATA%\Microsoft\Windows\Fonts`, then `C:\Windows\Fonts`;
on Linux `~/.local/share/fonts` and `/usr/share/fonts`; on macOS
`~/Library/Fonts`. If yours live somewhere else, point at that directory:

```sh
CV_FONT_DIR="/path/to/fonts" npm run build:fonts
```

### 2. Build the web fonts

```sh
npm run build:fonts
```

This converts each TTF to `.woff2` and writes it to `public/fonts/`:
`charter-roman.woff2`, `charter-bold.woff2`, `charter-italic.woff2`,
`charis-italic.woff2`. The script exits non-zero and names every missing
face if a source TTF can't be found.

`public/fonts/` is gitignored — the generated files are build output, and
the Charter faces are not ours to redistribute. Re-run the step on each
new checkout.

If a face fails to load anyway, the app degrades rather than lying: the
preview shows an amber warning naming every missing face and falls back to a
serif, and the export endpoint refuses with a 500 rather than shipping a PDF
in the wrong typeface (SPEC §13).

### Licensing

**Charter BT (Bitstream Charter) is a commercial font.** Verify that your
license permits self-hosting it as a web font before deploying this
anywhere — including for personal or private use, since the build step
serves the font over HTTP even on localhost. Charis SIL is free under the
SIL Open Font License, so it carries no such restriction.

## Data layout

One directory per profile under `data/profiles/` (SPEC §9):

```
data/profiles/<profileId>/
  content-library.json          every piece of content this person has written
  variants/<variantId>.json     one tailored CV — references, no text
```

`<profileId>` and `<variantId>` are slugs (`^[a-z0-9][a-z0-9_-]*$`); the ids
*are* the identity, so renaming a variant renames its file, and the exported
PDF is named `<profileId>-<variantId>.pdf`. Profiles are created from the
dashboard's **New profile** form, not by hand — it scaffolds the folder and an
empty library for you.

**`content-library.json`** holds every item, each with a stable `id` and
optional `tags`: About Me paragraphs, competencies, experience entries and
their bullets, projects, education, skills, certifications, languages,
recommendations and custom sections. Nothing is ever deleted from a variant's
point of view — items are added here once and selected from thereafter.

**`variants/<variantId>.json`** is curation only: an ordered list of sections,
each with `visible` and `options`, holding library ids at the section, entry
and bullet level. An item is either in the list or it isn't, and array position
*is* the order — there is no `order` field and no `visible` flag below the
section level. The objects are strict, so a mistyped key fails loudly instead
of being silently dropped.

Both files are validated against the Zod schemas in [lib/schema/](lib/schema/)
on every read, and writes go through a temp file plus rename so a crash can
never leave half a variant behind.

```sh
npm run validate:data       # parse every profile's files against the schemas
```

`data/profiles/**` holds real personal content and `data/reference/` (the
source PDFs) is gitignored entirely. Point the store somewhere else with
`CV_PROFILES_DIR` — useful for running the browser checks against a scratch
copy:

```sh
CV_PROFILES_DIR=/tmp/scratch-profiles npm run dev
```

`theme.json` is reserved by SPEC §9 for per-profile font/spacing overrides but
is not read by anything yet; every profile renders with the same metrics.

## Verifying the render — `npm run harness`

The fidelity harness (SPEC §11.2) is the thing that makes "pixel-perfect" a
claim you can check. It extracts text-item geometry from a generated PDF and
diffs it against `harness/golden.json` — the positions measured off the
canonical reference PDF, committed to the repo — failing when any line drifts
past ±2pt in x or baseline y, when a single character of text differs, or when
any font face was substituted.

**It needs a dev server running on port 3000.** In one terminal:

```sh
npm run dev
```

and in another:

```sh
npm run harness          # prints /render to PDF itself
npm run harness:export   # measures what /api/generate-pdf actually returns
```

Both should end with `84/84 lines placed within +/-2pt … document text
identical, faces identical`. Run `harness:export` too before trusting a
change: it exercises the export route, the font pre-flight and the page
options, which the default mode deliberately bypasses so it can gate them.

Lines flagged `REFLOW` are not failures. The source is composed by
Illustrator, which optimises breaks across a whole paragraph and compresses
word spaces; Chromium breaks greedily and CSS can only stretch. So a few lines
carry one word more or less while landing in the same place. `--strict-wrap`
makes that fatal again if you are working on the composition problem itself.

Regenerating the goldens needs the reference PDFs in `data/reference/`, which
are gitignored — `npm run extract:golden` only works if you have them.

## Other checks

```sh
npm test                      # vitest, the whole unit suite
npm run lint                  # eslint
npx tsc --noEmit              # types
npm run check:tailwind-scope  # keeps Tailwind out of the resume stylesheet
npm run check:errors          # SPEC §13 error handling, in a real browser
npm run check:pending         # every async action pends and can't double-submit
npm run measure:page          # measure the laid-out page in a real browser
npm run build:resume-css      # regenerate resume.css from lib/render/metrics.ts
```

`check:errors` and `check:pending` drive a real browser against a running
`npm run dev`, injecting their faults from the client side so the server under
test is the ordinary one. `check:pending` creates, renames and deletes a
throwaway profile — run it with `CV_PROFILES_DIR` pointed at a scratch copy if
you would rather it never see your real data.

Measured values in `lib/render/metrics.ts` — page setup, font sizes, spacing —
were taken off the source PDF and are exact. `resume.css` is generated from
them, and `npm test` fails if the committed stylesheet is stale.
