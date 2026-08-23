#!/usr/bin/env node
/**
 * SPEC §11.2 pixel-fidelity harness.
 *
 * Diffs the text geometry of a generated PDF against `harness/golden.json` —
 * the positions measured off the canonical reference PDF — and fails when any
 * element drifts past the ±2pt tolerance in x or baseline y.
 *
 * By default it prints the `/render` route to PDF itself through headless
 * Chrome, so the harness can gate the Puppeteer export path (SPEC §8) rather
 * than depend on it. Once that path exists, `--pdf out.pdf` points the same
 * comparison at its output.
 *
 * Usage:
 *   node scripts/harness.mjs [--url <url>] [--pdf <path>] [--golden <path>]
 *                            [--tolerance <pt>] [--save-pdf <path>]
 *                            [--only-fail] [--json]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { connect, openPage, withBrowser } from "./lib/chrome.mjs";
import { extractTextItems, round } from "./lib/pdf-text-items.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_URL = "http://localhost:3000/render/jordan-rivera/detailed";
const DEFAULT_GOLDEN = "harness/golden.json";

/** SPEC §11.2: tighter than this isn't meaningful against Illustrator's output. */
const DEFAULT_TOLERANCE_PT = 2;

/** Two items belong to the same rendered line if their baselines are this close. */
const LINE_CLUSTER_PT = 0.6;

const POINTS_PER_INCH = 72;

function fail(message) {
  console.error(`harness: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    url: DEFAULT_URL,
    pdf: null,
    golden: DEFAULT_GOLDEN,
    tolerance: DEFAULT_TOLERANCE_PT,
    savePdf: null,
    onlyFail: false,
    json: false,
  };
  const valued = {
    "--url": "url",
    "--pdf": "pdf",
    "--golden": "golden",
    "--tolerance": "tolerance",
    "--save-pdf": "savePdf",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--only-fail") args.onlyFail = true;
    else if (flag === "--json") args.json = true;
    else if (valued[flag]) {
      const value = argv[i + 1];
      if (!value) fail(`${flag} requires a value`);
      args[valued[flag]] = value;
      i += 1;
    } else fail(`unknown argument: ${flag}`);
  }
  args.tolerance = Number(args.tolerance);
  if (!Number.isFinite(args.tolerance) || args.tolerance <= 0) {
    fail("--tolerance must be a positive number of points");
  }
  return args;
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
function pairLines(goldenLines, actualLines) {
  const pool = new Map();
  for (const line of actualLines) {
    if (!pool.has(line.key)) pool.set(line.key, []);
    pool.get(line.key).push(line);
  }

  const rows = goldenLines.map((expected) => ({
    expected,
    actual: pool.get(expected.key)?.shift() ?? null,
    wrapped: false,
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

  return { rows, extra: unclaimed };
}

function evaluateRow(row, tolerance) {
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
  // A different wrap point is a fidelity failure in its own right: the line
  // holds different words, so its geometry can only ever be indicative.
  if (row.wrapped) reasons.push(`wraps as "${truncate(actual.text, 40)}"`);

  return {
    ...row,
    dx,
    dy,
    status: reasons.length === 0 ? "PASS" : row.wrapped && reasons.length === 1 ? "WRAP" : "FAIL",
    reason: reasons.join(", "),
  };
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
  const { rows, extra } = pairLines(goldenLines, actualLines);
  const results = rows.map((row) => evaluateRow(row, args.tolerance));

  const passed = results.filter((row) => row.status === "PASS").length;
  const failures = results.length - passed + extra.length;

  if (args.json) {
    console.log(JSON.stringify({ tolerance: args.tolerance, results, extra }, null, 2));
  } else {
    console.log(
      `harness: ${args.pdf ?? args.url} vs ${args.golden} at +/-${args.tolerance}pt ` +
        `(${goldenLines.length} golden lines, ${actualLines.length} generated)`,
    );
    if (actual.pages.length !== golden.pages.length) {
      console.log(`harness: page count ${golden.pages.length} -> ${actual.pages.length}`);
    }
    console.log("");
    printTable(results, extra, args);
    console.log("");
    console.log(
      `harness: ${passed}/${results.length} elements within +/-${args.tolerance}pt` +
        (extra.length > 0 ? `, ${extra.length} unexpected line(s)` : ""),
    );
  }

  process.exit(failures === 0 ? 0 : 1);
}

await main();
