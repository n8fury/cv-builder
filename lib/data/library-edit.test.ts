import { describe, expect, it } from "vitest";

import { contentLibrarySchema, type ContentLibrary } from "../schema/library";
import { resolveVariant } from "./resolve";
import {
  UnknownItemError,
  findItem,
  forkItem,
  parseTags,
  setItemTags,
  updateItemFields,
} from "./library-edit";
import { variantSchema, type Variant } from "../schema/variant";
import { repointVariant } from "./variant-refs";

const library: ContentLibrary = contentLibrarySchema.parse({
  schemaVersion: 1,
  competencies: [{ id: "comp-1", text: "Original phrase" }],
  experience: [
    {
      id: "exp-1",
      title: "Dev",
      company: "Co",
      location: "Springfield",
      dates: "2024 - Present",
      bullets: [{ id: "b1", text: "Original bullet" }],
    },
    {
      id: "exp-2",
      title: "Freelance",
      company: "Self",
      location: "",
      dates: "",
      // The seed library repeats a bullet id across entries; the manager
      // addresses items by id alone, so this pins that it stays unique.
      bullets: [{ id: "b2", text: "Other bullet" }],
    },
  ],
  projects: [
    { id: "proj-1", title: "Thing", subtitle: "Sub", dates: "", repoUrl: null, bullets: [] },
  ],
  skillGroups: [{ id: "skills-1", label: "Backend", skills: [{ id: "skill-1", text: "Node.js" }] }],
});

function variantReferencing(bulletId: string): Variant {
  return variantSchema.parse({
    schemaVersion: 1,
    tag: "t",
    label: "",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    sections: [
      {
        type: "experience",
        visible: true,
        options: {},
        entries: [{ id: "exp-1", bullets: [bulletId] }],
      },
    ],
  });
}

describe("updateItemFields", () => {
  it("rewrites a bullet's text in place, leaving its id, tags and siblings alone", () => {
    const next = updateItemFields(library, "b1", { text: "Rewritten bullet" });

    expect(next.experience[0].bullets[0]).toEqual({
      id: "b1",
      text: "Rewritten bullet",
      tags: [],
    });
    expect(next.experience[1].bullets[0].text).toBe("Other bullet");
    expect(next.competencies).toEqual(library.competencies);
  });

  it("propagates to every variant referencing the id — the variant holds no text", () => {
    const next = updateItemFields(library, "b1", { text: "Rewritten bullet" });

    // Two variants, resolved against the *same* edited library (§11.4, §6.2).
    for (const variant of [variantReferencing("b1"), variantReferencing("b1")]) {
      const section = resolveVariant(next, variant).sections[0];
      expect(section.type).toBe("experience");
      if (section.type !== "experience") throw new Error("unreachable");
      expect(section.entries[0].bullets[0].text).toBe("Rewritten bullet");
    }
  });

  it("edits top-level items of every shape, not just bullets", () => {
    expect(updateItemFields(library, "comp-1", { text: "New phrase" }).competencies[0].text).toBe(
      "New phrase",
    );
    const entry = updateItemFields(library, "exp-1", { title: "Senior Dev" }).experience[0];
    expect(entry.title).toBe("Senior Dev");
    // An absent key leaves its field alone rather than blanking it.
    expect(entry.company).toBe("Co");
    expect(entry.bullets).toHaveLength(1);

    const group = updateItemFields(library, "skills-1", { label: "Server" }).skillGroups[0];
    expect(group.label).toBe("Server");
    expect(group.skills[0].text).toBe("Node.js");
  });

  it("writes a blank link as null, since the schema rejects an empty string", () => {
    const set = updateItemFields(library, "proj-1", { repoUrl: "https://example.com/repo" });
    expect(set.projects[0].repoUrl).toBe("https://example.com/repo");
    expect(updateItemFields(set, "proj-1", { repoUrl: "  " }).projects[0].repoUrl).toBeNull();
  });

  it("ignores keys the kind does not declare", () => {
    const next = updateItemFields(library, "comp-1", { text: "Kept", nonsense: "dropped" });
    expect(next.competencies[0]).toEqual({ id: "comp-1", text: "Kept", tags: [] });
  });

  it("rejects an id no item carries rather than silently doing nothing", () => {
    expect(() => updateItemFields(library, "missing", { text: "x" })).toThrow(UnknownItemError);
  });

  it("rejects a value the schema will not store", () => {
    expect(() => updateItemFields(library, "proj-1", { repoUrl: "not a url" })).toThrow();
  });
});

describe("findItem", () => {
  it("locates items at both levels, with their kind and parent", () => {
    expect(findItem(library, "exp-1")).toMatchObject({ kind: "experience", parentId: null });
    expect(findItem(library, "b1")).toMatchObject({ kind: "bullet", parentId: "exp-1" });
    expect(findItem(library, "skill-1")).toMatchObject({ kind: "skill", parentId: "skills-1" });
    expect(findItem(library, "nope")).toBeNull();
  });
});

describe("forkItem", () => {
  const generate = () => {
    let n = 0;
    return () => `forked-${(n += 1)}`;
  };

  it("copies the item under a new id and leaves the original in place", () => {
    const { library: next, replacements } = forkItem(library, "b1", generate());

    expect(replacements.get("b1")).toBe("forked-1");
    expect(next.experience[0].bullets.map((bullet) => bullet.id)).toEqual(["b1", "forked-1"]);
    expect(next.experience[0].bullets[1].text).toBe("Original bullet");
    // The original keeps its id, so every variant on it renders it still.
    expect(next.experience[0].bullets[0]).toEqual(library.experience[0].bullets[0]);
  });

  it("repoints only the variant it is applied to", () => {
    const { library: next, replacements } = forkItem(library, "b1", generate());
    const forked = repointVariant(variantReferencing("b1"), replacements);
    const untouched = variantReferencing("b1");

    const textOf = (variant: Variant) => {
      const section = resolveVariant(next, variant).sections[0];
      if (section.type !== "experience") throw new Error("unreachable");
      return section.entries[0].bullets[0];
    };

    expect(textOf(forked).id).toBe("forked-1");
    expect(textOf(untouched).id).toBe("b1");

    // Editing the fork must not reach the variant still on the original.
    const edited = updateItemFields(next, "forked-1", { text: "Job-specific wording" });
    expect(textOf(forked)).toEqual({ id: "forked-1", text: "Original bullet" });
    const section = resolveVariant(edited, forked).sections[0];
    if (section.type !== "experience") throw new Error("unreachable");
    expect(section.entries[0].bullets[0].text).toBe("Job-specific wording");
    expect(resolveVariant(edited, untouched).sections[0]).toEqual(
      resolveVariant(library, untouched).sections[0],
    );
  });

  it("gives a forked entry's bullets fresh ids of their own", () => {
    const { library: next, replacements } = forkItem(library, "exp-1", generate());
    const copy = next.experience[1];

    expect(next.experience.map((entry) => entry.id)).toEqual(["exp-1", "forked-1", "exp-2"]);
    expect(copy.bullets.map((bullet) => bullet.id)).toEqual(["forked-2"]);
    expect(replacements.get("b1")).toBe("forked-2");
    // Sharing bullets with the original would leave the fork only half
    // independent — an edit to one would propagate straight back (§11.4).
    expect(copy.bullets[0].id).not.toBe(library.experience[0].bullets[0].id);
  });

  it("forks a skill inside its group and a top-level item alike", () => {
    const skills = forkItem(library, "skill-1", generate()).library.skillGroups[0].skills;
    expect(skills.map((skill) => skill.id)).toEqual(["skill-1", "forked-1"]);

    const comps = forkItem(library, "comp-1", generate()).library.competencies;
    expect(comps.map((item) => item.id)).toEqual(["comp-1", "forked-1"]);
  });

  it("rejects an id no item carries", () => {
    expect(() => forkItem(library, "missing", generate())).toThrow(UnknownItemError);
  });
});

describe("tags", () => {
  it("normalises what was typed: lowercased, trimmed, de-duplicated in order", () => {
    expect(parseTags(" Backend , iot,backend ,, ML ")).toEqual(["backend", "iot", "ml"]);
    expect(parseTags("   ")).toEqual([]);
  });

  it("replaces one item's tags and leaves its text and children alone", () => {
    const next = setItemTags(library, "exp-1", ["backend", "iot"]);
    expect(next.experience[0].tags).toEqual(["backend", "iot"]);
    expect(next.experience[0].title).toBe("Dev");
    expect(next.experience[0].bullets).toEqual(library.experience[0].bullets);
    expect(next.experience[1].tags).toEqual([]);
  });

  it("tags a nested bullet without touching its entry", () => {
    const next = setItemTags(library, "b1", ["ml"]);
    expect(next.experience[0].bullets[0].tags).toEqual(["ml"]);
    expect(next.experience[0].tags).toEqual([]);
  });

  it("clears tags when given none", () => {
    expect(setItemTags(setItemTags(library, "b1", ["ml"]), "b1", []).experience[0].bullets[0].tags)
      .toEqual([]);
  });

  it("rejects an id no item carries", () => {
    expect(() => setItemTags(library, "missing", ["x"])).toThrow(UnknownItemError);
  });
});
