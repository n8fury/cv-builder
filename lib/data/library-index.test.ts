import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { contentLibrarySchema, type ContentLibrary } from "../schema/library";
import {
  EXCLUDED_FIELDS,
  allTags,
  filterByTag,
  ITEM_FIELDS,
  ITEM_SCHEMAS,
  flattenItems,
  indexLibrary,
  type LibraryItemKind,
} from "./library-index";

const seed: ContentLibrary = contentLibrarySchema.parse(
  JSON.parse(
    readFileSync(
      join(process.cwd(), "data", "profiles", "jordan-rivera", "content-library.json"),
      "utf8",
    ),
  ),
);

const kinds = Object.keys(ITEM_SCHEMAS) as LibraryItemKind[];

describe("indexLibrary", () => {
  it("offers every schema field of every kind, minus the ones it never edits", () => {
    // A field added to content-library.json but not here would be stored,
    // rendered, and impossible to change from the one screen meant to edit it.
    for (const kind of kinds) {
      const expected = Object.keys(ITEM_SCHEMAS[kind].shape)
        .filter((name) => !EXCLUDED_FIELDS.includes(name as (typeof EXCLUDED_FIELDS)[number]))
        .sort();
      const offered = ITEM_FIELDS[kind].map((field) => field.name).sort();
      expect(offered, `fields for ${kind}`).toEqual(expected);
    }
  });

  it("groups the seed library by type, every group present", () => {
    const groups = indexLibrary(seed);
    expect(groups.map((group) => group.label)).toEqual([
      "About Me",
      "Core Competencies",
      "Experience",
      "Projects",
      "Education",
      "Technical Skills",
      "Certifications",
      "Recommendations",
      "Languages",
      "Custom Sections",
    ]);
    // §12.6's seed counts, as the resolver's own test pins them.
    expect(groups.find((group) => group.collection === "competencies")?.items).toHaveLength(9);
    expect(groups.find((group) => group.collection === "experience")?.items).toHaveLength(2);
    expect(groups.find((group) => group.collection === "skillGroups")?.items).toHaveLength(7);
  });

  it("nests bullets under their entry and skills inside their group", () => {
    const groups = indexLibrary(seed);
    const experience = groups.find((group) => group.collection === "experience")!;
    const bullets = experience.items.flatMap((entry) => entry.children);

    expect(bullets.length).toBeGreaterThan(0);
    expect(bullets.every((bullet) => bullet.kind === "bullet")).toBe(true);
    expect(bullets.every((bullet) => bullet.parentId !== null)).toBe(true);

    const skills = groups
      .find((group) => group.collection === "skillGroups")!
      .items.flatMap((group) => group.children);
    expect(skills).toHaveLength(37);
    expect(skills.every((skill) => skill.kind === "skill")).toBe(true);
  });

  it("carries each item's id and tags", () => {
    const items = flattenItems(indexLibrary(seed));
    expect(items.every((item) => item.id.length > 0)).toBe(true);
    expect(items.every((item) => Array.isArray(item.tags))).toBe(true);
  });

  it("gives every item a headline, falling back to its id when blank", () => {
    const items = flattenItems(indexLibrary(seed));
    expect(items.every((item) => item.title.length > 0)).toBe(true);

    const blank = indexLibrary(
      contentLibrarySchema.parse({
        schemaVersion: 1,
        competencies: [{ id: "comp-blank", text: "" }],
      }),
    );
    expect(blank.find((group) => group.collection === "competencies")?.items[0]?.title).toBe(
      "comp-blank",
    );
  });

  it("keeps empty collections so they stay visible", () => {
    const groups = indexLibrary(contentLibrarySchema.parse({ schemaVersion: 1 }));
    expect(groups).toHaveLength(10);
    expect(groups.every((group) => group.items.length === 0)).toBe(true);
  });
});

describe("tag filtering", () => {
  const tagged = contentLibrarySchema.parse({
    schemaVersion: 1,
    competencies: [
      { id: "comp-a", text: "Tagged", tags: ["backend"] },
      { id: "comp-b", text: "Untagged" },
    ],
    experience: [
      {
        id: "exp-1",
        title: "Dev",
        company: "Co",
        location: "",
        dates: "",
        tags: [],
        bullets: [
          { id: "b1", text: "Tagged bullet", tags: ["backend"] },
          { id: "b2", text: "Other bullet", tags: ["ml"] },
        ],
      },
    ],
  });

  it("collects every tag in use, sorted", () => {
    expect(allTags(indexLibrary(tagged))).toEqual(["backend", "ml"]);
  });

  it("keeps matching items and the parents needed to reach them", () => {
    const filtered = filterByTag(indexLibrary(tagged), "backend");
    const ids = flattenItems(filtered).map((item) => item.id);

    // comp-a matched; exp-1 did not, but is kept because b1 did; b2 is gone.
    expect(ids).toEqual(["comp-a", "exp-1", "b1"]);
  });

  it("filters to nothing for a tag no item carries", () => {
    expect(flattenItems(filterByTag(indexLibrary(tagged), "nope"))).toHaveLength(0);
  });
});
