import { describe, expect, it } from "vitest";

import { isValidSlug } from "./store";
import { isoDate, saveAsVariantId, slugifyTag } from "./variant-name";

const AUGUST = new Date("2026-08-22T14:30:00.000Z");

describe("saveAsVariantId", () => {
  it("names a fork {tag}_{date} (§12.5)", () => {
    expect(saveAsVariantId("google-swe", AUGUST)).toBe("google-swe_2026-08-22");
  });

  it("reduces a typed tag to something a filename can hold", () => {
    expect(saveAsVariantId("Google — Backend SWE", AUGUST)).toBe("google-backend-swe_2026-08-22");
    expect(slugifyTag("  Spaced   Out  ")).toBe("spaced-out");
    expect(slugifyTag("a/b\\c")).toBe("a-b-c");
  });

  it("produces an id the store will accept", () => {
    for (const tag of ["google-swe", "Google — Backend SWE", "ACME 2026", "n8n_draft"]) {
      expect(isValidSlug(saveAsVariantId(tag, AUGUST)!)).toBe(true);
    }
  });

  it("refuses a tag with nothing to name a file after", () => {
    // A file called `_2026-08-22` would say nothing about its contents.
    expect(saveAsVariantId("!!!", AUGUST)).toBeNull();
    expect(saveAsVariantId("   ", AUGUST)).toBeNull();
  });

  it("dates by day, in UTC", () => {
    expect(isoDate(AUGUST)).toBe("2026-08-22");
    expect(isoDate(new Date("2026-01-01T23:59:59.000Z"))).toBe("2026-01-01");
  });
});
