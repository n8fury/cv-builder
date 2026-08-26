/**
 * Bulk curation per section (SPEC §6.2, §7).
 *
 * The claim worth testing is the same one Task 10.7's tag actions had to
 * make: a bulk press is a shortcut through the ordinary curation path, not a
 * second way of writing a variant. So most of what follows compares two whole
 * stores — one driven by the button, one driven by the checkboxes it stands
 * for — and asserts they are equal, not merely similar.
 *
 * The modes are checked against every section type that curates a list, since
 * `includeEntry` has a branch per collection and a mode that worked on
 * Experience alone would prove nothing about Technical Skills.
 */
import { describe, expect, it } from "vitest";

import { bulkChanges, includedCount, type BulkMode } from "./bulk";
import { canUndo } from "./history";
import { createEditorStore, type EditorSnapshot } from "./store";
import { includedIds, sectionCollection } from "./tags";

import { contentLibrarySchema } from "@/lib/schema/library";

import type { Variant, VariantSection } from "@/lib/schema/variant";

const library = contentLibrarySchema.parse({
  schemaVersion: 1,
  header: { name: "A", email: "a@example.com" },
  aboutMe: [{ id: "about-default", key: "default", text: "About." }],
  competencies: [
    { id: "comp-1", text: "Distributed systems" },
    { id: "comp-2", text: "Soldering" },
    { id: "comp-3", text: "Mentoring" },
  ],
  experience: [
    {
      id: "exp-1",
      title: "Backend Engineer",
      company: "Acme",
      location: "",
      dates: "",
      bullets: [
        { id: "b1", text: "first" },
        { id: "b2", text: "second" },
      ],
    },
    {
      id: "exp-2",
      title: "Firmware Engineer",
      company: "Globex",
      location: "",
      dates: "",
      bullets: [
        { id: "b3", text: "third" },
        { id: "b4", text: "fourth" },
      ],
    },
    { id: "exp-3", title: "Intern", company: "Hooli", location: "", dates: "", bullets: [] },
  ],
  projects: [
    { id: "proj-1", title: "Sensor mesh", subtitle: "", dates: "" },
    { id: "proj-2", title: "Ledger", subtitle: "", dates: "" },
  ],
  education: [
    { id: "edu-1", institution: "State", degree: "BSc", dates: "", description: "" },
    { id: "edu-2", institution: "Poly", degree: "MSc", dates: "", description: "" },
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
  certifications: [
    { id: "cert-1", text: "AWS", dates: "" },
    { id: "cert-2", text: "CKA", dates: "" },
  ],
  recommendations: [
    { id: "rec-1", name: "John", role: "", location: "", email: "" },
    { id: "rec-2", name: "Jane", role: "", location: "", email: "" },
  ],
  languages: [{ id: "lang-1", language: "English", proficiency: "Native" }],
  customSections: [{ id: "custom-1", title: "Publications" }],
});

/**
 * Every curated section starts partly in and partly out, so all three modes
 * have something to do and both directions of Invert are exercised. exp-1 is
 * included with only *one* of its two bullets, which is what "None then All
 * is not the same as never having pressed anything" turns on below.
 */
const sections: VariantSection[] = [
  { type: "header", visible: true, options: { mode: "full", showTitle: false } },
  { type: "aboutMe", visible: true, options: { aboutMeId: "about-default" } },
  { type: "competencies", visible: true, options: {}, items: ["comp-2"] },
  {
    type: "experience",
    visible: true,
    options: { splitEntries: false },
    entries: [{ id: "exp-1", bullets: ["b1"] }],
  },
  {
    type: "projects",
    visible: true,
    options: { splitEntries: false },
    entries: [{ id: "proj-2", bullets: [] }],
  },
  { type: "education", visible: true, options: {}, entries: [{ id: "edu-1" }] },
  { type: "skills", visible: true, options: {}, groups: [{ id: "skills-1", skills: ["sk-1"] }] },
  { type: "certifications", visible: true, options: {}, entries: [{ id: "cert-2" }] },
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

const open = () =>
  createEditorStore({ profileId: "p", variantId: "v", library, variant } as EditorSnapshot);

type Store = ReturnType<typeof open>;

/** The indices of every section that curates an entry list — the ones in scope. */
const CURATED = sections
  .map((section, index) => ({ section, index }))
  .filter(({ section }) => sectionCollection(library, section) !== null)
  .map(({ section, index }) => [section.type, index] as const);

const allIds = (index: number): string[] =>
  (sectionCollection(library, sections[index]) ?? []).map((item) => item.id);

/** The by-hand equivalent of one press: the same per-entry action, same order. */
function tickByHand(store: Store, index: number, entryIds: readonly string[], mode: BulkMode) {
  const section = () => store.getState().draft.variant.sections[index];
  for (const change of bulkChanges(section(), entryIds, mode)) {
    store.getState().setEntryIncluded(index, change.id, change.included);
  }
}

describe("bulkChanges", () => {
  const experience = sections[3];

  it("returns only what actually changes, so a spent button can disable itself", () => {
    expect(bulkChanges(experience, ["exp-1", "exp-2", "exp-3"], "all")).toEqual([
      { id: "exp-2", included: true },
      { id: "exp-3", included: true },
    ]);
    expect(bulkChanges(experience, ["exp-1", "exp-2", "exp-3"], "none")).toEqual([
      { id: "exp-1", included: false },
    ]);
  });

  it("is empty at each end, which is where the button turns off", () => {
    expect(bulkChanges(experience, ["exp-1"], "all")).toEqual([]);
    expect(bulkChanges(experience, ["exp-2"], "none")).toEqual([]);
  });

  it("changes every entry on invert, in both directions at once", () => {
    expect(bulkChanges(experience, ["exp-1", "exp-2", "exp-3"], "invert")).toEqual([
      { id: "exp-1", included: false },
      { id: "exp-2", included: true },
      { id: "exp-3", included: true },
    ]);
  });

  it("is read once, against the section as it stands", () => {
    // Not progressively: inverting must not see the entry it just flipped.
    const changes = bulkChanges(experience, ["exp-1", "exp-1"], "invert");
    expect(changes).toEqual([
      { id: "exp-1", included: false },
      { id: "exp-1", included: false },
    ]);
  });

  it("acts only on the IDs it is given — the rows the card is showing", () => {
    expect(bulkChanges(experience, ["exp-2"], "none")).toEqual([]);
    expect(bulkChanges(experience, ["exp-2"], "all")).toEqual([{ id: "exp-2", included: true }]);
  });

  it("counts what is in, out of what it was offered", () => {
    expect(includedCount(experience, ["exp-1", "exp-2", "exp-3"])).toBe(1);
    expect(includedCount(experience, ["exp-2", "exp-3"])).toBe(0);
  });
});

describe("a bulk press is the equivalent ticking", () => {
  it("covers every section type that curates a list", () => {
    expect(CURATED.map(([type]) => type)).toEqual([
      "competencies",
      "experience",
      "projects",
      "education",
      "skills",
      "certifications",
      "recommendations",
    ]);
  });

  for (const mode of ["all", "none", "invert"] as const) {
    it(`produces the same draft as the individual toggles — ${mode}`, () => {
      for (const [type, index] of CURATED) {
        const pressed = open();
        const byHand = open();
        const ids = allIds(index);

        pressed.getState().setEntriesIncluded(index, ids, mode);
        tickByHand(byHand, index, ids, mode);

        expect(pressed.getState().draft, `${mode} on ${type}`).toEqual(byHand.getState().draft);
      }
    });
  }

  it("and does so for a filtered subset of the rows too", () => {
    const subset = ["exp-2", "exp-3"];
    for (const mode of ["all", "none", "invert"] as const) {
      const pressed = open();
      const byHand = open();
      pressed.getState().setEntriesIncluded(3, subset, mode);
      tickByHand(byHand, 3, subset, mode);
      expect(pressed.getState().draft, mode).toEqual(byHand.getState().draft);
    }
  });
});

describe("what a press leaves behind", () => {
  it("takes the whole list in, and the whole list back out", () => {
    const store = open();
    store.getState().setEntriesIncluded(3, allIds(3), "all");
    expect(includedIds(store.getState().draft.variant.sections[3])).toEqual([
      "exp-1",
      "exp-2",
      "exp-3",
    ]);

    store.getState().setEntriesIncluded(3, allIds(3), "none");
    expect(includedIds(store.getState().draft.variant.sections[3])).toEqual([]);
  });

  it("restores library order, not press order (§15.3)", () => {
    const store = open();
    // proj-2 is the one already in; All must put proj-1 *above* it, where the
    // library has it, not append it to the end.
    store.getState().setEntriesIncluded(4, allIds(4), "all");
    expect(includedIds(store.getState().draft.variant.sections[4])).toEqual(["proj-1", "proj-2"]);
  });

  it("leaves bullet curation to the entry, exactly as ticking does", () => {
    const store = open();
    // exp-1 is saved with b1 only, so All must not force b2 in with it.
    store.getState().setEntriesIncluded(3, allIds(3), "all");
    const section = store.getState().draft.variant.sections[3];
    if (section.type !== "experience") throw new Error("not experience");
    expect(section.entries).toEqual([
      { id: "exp-1", bullets: ["b1"] },
      // Never saved, so a newly included entry arrives with all of its bullets.
      { id: "exp-2", bullets: ["b3", "b4"] },
      { id: "exp-3", bullets: [] },
    ]);
  });

  it("curates a skill group as an entry, its skills untouched", () => {
    const store = open();
    store.getState().setEntriesIncluded(6, allIds(6), "all");
    const section = store.getState().draft.variant.sections[6];
    if (section.type !== "skills") throw new Error("not skills");
    expect(section.groups).toEqual([
      { id: "skills-1", skills: ["sk-1"] },
      { id: "skills-2", skills: ["sk-3"] },
    ]);
  });

  it("is one undo step, because it was one decision", () => {
    const store = open();
    const before = store.getState().draft;
    store.getState().setEntriesIncluded(3, allIds(3), "invert");
    expect(store.getState().draft).not.toBe(before);

    store.getState().undo();
    expect(store.getState().draft).toEqual(before);
    expect(canUndo(store.getState().history)).toBe(false);
  });

  it("does nothing at all when there is nothing to do", () => {
    const store = open();
    store.getState().setEntriesIncluded(3, allIds(3), "none");
    const empty = store.getState().draft;
    store.getState().setEntriesIncluded(3, allIds(3), "none");
    expect(store.getState().draft).toBe(empty);
  });
});
