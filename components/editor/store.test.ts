import { describe, expect, it } from "vitest";

import type { ContentLibrary } from "@/lib/schema/library";
import type { Variant } from "@/lib/schema/variant";

import { createEditorStore, isDirty, type EditorSnapshot } from "./store";

const library = {
  schemaVersion: 1,
  header: { name: "A", location: "", email: "", phone: "", linkedin: "", github: "" },
  aboutMe: [],
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

  it("reverts the whole document, library included", () => {
    const store = open();
    store.getState().setLabel("Tailored");
    store.getState().setBulletText("experience", "exp-1", "b2", "changed");
    store.getState().revert();
    expect(isDirty(store.getState())).toBe(false);
    expect(store.getState().draft).toEqual(store.getState().saved);
  });
});
