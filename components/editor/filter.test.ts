/**
 * The editor's text filter (SPEC §7, §6.1).
 *
 * Two claims are worth testing and one of them is a negative. The first is
 * that a term narrows *every* section — which is checked against a fixture
 * held to cover every section type in `SECTION_TYPES`, so a type added later
 * cannot quietly go unfiltered. The second is that narrowing is not an edit:
 * the draft a filtered form is looking at must be the identical object, with
 * no undo step behind it, however hard it is searched.
 */
import { describe, expect, it } from "vitest";

import { filterNote, filterTerms, matchSection, matchSections } from "./filter";
import { canUndo } from "./history";
import { createEditorStore, type EditorSnapshot } from "./store";

import { contentLibrarySchema } from "@/lib/schema/library";
import { SECTION_TYPES, type Variant, type VariantSection } from "@/lib/schema/variant";

const library = contentLibrarySchema.parse({
  schemaVersion: 1,
  header: {
    name: "Jane Doe",
    title: "Staff Engineer",
    location: "Berlin",
    email: "jane@example.com",
    phone: "+49 000",
    linkedin: "linkedin.com/in/jane",
    github: "github.com/jane",
    links: [{ id: "link-1", text: "portfolio.example.com", url: "https://portfolio.example.com" }],
  },
  aboutMe: [{ id: "about-default", key: "default", text: "Builds distributed systems." }],
  competencies: [
    { id: "comp-1", text: "Distributed systems", tags: ["backend"] },
    { id: "comp-2", text: "Soldering", tags: ["iot"] },
  ],
  experience: [
    {
      id: "exp-1",
      title: "Backend Engineer",
      company: "Acme",
      location: "Berlin",
      dates: "2022 — now",
      tags: ["backend"],
      bullets: [
        { id: "b1", text: "Built the payments API", tags: ["backend"] },
        { id: "b2", text: "Mentored three interns" },
      ],
    },
    {
      id: "exp-2",
      title: "Firmware Engineer",
      company: "Globex",
      location: "Munich",
      dates: "2019 — 2022",
      tags: ["iot"],
      bullets: [
        { id: "b3", text: "Shipped an API gateway" },
        { id: "b4", text: "Wrote device drivers" },
      ],
    },
  ],
  projects: [
    {
      id: "proj-1",
      title: "Sensor mesh",
      subtitle: "LoRa",
      dates: "2021",
      tags: ["iot"],
      bullets: [{ id: "pb1", text: "Rolled out mesh routing" }],
    },
  ],
  education: [
    {
      id: "edu-1",
      institution: "State University",
      degree: "BSc Computer Science",
      dates: "2015 — 2019",
      description: "Thesis on scheduling",
    },
  ],
  skillGroups: [
    {
      id: "skills-1",
      label: "Languages",
      skills: [
        { id: "sk-1", text: "Go" },
        { id: "sk-2", text: "Rust" },
      ],
    },
    { id: "skills-2", label: "Cloud", skills: [{ id: "sk-3", text: "Kubernetes" }] },
  ],
  certifications: [{ id: "cert-1", text: "AWS Solutions Architect", dates: "2023" }],
  recommendations: [
    { id: "rec-1", name: "John Smith", role: "CTO", location: "Hamburg", email: "john@example.com" },
  ],
  languages: [{ id: "lang-1", language: "English", proficiency: "Native" }],
  customSections: [
    {
      id: "custom-1",
      title: "Publications",
      paragraph: "Selected papers.",
      bullets: [{ id: "cb1", text: "A paper about caching" }],
    },
  ],
});

/**
 * Every section type, deliberately — the completeness check below holds this
 * against `SECTION_TYPES`. Curation is partial throughout (exp-2 is out, only
 * one of exp-1's bullets is in) so that "the filter searched the library, not
 * the CV" has something to be wrong about.
 */
const sections: VariantSection[] = [
  { type: "header", visible: true, options: { mode: "full", showTitle: false } },
  { type: "aboutMe", visible: true, options: { aboutMeId: "about-default" } },
  { type: "competencies", visible: true, options: {}, items: ["comp-1"] },
  {
    type: "experience",
    visible: true,
    options: { splitEntries: false },
    entries: [{ id: "exp-1", bullets: ["b1"] }],
  },
  { type: "projects", visible: true, options: { splitEntries: false }, entries: [] },
  { type: "education", visible: true, options: {}, entries: [{ id: "edu-1" }] },
  { type: "skills", visible: true, options: {}, groups: [{ id: "skills-1", skills: ["sk-1"] }] },
  { type: "certifications", visible: true, options: {}, entries: [{ id: "cert-1" }] },
  { type: "languages", visible: true, options: {} },
  { type: "recommendations", visible: true, options: { mode: "collapsed" }, entries: [] },
  { type: "custom", visible: true, options: { customSectionId: "custom-1" } },
];

const variant: Variant = {
  schemaVersion: 1,
  tag: "detailed",
  label: "Detailed",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  sections,
};

const at = (type: VariantSection["type"]): VariantSection => {
  const found = sections.find((section) => section.type === type);
  if (!found) throw new Error(`no ${type} section in the fixture`);
  return found;
};

/** One section's reading, as plain arrays — `null` sets stay `null`. */
function read(type: VariantSection["type"], term: string) {
  const match = matchSection(library, at(type), filterTerms(term));
  if (match === null) return null;
  return {
    entryIds: match.entryIds === null ? null : [...match.entryIds].sort(),
    bulletIds: match.bulletIds === null ? null : [...match.bulletIds].sort(),
  };
}

const SHOWN = { entryIds: null, bulletIds: null };

describe("filterTerms", () => {
  it("is empty for a blank box, so no filter is in force", () => {
    expect(filterTerms("")).toEqual([]);
    expect(filterTerms("   ")).toEqual([]);
  });

  it("lowercases and splits on whitespace", () => {
    expect(filterTerms("  Payments   API ")).toEqual(["payments", "api"]);
  });
});

describe("matchSection", () => {
  it("shows every section whole when there is no term", () => {
    expect(matchSections(library, sections, [])).toEqual(sections.map(() => SHOWN));
  });

  it("keeps an entry that matched on its own text, with all of its bullets", () => {
    // Acme is the company, so the match is the job — not one sentence in it.
    expect(read("experience", "acme")).toEqual({ entryIds: ["exp-1"], bulletIds: ["b1", "b2"] });
  });

  it("keeps a parent whose bullet matched, showing only that bullet", () => {
    expect(read("experience", "api")).toEqual({
      entryIds: ["exp-1", "exp-2"],
      bulletIds: ["b1", "b3"],
    });
  });

  it("lets a bullet match on its parent's text as well as its own", () => {
    // "acme" is on the job and "api" on the bullet; neither level can answer
    // this alone, and both of exp-2's bullets are correctly out.
    expect(read("experience", "acme api")).toEqual({ entryIds: ["exp-1"], bulletIds: ["b1"] });
  });

  it("searches the library, not what the variant already includes", () => {
    // exp-2 is not in this variant at all — which is exactly when someone is
    // looking for it, to put it in.
    expect(read("experience", "globex")).toEqual({
      entryIds: ["exp-2"],
      bulletIds: ["b3", "b4"],
    });
  });

  it("searches tags, the vocabulary tailoring is done in (§6.1)", () => {
    expect(read("competencies", "iot")).toEqual({ entryIds: ["comp-2"], bulletIds: [] });
    expect(read("projects", "iot")).toEqual({ entryIds: ["proj-1"], bulletIds: ["pb1"] });
  });

  it("searches IDs, which is what a §13 missing-reference message names", () => {
    expect(read("experience", "exp-2")).toEqual({
      entryIds: ["exp-2"],
      bulletIds: ["b3", "b4"],
    });
  });

  it("shows a section whole when the term names the section itself", () => {
    expect(read("experience", "experience")).toEqual(SHOWN);
    expect(read("competencies", "core competencies")).toEqual(SHOWN);
    expect(read("skills", "technical")).toEqual(SHOWN);
    // A custom section is named by its library item's title (§12.4).
    expect(read("custom", "publications")).toEqual(SHOWN);
  });

  it("curates skill groups and their skills on the same two levels", () => {
    expect(read("skills", "kubernetes")).toEqual({ entryIds: ["skills-2"], bulletIds: ["sk-3"] });
    // A group matched by its label keeps every skill in it.
    expect(read("skills", "languages")).toEqual({
      entryIds: ["skills-1"],
      bulletIds: ["sk-1", "sk-2"],
    });
  });

  it("treats a section with no curated list as all-or-nothing", () => {
    expect(read("header", "jane@example.com")).toEqual(SHOWN);
    expect(read("header", "portfolio.example.com")).toEqual(SHOWN);
    expect(read("aboutMe", "distributed")).toEqual(SHOWN);
    expect(read("languages", "native")).toEqual(SHOWN);
    // Reached through the custom item's bullet, which is its content too.
    expect(read("custom", "caching")).toEqual(SHOWN);
    expect(read("header", "kubernetes")).toBeNull();
    expect(read("aboutMe", "kubernetes")).toBeNull();
  });

  it("drops a section nothing in it matches", () => {
    expect(read("education", "kubernetes")).toBeNull();
    expect(read("certifications", "kubernetes")).toBeNull();
  });

  it("requires every term, not any of them", () => {
    expect(read("education", "state scheduling")).toEqual({ entryIds: ["edu-1"], bulletIds: [] });
    expect(read("education", "state kubernetes")).toBeNull();
  });
});

describe("the filter reaches every section type", () => {
  it("covers all of SECTION_TYPES in the fixture", () => {
    expect([...sections.map((section) => section.type)].sort()).toEqual([...SECTION_TYPES].sort());
  });

  it("narrows each of them to nothing on a term nothing carries", () => {
    expect(matchSections(library, sections, ["qwertyuiop"])).toEqual(sections.map(() => null));
  });

  it("and restores each of them whole when the term is cleared", () => {
    expect(matchSections(library, sections, filterTerms(""))).toEqual(sections.map(() => SHOWN));
  });
});

describe("filterNote", () => {
  it("says nothing when nothing is hidden", () => {
    const whole = matchSection(library, at("experience"), []);
    expect(filterNote(library, at("experience"), whole!)).toBeNull();
  });

  it("counts both levels against the library the card is a view of", () => {
    const match = matchSection(library, at("experience"), filterTerms("acme"));
    expect(filterNote(library, at("experience"), match!)).toBe(
      "Showing 1 of 2 entries, 2 of 4 bullets",
    );
  });

  it("leaves the bullet count out when no bullet is hidden", () => {
    const match = matchSection(library, at("education"), filterTerms("state"));
    expect(filterNote(library, at("education"), match!)).toBe("Showing 1 of 1 entries");
  });

  it("says nothing for a section that curates no list", () => {
    const match = matchSection(library, at("header"), filterTerms("jane"));
    expect(filterNote(library, at("header"), match!)).toBeNull();
  });
});

describe("filtering is not an edit", () => {
  it("leaves the draft the identical object, unsaved-flag and history alike", () => {
    const store = createEditorStore({
      profileId: "p",
      variantId: "v",
      library,
      variant,
    } as EditorSnapshot);
    const before = store.getState().draft;

    // Everything the form does per keystroke, over every section, for a term
    // that matches, one that does not, and the cleared box.
    for (const term of ["api", "qwertyuiop", ""]) {
      const terms = filterTerms(term);
      const matches = matchSections(library, before.variant.sections, terms);
      matches.forEach((match, index) => {
        if (match) filterNote(library, before.variant.sections[index], match);
      });
    }

    expect(store.getState().draft).toBe(before);
    expect(canUndo(store.getState().history)).toBe(false);
  });
});
