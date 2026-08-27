<h1 align="center">Vitae</h1>

<p align="center">
  <strong>A self-hosted CV builder with pixel-exact PDF output.</strong><br>
  One content library per person. Every tailored CV is a selection from it, never a copy.
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Node 20.9+" src="https://img.shields.io/badge/node-%E2%89%A5%2020.9-brightgreen.svg">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-black.svg">
  <img alt="TypeScript 5" src="https://img.shields.io/badge/TypeScript-5-3178c6.svg">
</p>

---

Most CV tools make you copy your résumé to tailor it, and within a month you
have six diverging documents and no idea which one is current.

Vitae stores everything you have ever written **once**, in a per-profile
content library. A *variant* — the CV you send to one employer — is pure
curation: an ordered list of references into that library, never a copy of the
text. Fix a typo in a bullet and every variant that uses it is fixed.

The output is held to a measured standard. Rendered pages are diffed against a
committed geometry baseline and must land within **±2pt** per line, with
identical text and no substituted font faces. That check is a script you can
run, not a claim in a README.

> [!WARNING]
> **There is no authentication.** Vitae is built to run on localhost, and every
> route trusts whoever can reach it. See [Security model](#security-model)
> before exposing it anywhere.

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Fonts](#fonts-required-before-rendering)
- [How it works](#how-it-works)
- [Keeping your content private](#keeping-your-content-private)
- [Verifying the render](#verifying-the-render)
- [Development](#development)
- [Project structure](#project-structure)
- [Security model](#security-model)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Write once, curate many.** Bullets, roles, projects and skills live in one
  library. Variants reference them by id, so text is never duplicated.
- **Curation at three levels.** Toggle a whole section, a single entry, or one
  bullet within an entry. Array position *is* the order — there is no `order`
  field to drift out of sync.
- **Live two-column editor.** Curation on the left, a page-accurate preview on
  the right, with page-break guides and a running page count.
- **Measured typography.** Page setup, font sizes and spacing are exact values
  taken off a typeset source, not eyeballed CSS.
- **A fidelity harness.** `npm run harness` diffs generated PDF geometry
  against a baseline and fails on ±2pt drift, any text change, or any font
  substitution.
- **Plain JSON on disk.** No database. Every screen reads from disk per
  request, so editing a file by hand and reloading just works.
- **Strict schemas.** Zod validates every read; writes go through a temp file
  plus rename, so a crash can't leave half a variant behind.
- **Optional AI drafting.** Point an [n8n](https://n8n.io) workflow at the
  drafting endpoint to draft a variant from a job description — see
  [docs/n8n.md](docs/n8n.md).

## Quick start

**Requirements**

- **Node.js 20.9+** (developed on 24.x)
- **Four font files** you supply yourself — see [Fonts](#fonts-required-before-rendering)
- **Chromium**, downloaded automatically by Puppeteer on `npm install`

```sh
git clone https://github.com/n8fury/cv-builder.git
cd cv-builder
npm install
npm run build:fonts     # required before anything renders correctly
npm run dev             # http://localhost:3000
```

The repo ships a fictional example profile, `jordan-rivera`, so there is
something to look at immediately:

| Route | What it is |
|---|---|
| `/` | Dashboard — profiles, their variants, Download / Edit / Library |
| `/edit/<profileId>/<variantId>` | Two-column editor: curation left, live preview right |
| `/library/<profileId>` | Library manager — edit, tag and delete library items |
| `/render/<profileId>/<variantId>` | The bare résumé page; Puppeteer's print target |
| `/api/generate-pdf?profileId=…&variantId=…` | The PDF. Add `&download=1` to save rather than preview |

## Fonts (required before rendering)

The template reproduces a specific typeset document, which means it needs four
specific faces. They are **not vendored** — you supply your own copies and
build them into web fonts locally.

| File | Used for |
|---|---|
| `Charter BT Roman.ttf` | body text, contact lines, the header name |
| `Charter Bd BT Bold.ttf` | section headings, job/project titles, dates, competencies |
| `Charter BT Italic.ttf` | locations, inline `*emphasis*` within bullets |
| `CharisSIL-Italic.ttf` | company names, project subtitles, degrees |

`npm run build:fonts` finds them in your OS font directory — on Windows
`%LOCALAPPDATA%\Microsoft\Windows\Fonts` then `C:\Windows\Fonts`, on Linux
`~/.local/share/fonts` and `/usr/share/fonts`, on macOS `~/Library/Fonts` —
and converts each to `.woff2` in `public/fonts/`. If yours live elsewhere:

```sh
CV_FONT_DIR="/path/to/fonts" npm run build:fonts
```

The script exits non-zero and names every missing face. `public/fonts/` is
gitignored, so re-run this on each new checkout.

If a face fails to load anyway, the app degrades rather than lying: the
preview shows an amber warning naming every missing face and falls back to a
serif, and the export endpoint refuses with a 500 rather than shipping a PDF
in the wrong typeface.

> [!IMPORTANT]
> **Charter BT (Bitstream Charter) is a commercial font.** Verify your licence
> permits self-hosting it as a web font before deploying this anywhere —
> including privately, since the build step serves it over HTTP even on
> localhost. Charis SIL is free under the SIL Open Font License and carries no
> such restriction.

## How it works

One directory per profile:

```
data/profiles/<profileId>/
  content-library.json          everything this person has ever written
  variants/<variantId>.json     one tailored CV — references, no text
```

**`content-library.json`** holds every item with a stable `id` and optional
`tags`: About Me paragraphs, competencies, experience entries and their
bullets, projects, education, skills, certifications, languages,
recommendations and custom sections. Nothing is ever deleted from a variant's
point of view — items are added once and selected from thereafter.

**`variants/<variantId>.json`** is curation only: an ordered list of sections,
each with `visible` and `options`, holding library ids at section, entry and
bullet level. An item is either in the list or it isn't. The objects are
strict, so a mistyped key fails loudly instead of being silently dropped.

`<profileId>` and `<variantId>` are slugs (`^[a-z0-9][a-z0-9_-]*$`). The ids
*are* the identity: renaming a variant renames its file, and the exported PDF
is named `<profileId>-<variantId>.pdf`. Create profiles from the dashboard's
**New profile** form rather than by hand — it scaffolds the folder and an
empty library.

Both files are validated against the Zod schemas in [lib/schema/](lib/schema/)
on every read:

```sh
npm run validate:data       # parse every profile's files against the schemas
```

## Keeping your content private

`jordan-rivera` is fictional, and it is the **only** profile this repo tracks.
`.gitignore` excludes `data/profiles/*` and re-includes just that one, so real
content you add here cannot be committed by accident.

For your own CV, keep the data outside the repo entirely:

```sh
CV_PROFILES_DIR=../cv-data npm run dev
```

`CV_PROFILES_DIR` relocates the whole profile store, so a private directory —
or a separate private repo holding nothing but profiles — works without
forking this one. It is also how you point the browser checks at a scratch
copy instead of your real data.

## Verifying the render

The harness is what makes "pixel-exact" checkable. It extracts text-item
geometry from a generated PDF and diffs it against `harness/golden.json`,
failing when any line drifts past ±2pt in x or baseline y, when a single
character differs, or when any font face was substituted.

It needs a dev server on port 3000. In one terminal `npm run dev`, and in
another:

```sh
npm run harness          # prints /render to PDF itself
npm run harness:export   # measures what /api/generate-pdf actually returns
```

Both should end with `82/82 lines placed within +/-2pt … document text
identical, faces identical`. Run `harness:export` too before trusting a
change: it exercises the export route, the font pre-flight and the page
options, which the default mode deliberately bypasses so it can gate them.

Lines flagged `REFLOW` are **not** failures. The source is composed by
Illustrator, which optimises breaks across a whole paragraph and compresses
word spaces; Chromium breaks greedily and CSS can only stretch. So a few lines
carry one word more or less while landing in the same place. `--strict-wrap`
makes that fatal again if you are working on composition itself.

### What the golden files are, and are not

The metrics in `lib/render/metrics.ts` were measured off two
Illustrator-composed source PDFs. Those carry real personal content, so they
are not distributable and `data/reference/` is gitignored — which means **the
committed goldens are not those measurements.** They are produced by rendering
the example profile and freezing the result.

So the harness gates *regression*, not fidelity to the original source. The
goldens are frozen at commit time, so any change that moves a line more than
±2pt, alters a character, or substitutes a face still fails. What it cannot do
on your machine is prove the output matches the private original.

To re-cut the baseline after a deliberate layout change:

```sh
npm run dev
node scripts/harness.mjs \
  --url http://localhost:3000/render/jordan-rivera/detailed \
  --save-pdf /tmp/detailed.pdf
node scripts/extract-golden.mjs --pdf /tmp/detailed.pdf --out harness/golden.json
```

`npm run extract:golden` reads from `data/reference/` instead, and only works
if you hold the original PDFs.

## Development

On a fresh clone, generate Next's route types once before type-checking —
`LayoutProps` and `PageProps` are generated into `.next/types`, so `tsc` has
nothing to resolve them against until then:

```sh
npx next typegen
```

```sh
npm test                      # vitest, the whole unit suite
npm run lint                  # eslint
npx tsc --noEmit              # types
npm run check:tailwind-scope  # keeps Tailwind out of the résumé stylesheet
npm run check:errors          # error-handling table, in a real browser
npm run check:pending         # every async action pends and can't double-submit
npm run measure:page          # measure the laid-out page in a real browser
npm run build:resume-css      # regenerate resume.css from lib/render/metrics.ts
```

`check:errors` and `check:pending` drive a real browser against a running
`npm run dev`, injecting faults from the client side so the server under test
is the ordinary one. `check:pending` creates, renames and deletes a throwaway
profile — point `CV_PROFILES_DIR` at a scratch copy if you would rather it
never saw your real data.

Measured values in `lib/render/metrics.ts` — page setup, font sizes, spacing —
are exact. `resume.css` is generated from them, and `npm test` fails if the
committed stylesheet is stale, so edit the metrics and regenerate rather than
editing the CSS.

## Project structure

```
app/
  (dashboard)/        dashboard, editor and library screens + server actions
  (resume)/           the bare /render route Puppeteer prints
  api/                generate-pdf, library and variants endpoints
components/
  editor/             two-column editor: curation, preview, drag-to-reorder
  library/            library manager: edit, tag, fork, delete
  resume/             the résumé template itself, one component per section
lib/
  data/               filesystem store, resolution, edit operations
  render/             metrics, pagination, markup, font checks
  schema/             Zod schemas for the library and variants
scripts/              font build, fidelity harness, browser checks
harness/              committed geometry baselines
docs/                 SPEC.md (full brief), plan.md (build log), n8n.md
```

Deeper reading: [docs/SPEC.md](docs/SPEC.md) is the exhaustive brief every
measured value traces back to, and [docs/plan.md](docs/plan.md) records how it
was built, phase by phase.

## Security model

There are no accounts, no login, and no authorization checks anywhere. A
single admin — you — manages every profile, and every route trusts whoever can
reach it: anyone who can open the app can read, edit and delete every
profile's content.

The one exception is the drafting write endpoint. Set `CV_API_TOKEN` and
`POST /api/variants` requires `Authorization: Bearer <token>`, which is what
makes it safe to point an n8n instance on another machine at it. Unset, it is
as open as everything else.

**Run it bound to localhost and nothing else.** If you need it off your own
machine, put it behind basic auth or a VPN rather than exposing it directly —
the app itself will not stop anyone.

## Contributing

Issues and pull requests are welcome. Before opening a PR:

```sh
npm test && npm run lint && npx tsc --noEmit
```

and, for anything touching the résumé template or `lib/render/metrics.ts`, run
`npm run harness` and `npm run harness:export` against a dev server as well.
Layout changes are expected to move the goldens; a PR that moves them should
say so and include the regenerated files.

Two things worth knowing before proposing changes:

- **Measured values are not style preferences.** Numbers in
  `lib/render/metrics.ts` come from a typeset source. Changing one to make
  something "look better" will fail the harness, which is the intended
  behaviour.
- **[docs/SPEC.md](docs/SPEC.md) is the source of truth.** If a change
  contradicts it, the spec should change in the same PR.

## License

[MIT](LICENSE).

This covers the code only. The Charter BT faces are **not** included and are
not ours to license — see [Fonts](#fonts-required-before-rendering) before
self-hosting them.
