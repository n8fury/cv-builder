/**
 * The section jump rail (SPEC §7, §15.3).
 *
 * Three claims. Every section type can be named, checked against
 * `SECTION_TYPES` so a type added later cannot arrive without a label. Every
 * card the column shows has a chip, and the chip's target is the card's own id
 * — that pairing is what "reachable in one click" means, and the two sides of
 * it are built from the same `sectionKeys` key. And the rail carries no
 * ordering of its own: reordering the sections reorders the rail, while
 * pressing a chip writes nothing at all.
 */
import { describe, expect, it } from "vitest";

import { moved, sectionKeys } from "./ordering";
import { railItems, sectionDomId, sectionLabel } from "./rail";

import { contentLibrarySchema, type ContentLibrary } from "@/lib/schema/library";
import { SECTION_TYPES, type VariantSection } from "@/lib/schema/variant";

const library: ContentLibrary = contentLibrarySchema.parse({
  schemaVersion: 1,
  header: { name: "Jane Doe", email: "jane@example.com" },
  aboutMe: [{ id: "about-default", key: "default", text: "About." }],
  customSections: [
    { id: "custom-1", title: "Publications", bullets: [] },
    { id: "custom-2", title: "   ", bullets: [] },
  ],
});

/** Every section type, held against `SECTION_TYPES` by the first test. */
const sections: VariantSection[] = [
  { type: "header", visible: true, options: { mode: "full", showTitle: false } },
  { type: "aboutMe", visible: true, options: { aboutMeId: "about-default" } },
  { type: "competencies", visible: true, options: {}, items: [] },
  { type: "experience", visible: true, options: { splitEntries: false }, entries: [] },
  { type: "projects", visible: false, options: { splitEntries: false }, entries: [] },
  { type: "education", visible: true, options: {}, entries: [] },
  { type: "skills", visible: true, options: {}, groups: [] },
  { type: "certifications", visible: true, options: {}, entries: [] },
  { type: "languages", visible: true, options: {} },
  { type: "recommendations", visible: true, options: { mode: "collapsed" }, entries: [] },
  { type: "custom", visible: true, options: { customSectionId: "custom-1" } },
];

/** What the form hands the rail: the cards it is showing, and their indices. */
const all = sections.map((section, index) => ({ section, index }));

describe("sectionLabel", () => {
  it("names every section type", () => {
    expect(sections.map((section) => section.type).sort()).toEqual([...SECTION_TYPES].sort());

    for (const section of sections) {
      expect(sectionLabel(section, library).trim()).not.toBe("");
    }
  });

  it("uses the heading the CV prints", () => {
    expect(sectionLabel(sections[3], library)).toBe("Experience");
    expect(sectionLabel(sections[6], library)).toBe("Technical Skills");
    expect(sectionLabel(sections[1], library)).toBe("About Me");
  });

  it("takes a custom section's title from the item it points at", () => {
    expect(sectionLabel(sections[10], library)).toBe("Publications");
  });

  it("still names an untitled or broken custom section", () => {
    const blank: VariantSection = {
      type: "custom",
      visible: true,
      options: { customSectionId: "custom-2" },
    };
    const missing: VariantSection = {
      type: "custom",
      visible: true,
      options: { customSectionId: "custom-gone" },
    };

    expect(sectionLabel(blank, library)).toBe("Custom section");
    expect(sectionLabel(missing, library)).toBe("Custom section");
  });
});

describe("sectionDomId", () => {
  it("gives each card of a repeated type its own target", () => {
    const keys = sectionKeys([{ type: "custom" }, { type: "custom" }, { type: "experience" }]);
    const ids = keys.map(sectionDomId);

    expect(ids).toEqual(["section-custom-0", "section-custom-1", "section-experience-0"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("survives a reorder, which is what a drag does under an open rail", () => {
    const before = sectionKeys(sections).map(sectionDomId);
    const after = sectionKeys(moved(sections, 3, 0)).map(sectionDomId);

    // The Experience card keeps the id the rail was drawn with, even though
    // every index below it has changed.
    expect(before).toContain("section-experience-0");
    expect(after).toContain("section-experience-0");
    expect(after[0]).toBe("section-experience-0");
  });
});

describe("railItems", () => {
  const keys = sectionKeys(sections);

  it("gives every shown section a chip, in the variant's order", () => {
    const items = railItems(all, keys, library);

    expect(items).toHaveLength(sections.length);
    expect(items.map((item) => item.type)).toEqual(sections.map((section) => section.type));
    expect(items.map((item) => item.title)).toEqual(
      sections.map((section) => sectionLabel(section, library)),
    );
  });

  it("targets the card's own id", () => {
    for (const item of railItems(all, keys, library)) {
      expect(item.id).toBe(sectionDomId(keys[item.index]));
    }
  });

  it("follows the sections rather than holding an order of its own", () => {
    const reordered = moved(sections, 0, sections.length - 1);
    const items = railItems(
      reordered.map((section, index) => ({ section, index })),
      sectionKeys(reordered),
      library,
    );

    expect(items[items.length - 1].title).toBe("Header");
    expect(items[0].title).toBe("About Me");
  });

  it("shows only the cards the filter left, keeping their real indices", () => {
    const shown = [all[3], all[9]];
    const items = railItems(shown, keys, library);

    expect(items.map((item) => item.title)).toEqual(["Experience", "Recommendations"]);
    expect(items.map((item) => item.index)).toEqual([3, 9]);
    expect(items.map((item) => item.id)).toEqual([
      "section-experience-0",
      "section-recommendations-0",
    ]);
  });

  it("keeps a chip for a hidden section, marked as one", () => {
    const items = railItems(all, keys, library);
    const projects = items.find((item) => item.type === "projects")!;

    expect(projects.visible).toBe(false);
    expect(items.filter((item) => !item.visible)).toHaveLength(1);
  });
});
