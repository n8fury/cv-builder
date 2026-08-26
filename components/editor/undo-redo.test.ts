/**
 * Undo and redo at the store level (SPEC §7).
 *
 * The interesting claim is not that one action can be undone but that *every*
 * action can, so the list below is checked against the store's own surface: a
 * new mutation that nobody added here fails the first test, rather than
 * quietly landing outside the history.
 */
import { describe, expect, it } from "vitest";

import { canRedo, canUndo } from "./history";
import { createEditorStore, isDirty, type EditorDocument, type EditorSnapshot } from "./store";

import { contentLibrarySchema } from "@/lib/schema/library";

import type { Variant } from "@/lib/schema/variant";

const library = contentLibrarySchema.parse({
  schemaVersion: 1,
  header: { name: "A", email: "a@example.com", links: [{ id: "link-1", text: "site", url: null }] },
  aboutMe: [
    { id: "about-default", key: "default", text: "Default about." },
    { id: "about-short", key: "short", text: "Short about." },
  ],
  experience: [
    {
      id: "exp-1",
      title: "Engineer",
      company: "Acme",
      tags: ["backend"],
      location: "",
      dates: "",
      bullets: [
        { id: "b1", text: "first" },
        { id: "b2", text: "second" },
      ],
    },
  ],
  recommendations: [{ id: "rec-1", name: "R", role: "", location: "", email: "" }],
  customSections: [
    { id: "custom-a", title: "Open Source" },
    { id: "custom-b", title: "Speaking" },
  ],
});

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
      entries: [{ id: "exp-1", bullets: ["b1", "b2"] }],
    },
    {
      type: "recommendations",
      visible: true,
      options: { mode: "collapsed" },
      entries: [{ id: "rec-1" }],
    },
    { type: "custom", visible: true, options: { customSectionId: "custom-a" } },
  ],
};

const open = () =>
  createEditorStore({ profileId: "p", variantId: "v", library, variant } as EditorSnapshot);

type Store = ReturnType<typeof open>;

/**
 * One call of every draft-changing action, in an order where each one has
 * something to change. Each is its own undo step: no two consecutive entries
 * edit the same field, which is the only thing that coalesces.
 */
const MUTATIONS: [name: string, run: (store: Store) => void][] = [
  ["setTag", (s) => s.getState().setTag("backend")],
  ["setLabel", (s) => s.getState().setLabel("Backend")],
  ["setBulletText", (s) => s.getState().setBulletText("experience", "exp-1", "b1", "rewritten")],
  ["setHeaderField", (s) => s.getState().setHeaderField("email", "b@example.com")],
  ["addHeaderLink", (s) => s.getState().addHeaderLink({ text: "portfolio", url: "x.example" })],
  ["setHeaderLinkText", (s) => s.getState().setHeaderLinkText("link-1", "homepage")],
  ["setHeaderLinkUrl", (s) => s.getState().setHeaderLinkUrl("link-1", "example.com")],
  ["removeHeaderLink", (s) => s.getState().removeHeaderLink("link-1")],
  ["setCustomSectionTitle", (s) => s.getState().setCustomSectionTitle("custom-a", "OSS")],
  ["setCustomSectionParagraph", (s) => s.getState().setCustomSectionParagraph("custom-a", "Why.")],
  ["setSectionVisible", (s) => s.getState().setSectionVisible(1, false)],
  ["setHeaderMode", (s) => s.getState().setHeaderMode(0, "minimal")],
  ["setHeaderShowTitle", (s) => s.getState().setHeaderShowTitle(0, true)],
  ["setAboutMeId", (s) => s.getState().setAboutMeId(1, "about-short")],
  ["setRecommendationsMode", (s) => s.getState().setRecommendationsMode(3, "expanded")],
  ["setSplitEntries", (s) => s.getState().setSplitEntries(2, true)],
  ["setCustomSectionId", (s) => s.getState().setCustomSectionId(4, "custom-b")],
  ["addEntry", (s) => s.getState().addEntry(2, { title: "Engineer", company: "Globex" })],
  ["addBullet", (s) => s.getState().addBullet(2, "exp-1", { text: "third" })],
  ["setEntryIncluded", (s) => s.getState().setEntryIncluded(2, "exp-1", false)],
  ["setTaggedIncluded", (s) => s.getState().setTaggedIncluded(2, "backend", true)],
  ["setBulletIncluded", (s) => s.getState().setBulletIncluded(2, "exp-1", "b2", false)],
  ["moveSection", (s) => s.getState().moveSection(0, 2)],
  ["moveEntry", (s) => s.getState().moveEntry(3, "exp-1", "experience-2")],
  ["moveBullet", (s) => s.getState().moveBullet(3, "exp-1", "b1", "b2")],
  ["addCustomSection", (s) => s.getState().addCustomSection({ title: "Talks" })],
  ["removeSection", (s) => s.getState().removeSection(0)],
  ["restore", (s) => s.getState().restore({ variant, library })],
  ["revert", (s) => s.getState().revert()],
];

/** Everything on the store that is not a draft edit, and so not undoable. */
const NOT_EDITS = new Set(["markSaved", "undo", "redo"]);

describe("undo and redo", () => {
  it("covers every action the store exposes", () => {
    const actions = Object.entries(open().getState())
      .filter(([name, value]) => typeof value === "function" && !NOT_EDITS.has(name))
      .map(([name]) => name);

    expect(new Set(MUTATIONS.map(([name]) => name))).toEqual(new Set(actions));
  });

  it("undoes then redoes every mutation, in order", () => {
    const store = open();
    const after: EditorDocument[] = [];
    const before: EditorDocument[] = [];

    for (const [name, run] of MUTATIONS) {
      before.push(store.getState().draft);
      run(store);
      // Every one of them must actually have changed the document, or the
      // step it is standing in for was never exercised.
      expect(store.getState().draft, `${name} changed nothing`).not.toBe(before.at(-1));
      after.push(store.getState().draft);
    }

    for (let step = MUTATIONS.length - 1; step >= 0; step -= 1) {
      store.getState().undo();
      expect(store.getState().draft, `undo of ${MUTATIONS[step][0]}`).toEqual(before[step]);
    }
    expect(canUndo(store.getState().history)).toBe(false);
    expect(isDirty(store.getState())).toBe(false);

    for (let step = 0; step < MUTATIONS.length; step += 1) {
      store.getState().redo();
      expect(store.getState().draft, `redo of ${MUTATIONS[step][0]}`).toEqual(after[step]);
    }
    expect(canRedo(store.getState().history)).toBe(false);
  });

  it("does nothing at either end of the stack", () => {
    const store = open();
    store.getState().undo();
    expect(isDirty(store.getState())).toBe(false);

    store.getState().setLabel("Backend");
    store.getState().redo();
    expect(store.getState().draft.variant.label).toBe("Backend");
  });

  it("drops the redo stack once a new edit follows an undo", () => {
    const store = open();
    store.getState().setLabel("Backend");
    store.getState().undo();
    expect(canRedo(store.getState().history)).toBe(true);

    store.getState().setTag("frontend");
    expect(canRedo(store.getState().history)).toBe(false);
    expect(store.getState().draft.variant.label).toBe("Detailed");
  });

  it("leaves the dirty flag right across a save", () => {
    const store = open();
    store.getState().setLabel("Backend");
    store.getState().setTag("backend");

    // What a save returns: the same document, stamped by the server.
    const saved = store.getState().draft;
    const stamped: EditorDocument = {
      ...saved,
      variant: { ...saved.variant, updatedAt: "2026-08-26T10:00:00.000Z" },
    };
    store.getState().markSaved(stamped);
    expect(isDirty(store.getState())).toBe(false);

    // A save is not an edit: it adds no step, and undo goes back past it.
    store.getState().undo();
    expect(store.getState().draft.variant.tag).toBe("detailed");
    expect(isDirty(store.getState())).toBe(true);

    // And forward again lands exactly on what was written, stamp included.
    store.getState().redo();
    expect(store.getState().draft.variant.updatedAt).toBe("2026-08-26T10:00:00.000Z");
    expect(isDirty(store.getState())).toBe(false);
  });

  it("undoes a revert, so a thrown-away session is recoverable", () => {
    const store = open();
    store.getState().setLabel("Backend");
    store.getState().revert();
    expect(isDirty(store.getState())).toBe(false);

    store.getState().undo();
    expect(store.getState().draft.variant.label).toBe("Backend");
  });
});
