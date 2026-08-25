import { beforeAll, describe, expect, it } from "vitest";

import type { ContentLibrary } from "../schema/library";
import type { Variant } from "../schema/variant";
import { UnknownReferenceError, resolveVariant, type ResolvedSection } from "./resolve";
import { readLibrary, readVariant } from "./store";

let library: ContentLibrary;
let detailed: Variant;

beforeAll(async () => {
  // The real seed data on disk (§12.6), not a fixture.
  library = await readLibrary("jordan-rivera");
  detailed = await readVariant("jordan-rivera", "detailed");
});

function section<T extends ResolvedSection["type"]>(
  sections: ResolvedSection[],
  type: T,
): Extract<ResolvedSection, { type: T }> {
  const found = sections.find((candidate) => candidate.type === type);
  if (!found) throw new Error(`No ${type} section resolved`);
  return found as Extract<ResolvedSection, { type: T }>;
}

describe("resolveVariant against the seed detailed variant", () => {
  it("resolves the section counts stated in SPEC §12.6", () => {
    const { sections } = resolveVariant(library, detailed);

    expect(section(sections, "competencies").items).toHaveLength(9);

    const experience = section(sections, "experience").entries;
    expect(experience).toHaveLength(2);
    expect(experience.flatMap((entry) => entry.bullets)).toHaveLength(10);

    const projects = section(sections, "projects").entries;
    expect(projects).toHaveLength(2);
    expect(projects.flatMap((entry) => entry.bullets)).toHaveLength(6);

    expect(section(sections, "education").entries).toHaveLength(1);

    const groups = section(sections, "skills").groups;
    expect(groups).toHaveLength(7);
    expect(groups.flatMap((group) => group.skills)).toHaveLength(37);

    expect(section(sections, "certifications").entries).toHaveLength(4);
  });

  it("carries the header mode and About Me text through", () => {
    const { sections } = resolveVariant(library, detailed);

    expect(section(sections, "header").mode).toBe("minimal");
    expect(section(sections, "header").header.name).toBe("Jordan A. Rivera");
    expect(section(sections, "aboutMe").text).toMatch(/^Backend-focused Software Engineer/);
  });

  it("keeps the variant's section order and drops nothing visible", () => {
    const { sections } = resolveVariant(library, detailed);

    expect(sections.map((resolved) => resolved.type)).toEqual([
      "header",
      "aboutMe",
      "competencies",
      "experience",
      "projects",
      "education",
      "skills",
      "certifications",
    ]);
  });
});

describe("ordering and visibility", () => {
  it("uses the variant's order, not the library's", () => {
    const reversed: Variant = {
      ...detailed,
      sections: detailed.sections.map((entry) =>
        entry.type === "competencies" ? { ...entry, items: [...entry.items].reverse() } : entry,
      ),
    };

    const forward = section(resolveVariant(library, detailed).sections, "competencies").items;
    const backward = section(resolveVariant(library, reversed).sections, "competencies").items;

    expect(backward.map((item) => item.id)).toEqual(forward.map((item) => item.id).reverse());
  });

  it("drops hidden sections but keeps a visible empty one (§13)", () => {
    const variant: Variant = {
      ...detailed,
      sections: [
        { type: "competencies", visible: true, options: {}, items: [] },
        { type: "education", visible: false, options: {}, entries: [{ id: "sit" }] },
      ],
    };

    const { sections } = resolveVariant(library, variant);
    expect(sections.map((resolved) => resolved.type)).toEqual(["competencies"]);
    expect(section(sections, "competencies").items).toEqual([]);
  });
});

describe("dangling references", () => {
  const cases: [string, Variant["sections"][number]][] = [
    ["competency", { type: "competencies", visible: true, options: {}, items: ["comp-nope"] }],
    [
      "experience entry",
      {
        type: "experience",
        visible: true,
        options: { splitEntries: false },
        entries: [{ id: "nope", bullets: [] }],
      },
    ],
    [
      "experience bullet",
      {
        type: "experience",
        visible: true,
        options: { splitEntries: false },
        entries: [{ id: "northwind", bullets: ["nw-nope"] }],
      },
    ],
    ["aboutMe", { type: "aboutMe", visible: true, options: { aboutMeId: "about-nope" } }],
    [
      "skill",
      {
        type: "skills",
        visible: true,
        options: {},
        groups: [{ id: "skills-backend", skills: ["skill-nope"] }],
      },
    ],
  ];

  it.each(cases)("throws UnknownReferenceError for a dangling %s", (kind, section) => {
    const variant: Variant = { ...detailed, sections: [section] };

    expect(() => resolveVariant(library, variant)).toThrowError(UnknownReferenceError);
    try {
      resolveVariant(library, variant);
    } catch (error) {
      expect((error as UnknownReferenceError).name).toBe("UnknownReferenceError");
      expect((error as UnknownReferenceError).kind).toBe(kind);
      expect((error as Error).message).toContain("nope");
    }
  });
});
