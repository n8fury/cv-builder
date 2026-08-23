/**
 * The guard that makes §11.2's reflow tolerance safe.
 *
 * The harness pairs reflowed lines by position, so nothing in the per-line
 * diff would notice a word being dropped, added, or altered — this check is
 * the only thing standing between "the break moved" and "the copy changed".
 * It gets its own tests for that reason.
 */
import { assertSameText, documentKey } from "./lib/text-identity.mjs";

import { describe, expect, it } from "vitest";

const items = (...texts: string[]) => texts.map((text) => ({ text }));

describe("documentKey", () => {
  it("ignores whitespace, hyphenation and case", () => {
    expect(documentKey(items("Agile -", "Development"))).toBe(
      documentKey(items("Agile Development")),
    );
  });
});

describe("assertSameText", () => {
  it("passes when the same words break across lines differently", () => {
    const golden = items("• Led frontend modernization with", "dynamic product catalogs");
    const actual = items("• Led frontend modernization", "with dynamic product catalogs");
    expect(assertSameText(golden, actual)).toBeNull();
  });

  it("catches a dropped word", () => {
    const result = assertSameText(items("serving 1000+ daily transactions"), items("serving daily transactions"));
    expect(result).toContain("document text differs");
  });

  it("catches an altered number", () => {
    expect(assertSameText(items("achieving 100% test coverage"), items("achieving 90% test coverage")))
      .toContain("document text differs");
  });

  it("catches an added word", () => {
    expect(assertSameText(items("Backend-focused Software Engineer"), items("Backend-focused Senior Software Engineer")))
      .toContain("document text differs");
  });

  it("reports where the divergence starts", () => {
    expect(assertSameText(items("abcdef"), items("abcXef"))).toContain("character 3");
  });
});
