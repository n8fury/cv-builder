/**
 * Turning a measured bullet into a count of lines (SPEC §16.3, §11.5).
 *
 * The arithmetic is the whole claim: bullets are consecutive body-leading
 * lines with no gap between them (§4.5), so a bullet's height *is* its line
 * count times the leading. What has to hold is that the browser's rounding —
 * heights come back rounded to whole device pixels — never turns a
 * three-line bullet into a two-line reading.
 */
import { describe, expect, it } from "vitest";

import { lineCount, sameLines } from "./line-counts";

import { BODY_LEADING_PT } from "@/lib/render/metrics";

describe("lineCount", () => {
  it("reads whole multiples of the body leading", () => {
    expect(lineCount(BODY_LEADING_PT)).toBe(1);
    expect(lineCount(BODY_LEADING_PT * 3)).toBe(3);
    expect(lineCount(BODY_LEADING_PT * 7)).toBe(7);
  });

  it("survives the browser's rounding either way", () => {
    expect(lineCount(BODY_LEADING_PT * 3 - 0.4)).toBe(3);
    expect(lineCount(BODY_LEADING_PT * 3 + 0.4)).toBe(3);
  });

  it("never reports less than the line a bullet always occupies", () => {
    expect(lineCount(0)).toBe(1);
    expect(lineCount(-5)).toBe(1);
    expect(lineCount(1)).toBe(1);
    expect(lineCount(Number.NaN)).toBe(1);
  });

  it("takes the leading it is given, for a section set on another one", () => {
    expect(lineCount(32, 16)).toBe(2);
  });
});

describe("sameLines", () => {
  it("is the question the preview asks before telling anyone", () => {
    const a = new Map([["b1", 3], ["b2", 1]]);

    expect(sameLines(a, new Map([["b1", 3], ["b2", 1]]))).toBe(true);
    expect(sameLines(a, new Map([["b1", 4], ["b2", 1]]))).toBe(false);
    expect(sameLines(a, new Map([["b1", 3]]))).toBe(false);
    expect(sameLines(a, new Map([["b1", 3], ["b3", 1]]))).toBe(false);
  });
});
