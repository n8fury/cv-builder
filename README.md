# CV Builder

A self-hosted CV builder: one master content library per person, tailored
variants per application, pixel-perfect PDF output. See [docs/SPEC.md](docs/SPEC.md)
for the full brief and [docs/plan.md](docs/plan.md) for build sequencing.

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

### Licensing

**Charter BT (Bitstream Charter) is a commercial font.** Verify that your
license permits self-hosting it as a web font before deploying this
anywhere — including for personal or private use, since the build step
serves the font over HTTP even on localhost. Charis SIL is free under the
SIL Open Font License, so it carries no such restriction.
