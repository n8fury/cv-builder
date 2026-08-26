/**
 * The rail as it is drawn (SPEC §7).
 *
 * `rail.test.ts` settles what the chips are; this settles that each one is a
 * real button pointing at a real card, that a hidden section still gets one,
 * and that a rail with nothing to jump between is not drawn at all.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SectionRail } from "./SectionRail";
import { railItems } from "./rail";

import { contentLibrarySchema } from "@/lib/schema/library";
import type { VariantSection } from "@/lib/schema/variant";

const library = contentLibrarySchema.parse({
  schemaVersion: 1,
  header: { name: "Jane Doe", email: "jane@example.com" },
  aboutMe: [{ id: "about-default", key: "default", text: "About." }],
});

const sections: VariantSection[] = [
  { type: "header", visible: true, options: { mode: "full", showTitle: false } },
  { type: "experience", visible: true, options: { splitEntries: false }, entries: [] },
  { type: "projects", visible: false, options: { splitEntries: false }, entries: [] },
];

const noop = () => {};

function markup(shownIndexes: number[]): string {
  const shown = shownIndexes.map((index) => ({ section: sections[index], index }));
  const keys = ["header#0", "experience#0", "projects#0"];
  return renderToStaticMarkup(
    <SectionRail items={railItems(shown, keys, library)} onHeight={noop} />,
  );
}

describe("SectionRail", () => {
  it("draws one button per section, in order", () => {
    const html = markup([0, 1, 2]);
    const labels = [...html.matchAll(/>([^<>]+)<\/button>/g)].map((match) => match[1]);

    expect(labels).toEqual(["Header", "Experience", "Projects"]);
    expect(html).toContain('data-rail-jump="header#0"');
    expect(html).toContain('data-rail-jump="experience#0"');
    expect(html).toContain('data-rail-jump="projects#0"');
  });

  it("says in words where each chip goes, and which section is switched off", () => {
    const html = markup([0, 1, 2]);

    expect(html).toContain("Jump to the Experience section");
    expect(html).toContain("Jump to the Projects section — hidden in this variant");
  });

  it("is not drawn when there is nowhere to jump", () => {
    expect(markup([1])).toBe("");
    expect(markup([])).toBe("");
  });

  it("shows only what the filter left", () => {
    const html = markup([1, 2]);

    expect(html).not.toContain('data-rail-jump="header#0"');
    expect(html).toContain('data-rail-jump="experience#0"');
  });
});
