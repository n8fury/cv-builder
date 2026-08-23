#!/usr/bin/env node
/**
 * SPEC §11.2 pixel-fidelity harness.
 *
 * Diffs the text geometry of a generated PDF against `harness/golden.json` —
 * the positions measured off the canonical reference PDF — and fails when any
 * element drifts past the ±2pt tolerance in x or baseline y.
 *
 * What it does *not* police is where a justified line breaks. The source is
 * composed by Illustrator, whose Paragraph Composer optimises breaks over a
 * whole paragraph and compresses word spaces to fit (measured: down to ~80%);
 * CSS justification only ever stretches, and Chromium breaks greedily, so a
 * handful of lines carry one word more or less than the source. That is a
 * text-flow difference, not a geometry one — the lines themselves land in the
 * same places — and gating on it would mean gating on a property CSS cannot
 * express. It is reported as REFLOW and is not fatal; `--strict-wrap` makes
 * it fatal again for anyone working on the composition problem itself.
 *
 * Letting reflow pass is only safe because of `assertSameText()`: both sides
 * must carry character-for-character identical text across the whole
 * document. A line may hold different words than its golden counterpart, but
 * no word may appear, vanish, or change anywhere.
 *
 * By default it prints the `/render` route to PDF itself through headless
 * Chrome, so the harness can gate the Puppeteer export path (SPEC §8) rather
 * than depend on it. `--export` instead downloads the PDF from
 * `/api/generate-pdf`, pointing the same comparison at what a user actually
 * receives — the route, the font pre-flight and §15.10's page options
 * included. `--pdf out.pdf` measures a PDF already on disk.
 *
 * Usage:
 *   node scripts/harness.mjs [--url <url>] [--pdf <path>] [--golden <path>]
 *                            [--export] [--export-url <url>]
 *                            [--tolerance <pt>] [--save-pdf <path>]
 *                            [--only-fail] [--json] [--strict-wrap]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { connect, openPage, withBrowser } from "./lib/chrome.mjs";
import { extractTextItems, round } from "./lib/pdf-text-items.mjs";
import { assertSameFaces, assertSameText } from "./lib/text-identity.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_URL = "http://localhost:3000/render/jordan-rivera/detailed";
const DEFAULT_EXPORT_URL =
  "http://localhost:3000/api/generate-pdf?profileId=jordan-rivera&variantId=detailed";
const DEFAULT_GOLDEN = "harness/golden.json";

/** SPEC §11.2: tighter than this isn't meaningful against Illustrator's output. */
const DEFAULT_TOLERANCE_PT = 2;

/** Two items belong to the same rendered line if their baselines are this close. */
const LINE_CLUSTER_PT = 0.6;

/**
 * Font sizes are compared this loosely (§3). The source rounds — its 24.9pt
 * name reads back as 24.91 and its 12pt headings as 11.96 — so an exact match
 * is not available, but this is far tighter than any real size mistake.
 */
const FONT_SIZE_TOLERANCE_PT = 0.5;

const POINTS_PER_INCH = 72;

function fail(message) {
  console.error(`harness: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    url: DEFAULT_URL,
    exportUrl: null,
    pdf: null,
    golden: DEFAULT_GOLDEN,
    tolerance: DEFAULT_TOLERANCE_PT,
    savePdf: null,
    onlyFail: false,
    json: false,
    strictWrap: false,
  };
  const valued = {
    "--url": "url",
    "--export-url": "exportUrl",
    "--pdf": "pdf",
    "--golden": "golden",
    "--tolerance": "tolerance",
    "--save-pdf": "savePdf",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--only-fail") args.onlyFail = true;
    else if (flag === "--export") args.exportUrl ??= DEFAULT_EXPORT_URL;
    else if (flag === "--json") args.json = true;
    else if (flag === "--strict-wrap") args.strictWrap = true;
    else if (valued[flag]) {
      const value = argv[i + 1];
      if (!value) fail(`${flag} requires a value`);
      args[valued[flag]] = value;
      i += 1;
    } else fail(`unknown argument: ${flag}`);
  }
  if (args.pdf && args.exportUrl) {
    fail("--pdf and --export name two different PDFs; pass one");
  }
  args.tolerance = Number(args.tolerance);
  if (!Number.isFinite(args.tolerance) || args.tolerance <= 0) {
    fail("--tolerance must be a positive number of points");
  }
  return args;
}

/**
 * Download the PDF from the export endpoint (SPEC §8).
 *
 * The point of measuring this rather than the harness's own print is that it
 * exercises everything between the route and the reader: the font pre-flight,
 * §15.10's page options, and the response itself. A non-200 carries the API's
 * JSON error, which is worth surfacing verbatim — a failed font check reads
 * as a harness failure here, exactly as it should.
 */
async function fetchExportedPdf(url) {
  const response = await fetch(url);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    let detail = bytes.toString("utf8").slice(0, 500);
    try {
      detail = JSON.parse(detail).error ?? detail;
    } catch {
      /* not JSON: report the body as-is */
    }
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/pdf")) {
    throw new Error(`expected application/pdf, got ${type || "no content-type"}`);
  }
  return bytes;
}

/**
 * Print the render route to PDF with the page setup SPEC §15.10 pins for the
 * export path, so the harness measures what the export will produce.
 */
async function renderToPdf(url, pageSetup) {
  return withBrowser(async (endpoint) => {
    const cdp = await connect(endpoint);
    try {
      const sessionId = await openPage(cdp, url);
      // Layout is only trustworthy once the four faces are actually loaded; a
      // fallback serif would move every baseline (SPEC §8).
      await cdp.send(
        "Runtime.evaluate",
        { expression: "document.fonts.ready.then(() => true)", awaitPromise: true },
        sessionId,
      );
      const { data } = await cdp.send(
        "Page.printToPDF",
        {
          printBackground: true,
          preferCSSPageSize: true,
          paperWidth: pageSetup.width / POINTS_PER_INCH,
          paperHeight: pageSetup.height / POINTS_PER_INCH,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
        },
        sessionId,
      );
      return Buffer.from(data, "base64");
    } finally {
      cdp.close();
    }
  });
}

/**
 * Collapse text items into rendered lines.
 *
 * Illustrator emits a whole line as one item; Chromium splits it wherever
 * kerning or a style run changes. Comparing raw items would therefore diff two
 * different segmentations rather than two layouts, so both sides are grouped by
 * baseline first. The 2.31pt right-block lift (§4.4) keeps a right-aligned date
 * on its own line here — which is the intent, since that offset is exactly what
 * the harness has to police.
 */
function toLines(items) {
  const lines = [];
  for (const item of items) {
    const line = lines.find(
      (candidate) =>
        candidate.page === item.page &&
        Math.abs(candidate.baselineY - item.baselineY) <= LINE_CLUSTER_PT,
    );
    if (line) line.items.push(item);
    else lines.push({ page: item.page, baselineY: item.baselineY, items: [item] });
  }

  return lines
    .map((line) => {
      const ordered = [...line.items].sort((a, b) => a.x - b.x);
      const text = ordered
        .map((item) => item.text)
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      return {
        page: line.page,
        // The leftmost item owns the line's x and baseline: that is the
        // coordinate SPEC §4 quotes, and it is unaffected by segmentation.
        x: ordered[0].x,
        baselineY: ordered[0].baselineY,
        fontName: ordered[0].fontName,
        fontSize: ordered[0].fontSize,
        text,
        // Whitespace is stripped from the match key because a gap can be a
        // space character on one side and pure kerning on the other.
        key: text.replace(/\s+/g, "").toLowerCase(),
      };
    })
    .sort((a, b) => a.page - b.page || b.baselineY - a.baselineY || a.x - b.x);
}

/** Shortest shared opening a fuzzy pairing is allowed to rest on. */
const MIN_PREFIX_MATCH = 10;

function commonPrefixLength(a, b) {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i += 1;
  return i;
}

/**
 * Pair golden lines with generated lines by text, not by index — drift has to
 * be reported against the right element even when a line is missing entirely.
 * Repeated text pairs in reading order.
 *
 * Exact text pairs first. Whatever is left goes through a prefix pass, because
 * a paragraph that wraps one word early produces two lines that share an
 * opening but no full match: without it every wrapped line would land in
 * MISSING/EXTRA and the geometry underneath — the thing being measured — would
 * never be reported at all.
 */
function pairLines(goldenLines, actualLines, tolerance) {
  const pool = new Map();
  for (const line of actualLines) {
    if (!pool.has(line.key)) pool.set(line.key, []);
    pool.get(line.key).push(line);
  }

  const rows = goldenLines.map((expected) => ({
    expected,
    actual: pool.get(expected.key)?.shift() ?? null,
    wrapped: false,
    reflowed: false,
  }));

  const unclaimed = [...pool.values()]
    .flat()
    .sort((a, b) => a.page - b.page || b.baselineY - a.baselineY);

  for (const row of rows) {
    if (row.actual) continue;
    let best = null;
    let bestIndex = -1;
    for (const [index, candidate] of unclaimed.entries()) {
      const score = commonPrefixLength(row.expected.key, candidate.key);
      if (score < MIN_PREFIX_MATCH) continue;
      const closer =
        best === null ||
        score > best.score ||
        (score === best.score &&
          Math.abs(candidate.baselineY - row.expected.baselineY) < best.distance);
      if (closer) {
        best = {
          score,
          distance: Math.abs(candidate.baselineY - row.expected.baselineY),
          line: candidate,
        };
        bestIndex = index;
      }
    }
    if (best) {
      row.actual = best.line;
      row.wrapped = true;
      unclaimed.splice(bestIndex, 1);
    }
  }

  /*
   * Last pass: pair on position alone.
   *
   * A paragraph that breaks one word early produces a run of lines sharing no
   * opening at all — golden's "role-based access control…" against generated's
   * "based access control…" — which the prefix pass cannot see. Those lines
   * are not missing; they are the same lines holding a different share of the
   * same words, and they sit exactly where the golden says. Pairing them by
   * position is what lets the harness report their geometry, which is the
   * thing it exists to measure. It is only sound alongside assertSameText():
   * without that, this pass would happily pair two lines of unrelated copy.
   */
  for (const row of rows) {
    if (row.actual) continue;
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (const [index, candidate] of unclaimed.entries()) {
      if (candidate.page !== row.expected.page) continue;
      const dy = Math.abs(candidate.baselineY - row.expected.baselineY);
      const dx = Math.abs(candidate.x - row.expected.x);
      if (dy > tolerance || dx > tolerance) continue;
      if (dy < bestDistance) {
        bestDistance = dy;
        bestIndex = index;
      }
    }
    if (bestIndex >= 0) {
      row.actual = unclaimed[bestIndex];
      row.reflowed = true;
      unclaimed.splice(bestIndex, 1);
    }
  }

  return { rows, extra: unclaimed };
}

function evaluateRow(row, tolerance, strictWrap) {
  const { expected, actual } = row;
  if (!actual) {
    return { ...row, status: "MISSING", reason: "no matching text in generated PDF" };
  }

  const dx = round(actual.x - expected.x);
  const dy = round(actual.baselineY - expected.baselineY);
  const reasons = [];
  if (actual.page !== expected.page) reasons.push(`page ${expected.page} to ${actual.page}`);
  if (Math.abs(dx) > tolerance) reasons.push(`x off by ${dx}`);
  if (Math.abs(dy) > tolerance) reasons.push(`baseline off by ${dy}`);
  // Position alone cannot tell Charter from a fallback serif at the same
  // size, and §8 treats a substituted face as a hard failure — so identity is
  // asserted, not inferred. This sees the line's leading item;
  // assertSameFaces() covers substitutions further along a line.
  if (actual.fontName !== expected.fontName) {
    reasons.push(`font ${expected.fontName} rendered as ${actual.fontName}`);
  }
  if (Math.abs(actual.fontSize - expected.fontSize) > FONT_SIZE_TOLERANCE_PT) {
    reasons.push(`font size ${expected.fontSize} rendered as ${actual.fontSize}`);
  }

  // Geometry decides pass or fail. A different wrap point is reported but not
  // counted against the run: the copy is guaranteed identical document-wide by
  // assertSameText(), so a line holding a different share of it is a
  // composition difference CSS cannot express, not a drifted measurement.
  const outOfTolerance = reasons.length > 0;
  const reflowed = row.wrapped || row.reflowed;
  if (reflowed) reasons.push(`holds "${truncate(actual.text, 40)}"`);

  const status = outOfTolerance
    ? "FAIL"
    : reflowed
      ? strictWrap
        ? "FAIL"
        : row.wrapped
          ? "WRAP"
          : "REFLOW"
      : "PASS";

  return { ...row, dx, dy, status, reason: reasons.join(", ") };
}

function truncate(text, width) {
  return text.length <= width ? text : `${text.slice(0, width - 1)}…`;
}

const COLUMNS = [
  ["PG", 2],
  ["STATUS", 7],
  ["dX", 7],
  ["dY", 7],
  ["TEXT", 52],
];

function printTable(results, extra, args) {
  console.log(COLUMNS.map(([name, width]) => name.padEnd(width)).join(" "));
  console.log(COLUMNS.map(([, width]) => "-".repeat(width)).join(" "));

  for (const row of results) {
    if (args.onlyFail && row.status === "PASS") continue;
    const cells = [
      String(row.expected.page).padEnd(2),
      row.status.padEnd(7),
      (row.dx === undefined ? "-" : String(row.dx)).padStart(7),
      (row.dy === undefined ? "-" : String(row.dy)).padStart(7),
      truncate(row.expected.text, 52),
    ];
    console.log(`${cells.join(" ")}${row.reason ? `  <- ${row.reason}` : ""}`);
  }

  for (const line of extra) {
    const cells = [
      String(line.page).padEnd(2),
      "EXTRA".padEnd(7),
      "-".padStart(7),
      "-".padStart(7),
      truncate(line.text, 52),
    ];
    console.log(`${cells.join(" ")}  <- not present in golden`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const goldenPath = resolve(repoRoot, args.golden);
  if (!existsSync(goldenPath)) {
    fail(`golden file not found at ${args.golden} - run \`npm run extract:golden\` first`);
  }
  const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
  const pageSetup = golden.pages[0];

  let pdfBytes;
  if (args.pdf) {
    const pdfPath = resolve(repoRoot, args.pdf);
    if (!existsSync(pdfPath)) fail(`PDF not found at ${args.pdf}`);
    pdfBytes = readFileSync(pdfPath);
  } else if (args.exportUrl) {
    try {
      pdfBytes = await fetchExportedPdf(args.exportUrl);
    } catch (error) {
      fail(
        `could not export from ${args.exportUrl}: ${error.message}\n` +
          "  Start the dev server first (`npm run dev`), or pass --pdf <path>.",
      );
    }
  } else {
    try {
      pdfBytes = await renderToPdf(args.url, pageSetup);
    } catch (error) {
      fail(
        `could not print ${args.url}: ${error.message}\n` +
          "  Start the dev server first (`npm run dev`), or pass --pdf <path>.",
      );
    }
  }

  if (args.savePdf) {
    const savePath = resolve(repoRoot, args.savePdf);
    mkdirSync(dirname(savePath), { recursive: true });
    writeFileSync(savePath, pdfBytes);
  }

  const actual = await extractTextItems(new Uint8Array(pdfBytes));

  const goldenLines = toLines(golden.items);
  const actualLines = toLines(actual.items);
  const { rows, extra } = pairLines(goldenLines, actualLines, args.tolerance);
  const results = rows.map((row) => evaluateRow(row, args.tolerance, args.strictWrap));

  const textMismatch = assertSameText(golden.items, actual.items);
  const faceMismatches = assertSameFaces(golden.items, actual.items);

  const passed = results.filter((row) => row.status === "PASS").length;
  const reflowed = results.filter(
    (row) => row.status === "WRAP" || row.status === "REFLOW",
  ).length;
  const failed = results.filter((row) => row.status === "FAIL").length;
  const failures = failed + extra.length + (textMismatch ? 1 : 0) + faceMismatches.length;

  if (args.json) {
    console.log(
      JSON.stringify(
        { tolerance: args.tolerance, results, extra, textMismatch, faceMismatches },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `harness: ${args.pdf ?? args.exportUrl ?? args.url} vs ${args.golden} at +/-${args.tolerance}pt ` +
        `(${goldenLines.length} golden lines, ${actualLines.length} generated)`,
    );
    if (actual.pages.length !== golden.pages.length) {
      console.log(`harness: page count ${golden.pages.length} -> ${actual.pages.length}`);
    }
    console.log("");
    printTable(results, extra, args);
    console.log("");
    if (textMismatch) console.log(`harness: FAIL ${textMismatch}
`);
    for (const problem of faceMismatches) console.log(`harness: FAIL ${problem}`);
    if (faceMismatches.length > 0) console.log("");
    // Position and text flow are separate concerns, so the summary names them
    // apart rather than folding both into one pass rate.
    const placed = results.filter((row) => row.dx !== undefined);
    console.log(
      `harness: ${placed.length - failed}/${placed.length} lines placed within ` +
        `+/-${args.tolerance}pt; ${passed} exact` +
        (reflowed > 0
          ? `, ${reflowed} reflowed (same text, different break${
              args.strictWrap ? " — fatal under --strict-wrap" : ""
            })`
          : "") +
        (extra.length > 0 ? `, ${extra.length} unpaired` : "") +
        `; document text ${textMismatch ? "DIFFERS" : "identical"}` +
        `, faces ${faceMismatches.length > 0 ? "SUBSTITUTED" : "identical"}`,
    );
  }

  process.exit(failures === 0 ? 0 : 1);
}

await main();
