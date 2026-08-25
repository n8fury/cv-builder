import { describe, expect, it } from "vitest";

import { SECTION_TYPES, variantSchema, type Variant } from "../schema/variant";
import { danglingRefs, mapVariantRefs, repointVariant, variantReferencedIds } from "./variant-refs";

/** One section of every type, each referencing distinctly named ids. */
const variant: Variant = variantSchema.parse({
  schemaVersion: 1,
  tag: "t",
  label: "",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  sections: [
    { type: "header", visible: true, options: { mode: "minimal" } },
    { type: "aboutMe", visible: true, options: { aboutMeId: "about-1" } },
    { type: "competencies", visible: true, options: {}, items: ["comp-1", "comp-2"] },
    {
      type: "experience",
      visible: true,
      options: {},
      entries: [{ id: "exp-1", bullets: ["b1", "b2"] }],
    },
    { type: "projects", visible: true, options: {}, entries: [{ id: "proj-1", bullets: ["pb1"] }] },
    { type: "education", visible: true, options: {}, entries: [{ id: "edu-1" }] },
    {
      type: "skills",
      visible: true,
      options: {},
      groups: [{ id: "skills-1", skills: ["skill-1"] }],
    },
    { type: "certifications", visible: true, options: {}, entries: [{ id: "cert-1" }] },
    { type: "languages", visible: true, options: {} },
    {
      type: "recommendations",
      visible: true,
      options: { mode: "expanded" },
      entries: [{ id: "rec-1" }],
    },
    { type: "custom", visible: true, options: { customSectionId: "custom-1" } },
  ],
});

describe("variantReferencedIds", () => {
  it("names every referenced id, at every level", () => {
    expect([...variantReferencedIds(variant)].sort()).toEqual([
      "about-1",
      "b1",
      "b2",
      "cert-1",
      "comp-1",
      "comp-2",
      "custom-1",
      "edu-1",
      "exp-1",
      "pb1",
      "proj-1",
      "rec-1",
      "skill-1",
      "skills-1",
    ]);
  });

  it("covers every section type the schema defines", () => {
    // A section type handled by the schema but not by this walk would make a
    // fork drop a reference, or an orphan check call a live item unused.
    expect(variant.sections.map((section) => section.type).sort()).toEqual(
      [...SECTION_TYPES].sort(),
    );
  });
});

describe("repointVariant", () => {
  it("swaps only the named ids and leaves curation and order alone", () => {
    const next = repointVariant(variant, new Map([["b1", "bullet-new"]]));

    const experience = next.sections.find((section) => section.type === "experience");
    expect(experience?.type === "experience" && experience.entries[0]).toEqual({
      id: "exp-1",
      bullets: ["bullet-new", "b2"],
    });
    // Nothing else moved: same sections, same order, same everything else.
    expect(next.sections.map((section) => section.type)).toEqual(
      variant.sections.map((section) => section.type),
    );
    expect(variantReferencedIds(next).has("b1")).toBe(false);
    expect(variantReferencedIds(next).has("b2")).toBe(true);
  });

  it("is a no-op when nothing matches", () => {
    expect(repointVariant(variant, new Map([["nope", "other"]]))).toEqual(variant);
  });

  it("writes no `order` field while rebuilding sections (§15.3)", () => {
    expect(JSON.stringify(mapVariantRefs(variant, (id) => id))).not.toContain('"order"');
  });
});

describe("danglingRefs", () => {
  it("reports every unknown id once, in the order the variant names them", () => {
    const known = new Set(variantReferencedIds(variant));
    known.delete("about-1");
    known.delete("b2");

    expect(danglingRefs(variant, known)).toEqual(["about-1", "b2"]);
  });

  it("names a repeated id once", () => {
    // Two slots pointing at the same missing item are one missing item; a
    // caller listing it twice would read as two separate mistakes.
    const repeated = repointVariant(variant, new Map([["b1", "gone"], ["b2", "gone"]]));

    expect(danglingRefs(repeated, variantReferencedIds(variant))).toEqual(["gone"]);
  });

  it("is empty when the library satisfies the whole variant", () => {
    expect(danglingRefs(variant, variantReferencedIds(variant))).toEqual([]);
  });
});
