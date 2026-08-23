/**
 * The §4.2 gaps §11.2's harness cannot check, checked against the golden
 * files directly.
 *
 * About Me's space-before is absent from §4.2 and Projects' is a stand-in, so
 * both were settled by reading `harness/golden.json` (the canonical detailed
 * PDF) and `harness/golden-basic.json` (the second, basic PDF). This asserts
 * the numbers in `metrics.ts` still say what those files say — the harness
 * itself only ever renders a minimal-header variant, so the full-header case
 * has no other guard.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ABOUT_ME_SPACE_BEFORE_PT,
  NAME_BASELINE_TO_ABOUT_ME_PT,
  SPACE_BEFORE_PT,
} from "./metrics";

type GoldenItem = { page: number; text: string; baselineY: number };

function golden(file: string): GoldenItem[] {
  const path = join(process.cwd(), "harness", file);
  return (JSON.parse(readFileSync(path, "utf8")) as { items: GoldenItem[] }).items;
}

/** The first item whose text starts with `prefix` — texts are unique enough. */
function baselineOf(items: GoldenItem[], prefix: string): number {
  const item = items.find((candidate) => candidate.text.startsWith(prefix));
  if (!item) throw new Error(`no golden item starting with ${JSON.stringify(prefix)}`);
  return item.baselineY;
}

const detailed = golden("golden.json");
const basic = golden("golden-basic.json");

describe("About Me space-before (§4.2, measured)", () => {
  it("matches the name → heading gap in the canonical detailed PDF", () => {
    const gap = baselineOf(detailed, "MD. Jordan") - baselineOf(detailed, "About Me");
    expect(gap).toBeCloseTo(NAME_BASELINE_TO_ABOUT_ME_PT, 2);
  });

  it("reproduces the minimal header's contact → heading gap exactly", () => {
    const gap = baselineOf(detailed, "jordan.rivera@") - baselineOf(detailed, "About Me");
    expect(ABOUT_ME_SPACE_BEFORE_PT.minimal).toBeCloseTo(gap, 2);
    expect(SPACE_BEFORE_PT.aboutMe).toBe(ABOUT_ME_SPACE_BEFORE_PT.minimal);
  });

  it("reproduces the full header's second-contact → heading gap", () => {
    // The basic PDF is the only source with a full header. Its own name →
    // heading gap runs 0.23pt tighter than the canonical, so the derived
    // value trails the direct reading by the same amount.
    const gap = baselineOf(basic, "linkedin.com/") - baselineOf(basic, "About Me");
    expect(ABOUT_ME_SPACE_BEFORE_PT.full).toBeCloseTo(gap, 0);
    expect(Math.abs(ABOUT_ME_SPACE_BEFORE_PT.full - gap)).toBeLessThan(0.25);
  });
});

describe("Projects space-before (§4.2, bounded not measured)", () => {
  it("has no canonical gap to measure — the heading opens page 2", () => {
    const heading = detailed.find((item) => item.text === "Projects");
    expect(heading?.page).toBe(2);
  });

  it("sits within §11.2's tolerance of both canonical bullet-preceded gaps", () => {
    for (const section of ["education", "skills"] as const) {
      expect(Math.abs(SPACE_BEFORE_PT.projects - SPACE_BEFORE_PT[section])).toBeLessThan(2);
    }
  });

  it("stays clear of the basic PDF's page-stretched 34.72, which it rejects", () => {
    const gap = baselineOf(basic, "PageSpeed scores") - baselineOf(basic, "Projects");
    expect(gap).toBeCloseTo(34.72, 2);
    expect(Math.abs(gap - SPACE_BEFORE_PT.projects)).toBeGreaterThan(2);
  });
});
