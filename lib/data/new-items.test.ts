import { describe, expect, it } from "vitest";

import { generateId, libraryIds } from "./ids";
import {
  NEW_BULLET,
  NEW_ENTRY,
  NEW_SKILL,
  build,
  isComplete,
  type NewItemSpec,
} from "./new-items";

/** Which builder each section's fields are meant to feed. */
const BUILDER: Record<keyof typeof NEW_ENTRY, keyof typeof build> = {
  aboutMe: "aboutMe",
  competencies: "competency",
  experience: "experience",
  projects: "project",
  education: "education",
  skills: "skillGroup",
  certifications: "certification",
  languages: "language",
  recommendations: "recommendation",
  custom: "customSection",
};

function fill(spec: NewItemSpec): Record<string, string> {
  return Object.fromEntries(spec.fields.map((field) => [field.name, `<${field.name}>`]));
}

describe("new-item specs", () => {
  it.each(Object.keys(BUILDER) as (keyof typeof NEW_ENTRY)[])(
    "%s: every declared field reaches the built item",
    (type) => {
      const spec = NEW_ENTRY[type];
      const item = build[BUILDER[type]]("generated-id", fill(spec));
      const json = JSON.stringify(item);
      // A field the form collects but the builder ignores would be typed and
      // then silently dropped on save.
      for (const field of spec.fields) expect(json).toContain(`<${field.name}>`);
      expect(json).toContain("generated-id");
    },
  );

  it("carries bullet and skill text through too", () => {
    expect(build.bullet("b", fill(NEW_BULLET))).toMatchObject({ id: "b", text: "<text>" });
    expect(build.skill("s", fill(NEW_SKILL))).toMatchObject({ id: "s", text: "<text>" });
  });

  it("trims whitespace and empties an optional paragraph to null", () => {
    expect(build.competency("c", { text: "  spaced  " }).text).toBe("spaced");
    expect(build.customSection("c", { title: "T", paragraph: "   " }).paragraph).toBeNull();
    expect(build.customSection("c", { title: "T", paragraph: "P" }).paragraph).toBe("P");
  });

  it("starts new items with no tags, no links and no children", () => {
    expect(build.project("p", { title: "T" })).toMatchObject({
      repoUrl: null,
      demoUrl: null,
      bullets: [],
      tags: [],
    });
    expect(build.skillGroup("g", { label: "L" }).skills).toEqual([]);
  });
});

describe("isComplete", () => {
  it("requires every non-optional field", () => {
    const spec = NEW_ENTRY.experience;
    expect(isComplete(spec, { title: "Engineer" })).toBe(false);
    expect(isComplete(spec, { title: "Engineer", company: "Acme" })).toBe(true);
  });

  it("treats whitespace as blank", () => {
    expect(isComplete(NEW_ENTRY.competencies, { text: "   " })).toBe(false);
  });
});

describe("generateId", () => {
  const taken = new Set(["exp-aaaaaa"]);

  it("prefixes by kind", () => {
    expect(generateId("bullet", new Set(), () => "abc123")).toBe("bullet-abc123");
    expect(generateId("skillGroup", new Set(), () => "abc123")).toBe("skills-abc123");
  });

  it("retries past a collision", () => {
    const suffixes = ["aaaaaa", "bbbbbb"];
    let call = 0;
    expect(generateId("experience", taken, () => suffixes[call++])).toBe("exp-bbbbbb");
  });

  it("fails loudly rather than handing back a duplicate", () => {
    // A duplicate ID would silently repoint an existing item.
    expect(() => generateId("experience", taken, () => "aaaaaa")).toThrow(/unique/);
  });

  it("produces a distinct id on real randomness", () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateId("bullet", new Set())));
    expect(ids.size).toBe(200);
  });
});

describe("libraryIds", () => {
  it("collects nested IDs, not just top-level ones", () => {
    const ids = libraryIds({
      schemaVersion: 1,
      header: { name: "", location: "", email: "", phone: "", linkedin: "", github: "" },
      aboutMe: [{ id: "about-1", key: "", text: "", tags: [] }],
      competencies: [],
      experience: [
        {
          id: "exp-1",
          title: "",
          company: "",
          location: "",
          dates: "",
          tags: [],
          bullets: [{ id: "b1", text: "", tags: [] }],
        },
      ],
      projects: [],
      education: [],
      skillGroups: [
        { id: "g1", label: "", tags: [], skills: [{ id: "s1", text: "", tags: [] }] },
      ],
      certifications: [],
      recommendations: [],
      languages: [],
      customSections: [
        { id: "c1", title: "", paragraph: null, tags: [], bullets: [{ id: "cb1", text: "", tags: [] }] },
      ],
    });
    expect([...ids].sort()).toEqual(["about-1", "b1", "c1", "cb1", "exp-1", "g1", "s1"]);
  });
});
