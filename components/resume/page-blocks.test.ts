import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { KEEP_WITH_NEXT_SELECTOR, UNBREAKABLE_SELECTOR } from "./page-blocks";

const css = readFileSync(join(process.cwd(), "components/resume/resume.css"), "utf8");

/**
 * The class selectors of every rule whose body declares `property: avoid`.
 * Deliberately crude — it only has to see the flat class rules this
 * stylesheet uses, and a rule it fails to parse surfaces as a mismatch here
 * rather than as silence.
 */
function selectorsDeclaring(property: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found = new Set<string>();
  // A selector holds no braces and no semicolon; a declaration block, being
  // innermost, holds no braces either — which is what steps over @media.
  for (const [, selector, body] of bare.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
    const declares = body.split(";").some((d) => d.trim() === `${property}: avoid`);
    if (!declares) continue;
    for (const part of selector.split(",")) {
      const name = part.trim();
      expect(name, `unparsed selector in ${property} rule`).toMatch(/^\./);
      found.add(name);
    }
  }
  return [...found].sort();
}

function parse(selector: string): string[] {
  return selector
    .split(",")
    .map((part) => part.trim())
    .sort();
}

describe("page-blocks", () => {
  it("lists exactly what the stylesheet marks break-inside: avoid", () => {
    expect(parse(UNBREAKABLE_SELECTOR)).toEqual(selectorsDeclaring("break-inside"));
  });

  it("lists exactly what the stylesheet marks break-after: avoid", () => {
    expect(parse(KEEP_WITH_NEXT_SELECTOR)).toEqual(selectorsDeclaring("break-after"));
  });

  it("keeps every keep-with-next block unbreakable too", () => {
    // §15.11: break-after alone lets Chromium satisfy the rule by breaking
    // *inside* the heading, which moves nothing.
    for (const name of parse(KEEP_WITH_NEXT_SELECTOR)) {
      expect(parse(UNBREAKABLE_SELECTOR)).toContain(name);
    }
  });
});
