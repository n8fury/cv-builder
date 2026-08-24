import { describe, expect, it } from "vitest";

import type { ContentLibrary } from "@/lib/schema/library";
import type { Variant } from "@/lib/schema/variant";

import { createEditorStore, isDirty, type EditorSnapshot } from "./store";

const library = {
  schemaVersion: 1,
  header: { name: "A", location: "", email: "", phone: "", linkedin: "", github: "" },
  aboutMe: [
    { id: "about-default", key: "default", text: "Default about.", tags: [] },
    { id: "about-short", key: "short", text: "Short about.", tags: [] },
  ],
  competencies: [],
  experience: [
    {
      id: "exp-1",
      title: "Engineer",
      company: "Acme",
      location: "",
      dates: "",
      tags: [],
      bullets: [
        { id: "b1", text: "first", tags: [] },
        { id: "b2", text: "second", tags: [] },
      ],
    },
    {
      id: "exp-2",
      title: "Other",
      company: "Other",
      location: "",
      dates: "",
      tags: [],
      bullets: [{ id: "b1", text: "same id, other entry", tags: [] }],
    },
  ],
  projects: [],
  education: [],
  skillGroups: [],
  certifications: [],
  recommendations: [],
  languages: [],
  customSections: [],
} satisfies ContentLibrary;

const variant = {
  schemaVersion: 1,
  tag: "detailed",
  label: "Detailed",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  sections: [
    { type: "header", visible: true, options: { mode: "full" } },
    { type: "aboutMe", visible: true, options: { aboutMeId: "about-default" } },
    {
      type: "experience",
      visible: true,
      options: {},
      entries: [{ id: "exp-1", bullets: ["b1", "b2"] }],
    },
  ],
} satisfies Variant;

function open(): ReturnType<typeof createEditorStore> {
  return createEditorStore({ profileId: "p", variantId: "v", library, variant } as EditorSnapshot);
}

describe("editor store", () => {
  it("opens clean, with draft and saved holding the same document", () => {
    const store = open();
    expect(isDirty(store.getState())).toBe(false);
    expect(store.getState().draft).toEqual(store.getState().saved);
  });

  it("edits variant metadata on the draft only", () => {
    const store = open();
    store.getState().setLabel("Tailored");
    expect(store.getState().draft.variant.label).toBe("Tailored");
    expect(store.getState().saved.variant.label).toBe("Detailed");
    expect(isDirty(store.getState())).toBe(true);
  });

  it("edits a bullet in the library, addressed by owner and entry", () => {
    const store = open();
    store.getState().setBulletText("experience", "exp-1", "b1", "rewritten");

    const [first, second] = store.getState().draft.library.experience;
    expect(first.bullets.map((bullet) => bullet.text)).toEqual(["rewritten", "second"]);
    // Bullet IDs repeat across entries; only the addressed entry may change.
    expect(second.bullets[0].text).toBe("same id, other entry");
    expect(store.getState().saved.library.experience[0].bullets[0].text).toBe("first");
    expect(isDirty(store.getState())).toBe(true);
  });

  it("is clean again once an edit is typed back by hand", () => {
    const store = open();
    store.getState().setTag("other");
    store.getState().setTag("detailed");
    expect(isDirty(store.getState())).toBe(false);
  });

  it("toggles a section's visibility by array position", () => {
    const store = open();
    store.getState().setSectionVisible(1, false);
    expect(store.getState().draft.variant.sections[1].visible).toBe(false);
    expect(store.getState().draft.variant.sections[0].visible).toBe(true);
    expect(store.getState().saved.variant.sections[1].visible).toBe(true);
  });

  it("writes per-section options", () => {
    const store = open();
    store.getState().setHeaderMode(0, "minimal");
    store.getState().setAboutMeId(1, "about-short");

    const [header, aboutMe] = store.getState().draft.variant.sections;
    expect(header).toMatchObject({ type: "header", options: { mode: "minimal" } });
    expect(aboutMe).toMatchObject({ type: "aboutMe", options: { aboutMeId: "about-short" } });
  });

  it("ignores an option written at an index of the wrong type", () => {
    const store = open();
    // An index left over from a reorder must not put header options on the
    // experience section.
    store.getState().setHeaderMode(2, "minimal");
    expect(isDirty(store.getState())).toBe(false);
    expect(store.getState().draft.variant.sections[2]).toEqual(variant.sections[2]);
  });

  it("removes a bullet from the variant's bullet-ID array", () => {
    const store = open();
    store.getState().setBulletIncluded(2, "exp-1", "b1", false);
    expect(store.getState().draft.variant.sections[2]).toMatchObject({
      entries: [{ id: "exp-1", bullets: ["b2"] }],
    });
  });

  it("puts a re-included bullet back where it was, not at the end", () => {
    const store = open();
    store.getState().setBulletIncluded(2, "exp-1", "b1", false);
    store.getState().setBulletIncluded(2, "exp-1", "b1", true);
    expect(store.getState().draft.variant.sections[2]).toMatchObject({
      entries: [{ id: "exp-1", bullets: ["b1", "b2"] }],
    });
    expect(isDirty(store.getState())).toBe(false);
  });

  it("drops a whole entry and restores its saved bullet curation", () => {
    const store = open();
    store.getState().setBulletIncluded(2, "exp-1", "b2", false);
    store.getState().setEntryIncluded(2, "exp-1", false);
    expect(store.getState().draft.variant.sections[2]).toMatchObject({ entries: [] });

    store.getState().setEntryIncluded(2, "exp-1", true);
    // Both bullets: the entry comes back as the *saved* variant had it, not as
    // it was a moment before being excluded.
    expect(store.getState().draft.variant.sections[2]).toMatchObject({
      entries: [{ id: "exp-1", bullets: ["b1", "b2"] }],
    });
  });

  it("includes an entry the variant never referenced, with all its bullets", () => {
    const store = open();
    store.getState().setEntryIncluded(2, "exp-2", true);
    expect(store.getState().draft.variant.sections[2]).toMatchObject({
      entries: [
        { id: "exp-1", bullets: ["b1", "b2"] },
        { id: "exp-2", bullets: ["b1"] },
      ],
    });
  });

  it("leaves a section alone when the entry is not in its library list", () => {
    const store = open();
    store.getState().setEntryIncluded(2, "no-such-entry", true);
    expect(isDirty(store.getState())).toBe(false);
  });

  it("reverts the whole document, library included", () => {
    const store = open();
    store.getState().setLabel("Tailored");
    store.getState().setBulletText("experience", "exp-1", "b2", "changed");
    store.getState().revert();
    expect(isDirty(store.getState())).toBe(false);
    expect(store.getState().draft).toEqual(store.getState().saved);
  });
});
