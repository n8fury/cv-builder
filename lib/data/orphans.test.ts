import { describe, expect, it } from "vitest";

import { contentLibrarySchema, type ContentLibrary } from "../schema/library";
import { variantSchema, type Variant } from "../schema/variant";
import { deleteItem, itemAndDescendantIds } from "./library-edit";
import { blockingVariants, findOrphans, indexReferences } from "./orphans";
import { resolveVariant } from "./resolve";

const library: ContentLibrary = contentLibrarySchema.parse({
  schemaVersion: 1,
  competencies: [
    { id: "comp-used", text: "Used" },
    { id: "comp-orphan", text: "Nothing points here" },
  ],
  experience: [
    {
      id: "exp-used",
      title: "Dev",
      company: "Co",
      location: "",
      dates: "",
      bullets: [
        { id: "b-used", text: "In a variant" },
        { id: "b-orphan", text: "Left out of every variant" },
      ],
    },
    {
      id: "exp-orphan",
      title: "Old job",
      company: "Gone",
      location: "",
      dates: "",
      bullets: [{ id: "b-under-orphan", text: "Only reachable through exp-orphan" }],
    },
  ],
});

function variant(
  id: string,
  bullets: string[],
  competencies: string[],
  visible = true,
): { id: string; variant: Variant } {
  return {
    id,
    variant: variantSchema.parse({
      schemaVersion: 1,
      tag: id,
      label: "",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
      sections: [
        { type: "competencies", visible: true, options: {}, items: competencies },
        // A hidden section is still curation the person chose (§12.2), and its
        // references still count — `resolveVariant` skips hidden sections, so
        // a dangling one there does not throw *today*, but does the moment the
        // section is switched back on.
        { type: "experience", visible, options: {}, entries: [{ id: "exp-used", bullets }] },
      ],
    }),
  };
}

const variants = [
  variant("alpha", ["b-used"], ["comp-used"]),
  variant("beta", ["b-used"], [], false),
];
const references = indexReferences(variants);

describe("findOrphans", () => {
  it("finds every item no variant references, at both levels", () => {
    expect(findOrphans(library, references).map((item) => item.id).sort()).toEqual([
      "b-orphan",
      "b-under-orphan",
      "comp-orphan",
      "exp-orphan",
    ]);
  });

  it("counts a hidden section's references as references", () => {
    // beta names exp-used and b-used from a section with `visible: false`.
    const hiddenOnly = indexReferences([variant("beta", ["b-used"], [], false)]);
    expect(hiddenOnly.has("exp-used")).toBe(true);
    expect(findOrphans(library, hiddenOnly).map((item) => item.id)).not.toContain("b-used");
  });

  it("judges a bullet on its own reference, not its parent's", () => {
    // exp-used is in both variants; b-orphan, one of its bullets, is in neither.
    expect(findOrphans(library, references).map((item) => item.id)).toContain("b-orphan");
  });

  it("reports nothing when every item is used", () => {
    const full = [variant("alpha", ["b-used", "b-orphan"], ["comp-used", "comp-orphan"])];
    const orphans = findOrphans(library, indexReferences(full)).map((item) => item.id);
    expect(orphans).toEqual(["exp-orphan", "b-under-orphan"]);
  });
});

describe("blockingVariants", () => {
  it("names every variant using the item, in one list", () => {
    expect(blockingVariants(references, "b-used").sort()).toEqual(["alpha", "beta"]);
    expect(blockingVariants(references, "comp-used")).toEqual(["alpha"]);
    expect(blockingVariants(references, "comp-orphan")).toEqual([]);
  });

  it("covers the nested ids a delete would take with it", () => {
    // Deleting exp-used would remove b-used too, which both variants name.
    const blocked = itemAndDescendantIds(library, "exp-used").flatMap((id) =>
      blockingVariants(references, id),
    );
    expect([...new Set(blocked)].sort()).toEqual(["alpha", "beta"]);

    // exp-orphan's only bullet is unreferenced too, so it is safe to remove.
    expect(
      itemAndDescendantIds(library, "exp-orphan").flatMap((id) => blockingVariants(references, id)),
    ).toEqual([]);
  });
});

describe("deleteItem", () => {
  it("removes an orphan and leaves everything else in place", () => {
    const next = deleteItem(library, "comp-orphan");
    expect(next.competencies.map((item) => item.id)).toEqual(["comp-used"]);
    expect(next.experience).toEqual(library.experience);
  });

  it("removes a nested bullet without touching its entry", () => {
    const next = deleteItem(library, "b-orphan");
    expect(next.experience[0].bullets.map((bullet) => bullet.id)).toEqual(["b-used"]);
    expect(next.experience[0].title).toBe("Dev");
  });

  it("takes an entry's bullets with it", () => {
    const next = deleteItem(library, "exp-orphan");
    expect(next.experience.map((entry) => entry.id)).toEqual(["exp-used"]);
    expect(JSON.stringify(next)).not.toContain("b-under-orphan");
  });

  it("leaves the surviving variants resolvable — the point of the block", () => {
    const next = deleteItem(library, "comp-orphan");
    for (const { variant: doc } of variants) {
      expect(() => resolveVariant(next, doc)).not.toThrow();
    }
    // And deleting a *referenced* item is exactly what would break them, which
    // is why the action checks `blockingVariants` before calling this.
    const broken = deleteItem(library, "b-used");
    expect(() => resolveVariant(broken, variants[0].variant)).toThrow();
    // beta survives only because its section is hidden — switch it on and the
    // same missing id breaks it too, which is why hidden references still block.
    const shown = variantSchema.parse({
      ...variants[1].variant,
      sections: variants[1].variant.sections.map((section) => ({ ...section, visible: true })),
    });
    expect(() => resolveVariant(broken, shown)).toThrow();
  });
});
