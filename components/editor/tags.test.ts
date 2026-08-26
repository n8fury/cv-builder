/**
 * Tag-driven curation (SPEC §6.1, §6.2).
 *
 * The claim worth testing is not that the button changes something but that it
 * changes *exactly* what ticking the boxes would: a bulk action is a shortcut
 * through the ordinary curation path, not a second way of writing a variant.
 * Most of what follows is therefore a comparison between two stores.
 */
import { describe, expect, it } from "vitest";

import { canUndo } from "./history";
import { createEditorStore, type EditorSnapshot } from "./store";
import {
  includedIds,
  sectionCollection,
  sectionTags,
  taggedBulletRefs,
  taggedEntryIds,
} from "./tags";

import { contentLibrarySchema } from "@/lib/schema/library";

import type { Variant, VariantSection } from "@/lib/schema/variant";

const library = contentLibrarySchema.parse({
  schemaVersion: 1,
  header: { name: "A", email: "a@example.com" },
  aboutMe: [{ id: "about-default", key: "default", text: "About." }],
  experience: [
    {
      id: "exp-1",
      title: "Backend Engineer",
      company: "Acme",
      location: "",
      dates: "",
      tags: ["backend", "ml"],
      bullets: [
        { id: "b1", text: "first", tags: ["backend"] },
        { id: "b2", text: "second", tags: ["ml"] },
      ],
    },
    {
      id: "exp-2",
      title: "Firmware Engineer",
      company: "Globex",
      location: "",
      dates: "",
      tags: ["iot"],
      bullets: [
        { id: "b3", text: "third", tags: ["backend"] },
        { id: "b4", text: "fourth" },
      ],
    },
    {
      id: "exp-3",
      title: "Platform Engineer",
      company: "Initech",
      location: "",
      dates: "",
      tags: ["backend"],
      bullets: [{ id: "b5", text: "fifth", tags: ["backend"] }],
    },
    // Untagged: no bulk action reaches it, whichever tag is pressed.
    { id: "exp-4", title: "Intern", company: "Hooli", location: "", dates: "", bullets: [] },
  ],
  projects: [{ id: "proj-1", title: "Sensor mesh", subtitle: "", dates: "", tags: ["iot"] }],
  competencies: [
    { id: "comp-1", text: "Distributed systems", tags: ["backend"] },
    { id: "comp-2", text: "Soldering", tags: ["iot"] },
  ],
  skillGroups: [
    {
      id: "skills-1",
      label: "Languages",
      tags: ["backend"],
      skills: [
        { id: "sk-1", text: "Go", tags: ["backend"] },
        { id: "sk-2", text: "Rust" },
      ],
    },
    { id: "skills-2", label: "Hardware", tags: ["iot"], skills: [{ id: "sk-3", text: "KiCad", tags: ["iot"] }] },
  ],
  languages: [{ id: "lang-1", language: "English", proficiency: "Native" }],
});

/**
 * Section 2 starts with the middle entry only, so both directions have
 * something to do and re-inclusion has a position to be restored to.
 */
const variant: Variant = {
  schemaVersion: 1,
  tag: "detailed",
  label: "Detailed",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  sections: [
    { type: "header", visible: true, options: { mode: "full", showTitle: false } },
    { type: "aboutMe", visible: true, options: { aboutMeId: "about-default" } },
    {
      type: "experience",
      visible: true,
      options: { splitEntries: false },
      entries: [{ id: "exp-2", bullets: ["b3", "b4"] }],
    },
    { type: "competencies", visible: true, options: {}, items: ["comp-2"] },
    { type: "skills", visible: true, options: {}, groups: [{ id: "skills-2", skills: ["sk-3"] }] },
    { type: "languages", visible: true, options: {} },
  ],
};

const open = () =>
  createEditorStore({ profileId: "p", variantId: "v", library, variant } as EditorSnapshot);

const experience = (store: ReturnType<typeof open>) => {
  const section = store.getState().draft.variant.sections[2];
  if (section.type !== "experience") throw new Error("section 2 is not experience");
  return section;
};

/**
 * The by-hand equivalent of one bulk action: the same two per-item store
 * actions, in the same order, over the IDs the tag resolves to. Bullet refs
 * are re-resolved after the entry pass, exactly as the store does — that is
 * the order, not an implementation detail being copied.
 */
function tickByHand(store: ReturnType<typeof open>, index: number, tag: string, included: boolean) {
  const section = () => store.getState().draft.variant.sections[index];
  for (const id of taggedEntryIds(library, section(), tag)) {
    store.getState().setEntryIncluded(index, id, included);
  }
  for (const ref of taggedBulletRefs(library, section(), tag)) {
    store.getState().setBulletIncluded(index, ref.entryId, ref.bulletId, included);
  }
}

describe("sectionTags", () => {
  it("reports the tags on the section's entries and on its included bullets", () => {
    // exp-2 is the only included entry, so only its bullets are in scope —
    // b3 is tagged `backend`, which is why `backend` counts 1 of its 3.
    expect(sectionTags(library, variant.sections[2])).toEqual([
      {
        tag: "backend",
        entryIds: ["exp-1", "exp-3"],
        bulletRefs: [{ entryId: "exp-2", bulletId: "b3" }],
        total: 3,
        includedCount: 1,
      },
      { tag: "iot", entryIds: ["exp-2"], bulletRefs: [], total: 1, includedCount: 1 },
      { tag: "ml", entryIds: ["exp-1"], bulletRefs: [], total: 1, includedCount: 0 },
    ]);
  });

  it("offers a tag only where it names something in that section", () => {
    // `ml` and `backend` sit on Experience alone; Projects sees only `iot`.
    const projects: VariantSection = {
      type: "projects",
      visible: true,
      options: { splitEntries: false },
      entries: [],
    };
    expect(sectionTags(library, projects).map((summary) => summary.tag)).toEqual(["iot"]);
  });

  it("covers the flat lists and skill groups, which curate like entries", () => {
    expect(sectionTags(library, variant.sections[3])).toEqual([
      { tag: "backend", entryIds: ["comp-1"], bulletRefs: [], total: 1, includedCount: 0 },
      { tag: "iot", entryIds: ["comp-2"], bulletRefs: [], total: 1, includedCount: 1 },
    ]);
    // A group's skills are its bullets (§12.3): sk-3 is in scope because
    // skills-2 is included, sk-1 is not because skills-1 is not.
    expect(sectionTags(library, variant.sections[4])).toEqual([
      { tag: "backend", entryIds: ["skills-1"], bulletRefs: [], total: 1, includedCount: 0 },
      {
        tag: "iot",
        entryIds: ["skills-2"],
        bulletRefs: [{ entryId: "skills-2", bulletId: "sk-3" }],
        total: 2,
        includedCount: 2,
      },
    ]);
  });

  it("says nothing for section types that curate no entry list", () => {
    for (const index of [0, 1, 5]) {
      expect(sectionCollection(library, variant.sections[index])).toBeNull();
      expect(sectionTags(library, variant.sections[index])).toEqual([]);
      expect(includedIds(variant.sections[index])).toEqual([]);
      expect(taggedEntryIds(library, variant.sections[index], "backend")).toEqual([]);
      expect(taggedBulletRefs(library, variant.sections[index], "backend")).toEqual([]);
    }
  });
});

describe("setTaggedIncluded", () => {
  it("includes every tagged entry, in library order, and nothing untagged", () => {
    const store = open();
    store.getState().setTaggedIncluded(2, "backend", true);

    // Around the entry that was already there (§15.3); untagged exp-4 stays out.
    expect(experience(store).entries.map((entry) => entry.id)).toEqual([
      "exp-1",
      "exp-2",
      "exp-3",
    ]);
  });

  it("excludes every tagged entry, and the tagged bullets of those left", () => {
    const store = open();
    store.getState().setTaggedIncluded(2, "backend", false);

    // exp-1 and exp-3 were already out. exp-2 is untagged, so it stays — but
    // its `backend` bullet goes, which is the whole point of the second level.
    expect(experience(store).entries).toEqual([{ id: "exp-2", bullets: ["b4"] }]);
  });

  it("reaches the bullets inside an entry that is already included", () => {
    const store = open();
    store.getState().setEntryIncluded(2, "exp-1", true);
    store.getState().setBulletIncluded(2, "exp-1", "b2", false);

    // exp-1 is in and stays in; the press puts its `ml` bullet back without
    // the entry-level pass having anything to do.
    store.getState().setTaggedIncluded(2, "ml", true);
    expect(experience(store).entries.find((item) => item.id === "exp-1")).toEqual({
      id: "exp-1",
      bullets: ["b1", "b2"],
    });
  });

  it("leaves the bullets of an excluded entry alone", () => {
    const store = open();
    // exp-3 is tagged `backend` and stays out under a `ml` press; its
    // `backend` bullet b5 must not be curated behind an excluded entry.
    store.getState().setTaggedIncluded(2, "ml", false);

    expect(experience(store).entries.map((entry) => entry.id)).toEqual(["exp-2"]);
    expect(library.experience[2].bullets.map((bullet) => bullet.id)).toEqual(["b5"]);
  });

  it("produces the same draft as ticking each box by hand", () => {
    for (const [tag, included] of [
      ["backend", true],
      ["backend", false],
      ["ml", true],
      ["iot", false],
      ["iot", true],
    ] as const) {
      for (const index of [2, 3, 4]) {
        const bulk = open();
        const byHand = open();

        bulk.getState().setTaggedIncluded(index, tag, included);
        tickByHand(byHand, index, tag, included);

        expect(bulk.getState().draft, `${tag}=${included} on section ${index}`).toEqual(
          byHand.getState().draft,
        );
      }
    }
  });

  it("restores the bullets and the position a re-included entry had", () => {
    const store = open();
    store.getState().setTaggedIncluded(2, "iot", false);
    store.getState().setTaggedIncluded(2, "iot", true);

    // Back where it was, with the bullet curation the *saved* variant had —
    // the same restore rule the per-entry checkbox follows.
    expect(experience(store).entries).toEqual([{ id: "exp-2", bullets: ["b3", "b4"] }]);
  });

  it("is one undo step, because it was one decision", () => {
    const store = open();
    const before = store.getState().draft;
    store.getState().setTaggedIncluded(2, "backend", true);
    expect(store.getState().draft).not.toEqual(before);

    store.getState().undo();
    expect(store.getState().draft).toEqual(before);
    expect(canUndo(store.getState().history)).toBe(false);
  });

  it("does nothing for a tag nothing in the section carries", () => {
    const store = open();
    const before = store.getState().draft;
    store.getState().setTaggedIncluded(2, "frontend", true);

    expect(store.getState().draft).toEqual(before);
  });
});
