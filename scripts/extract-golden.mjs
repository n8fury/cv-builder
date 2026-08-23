#!/usr/bin/env node
/**
 * Extract text-item positions from the canonical reference PDF into
 * `harness/golden.json` — the fixed target the §11.2 fidelity harness diffs
 * generated output against.
 *
 * Only coordinates are written out, never PDF content bytes, so the golden
 * file is committable while `data/reference/` stays gitignored (SPEC §12.6).
 * The harness therefore runs on a fresh checkout with no source PDF present;
 * this script is the only step that needs it.
 *
 * Usage: node scripts/extract-golden.mjs [--pdf <path>] [--out <path>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_PDF = 'data/reference/resume-reference-detailed.pdf';
const DEFAULT_OUT = 'harness/golden.json';

/** Coordinates are stored to this many decimals — well under the ±2pt tolerance. */
const PRECISION = 2;

function parseArgs(argv) {
  const args = { pdf: DEFAULT_PDF, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--pdf' || flag === '--out') {
      const value = argv[i + 1];
      if (!value) fail(`${flag} requires a path argument`);
      args[flag.slice(2)] = value;
      i += 1;
    } else {
      fail(`unknown argument: ${flag}`);
    }
  }
  return args;
}

function fail(message) {
  console.error(`extract-golden: ${message}`);
  process.exit(1);
}

function round(value) {
  return Number(value.toFixed(PRECISION));
}

/**
 * Embedded subsets carry a random six-letter tag (`UDSQTU+CharterBT-Bold`).
 * The tag differs per export, so identity comparisons use the bare face name.
 */
function normalizeFontName(name) {
  return name.replace(/^[A-Z]{6}\+/, '');
}

/** Resolve pdf.js's internal font id (`g_d0_f1`) to the embedded face name. */
function resolveFontName(page, fontId) {
  if (!page.commonObjs.has(fontId)) return fontId;
  const font = page.commonObjs.get(fontId);
  return normalizeFontName(font?.name ?? fontId);
}

async function extractPage(page, pageNumber) {
  // Populates commonObjs with the font objects getTextContent only references by id.
  await page.getOperatorList();
  const { items } = await page.getTextContent();

  return items
    .filter((item) => item.str.trim() !== '')
    .map((item) => {
      const [scaleX, skewY, , scaleY, x, baselineY] = item.transform;
      return {
        page: pageNumber,
        text: item.str,
        x: round(x),
        baselineY: round(baselineY),
        fontName: resolveFontName(page, item.fontName),
        fontSize: round(Math.hypot(skewY, scaleY) || Math.abs(scaleX)),
      };
    });
}

/** Reading order: top-to-bottom, then left-to-right — stable across runs. */
function byReadingOrder(a, b) {
  return a.page - b.page || b.baselineY - a.baselineY || a.x - b.x;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pdfPath = resolve(repoRoot, args.pdf);
  const outPath = resolve(repoRoot, args.out);

  if (!existsSync(pdfPath)) {
    fail(
      `source PDF not found at ${args.pdf}\n` +
        '  data/reference/ is gitignored (SPEC §12.6) — place the reference PDF\n' +
        '  there to regenerate the golden file, or pass --pdf <path>.\n' +
        '  The committed harness/golden.json means the harness itself does not\n' +
        '  need the PDF; only regeneration does.',
    );
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(readFileSync(pdfPath)),
    useSystemFonts: false,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;

  const pages = [];
  const items = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const [, , width, height] = page.view;
    pages.push({ page: pageNumber, width: round(width), height: round(height) });
    items.push(...(await extractPage(page, pageNumber)));
    page.cleanup();
  }
  await loadingTask.destroy();

  items.sort(byReadingOrder);

  const golden = {
    schemaVersion: 1,
    // Recorded for provenance only — the PDF itself is never committed.
    source: args.pdf,
    // PDF user space: origin bottom-left, y increases upward, units are points.
    units: 'pt',
    origin: 'bottom-left',
    pages,
    items,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(golden, null, 2)}\n`, 'utf8');

  const fonts = [...new Set(items.map((item) => item.fontName))].sort();
  const outLabel = relative(repoRoot, outPath).split(sep).join('/');
  console.log(
    `extract-golden: wrote ${items.length} items across ${pages.length} pages to ${outLabel}`,
  );
  console.log(`extract-golden: fonts ${fonts.join(', ')}`);
}

await main();
