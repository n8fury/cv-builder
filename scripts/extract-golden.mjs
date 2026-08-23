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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { extractTextItems } from "./lib/pdf-text-items.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_PDF = "data/reference/resume-reference-detailed.pdf";
const DEFAULT_OUT = "harness/golden.json";

function fail(message) {
  console.error(`extract-golden: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { pdf: DEFAULT_PDF, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--pdf" || flag === "--out") {
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pdfPath = resolve(repoRoot, args.pdf);
  const outPath = resolve(repoRoot, args.out);

  if (!existsSync(pdfPath)) {
    fail(
      `source PDF not found at ${args.pdf}\n` +
        "  data/reference/ is gitignored (SPEC §12.6) — place the reference PDF\n" +
        "  there to regenerate the golden file, or pass --pdf <path>.\n" +
        "  The committed harness/golden.json means the harness itself does not\n" +
        "  need the PDF; only regeneration does.",
    );
  }

  const { pages, items } = await extractTextItems(new Uint8Array(readFileSync(pdfPath)));

  const golden = {
    schemaVersion: 1,
    // Recorded for provenance only — the PDF itself is never committed.
    source: args.pdf,
    // PDF user space: origin bottom-left, y increases upward, units are points.
    units: "pt",
    origin: "bottom-left",
    pages,
    items,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(golden, null, 2)}\n`, "utf8");

  const fonts = [...new Set(items.map((item) => item.fontName))].sort();
  const outLabel = relative(repoRoot, outPath).split(sep).join("/");
  console.log(
    `extract-golden: wrote ${items.length} items across ${pages.length} pages to ${outLabel}`,
  );
  console.log(`extract-golden: fonts ${fonts.join(", ")}`);
}

await main();
