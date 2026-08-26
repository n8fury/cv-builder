import { describe, expect, it } from "vitest";

import {
  browserDraftStorage,
  clearDraft,
  draftKey,
  readDraft,
  recoverableDraft,
  writeDraft,
  type DraftStorage,
} from "./draft-storage";
import { createEditorStore, documentsDiffer, isDirty, type EditorSnapshot } from "./store";

import { contentLibrarySchema } from "@/lib/schema/library";

const library = contentLibrarySchema.parse({
  schemaVersion: 1,
  header: { name: "A" },
  aboutMe: [{ id: "about-default", key: "default", text: "Default about.", tags: [] }],
  experience: [
    {
      id: "exp-1",
      title: "Engineer",
      company: "Acme",
      location: "",
      dates: "",
      tags: [],
      bullets: [{ id: "b1", text: "first", tags: [] }],
    },
  ],
});

const variant = {
  schemaVersion: 1 as const,
  tag: "detailed",
  label: "Detailed",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  sections: [
    {
      type: "experience" as const,
      visible: true,
      options: { splitEntries: false },
      entries: [{ id: "exp-1", bullets: ["b1"] }],
    },
  ],
};

const snapshot: EditorSnapshot = { profileId: "p", variantId: "v", library, variant };

/** The same document as the editor holds it once open: disk under `saved`. */
const open = { profileId: "p", variantId: "v", saved: { variant, library } };

/** A `Storage` that is only a map, so a test can look at what was written. */
function fakeStorage(): DraftStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

function stored(document = { variant, library }, overrides: Record<string, unknown> = {}) {
  return {
    savedAt: "2026-01-02T09:00:00.000Z",
    baseUpdatedAt: variant.updatedAt,
    document,
    ...overrides,
  };
}

describe("draft storage", () => {
  it("keys a copy by profile and variant, so two variants recover apart", () => {
    expect(draftKey({ profileId: "p", variantId: "v" })).not.toBe(
      draftKey({ profileId: "p", variantId: "w" }),
    );
    expect(draftKey(snapshot)).toContain("p/v");
  });

  it("round-trips a draft through the store", () => {
    const storage = fakeStorage();
    const edited = { library, variant: { ...variant, label: "Tailored" } };

    writeDraft(storage, snapshot, stored(edited));
    expect(readDraft(storage, snapshot)?.document.variant.label).toBe("Tailored");

    clearDraft(storage, snapshot);
    expect(readDraft(storage, snapshot)).toBeNull();
  });

  it("drops a copy that is not valid on-disk content", () => {
    const storage = fakeStorage();

    for (const raw of [
      "not json",
      JSON.stringify({ version: 1 }),
      JSON.stringify({ version: 2, ...stored() }),
      JSON.stringify(stored({ variant, library: { schemaVersion: 1, experience: "no" } as never })),
      JSON.stringify(stored({ variant: { ...variant, tag: "" }, library })),
    ]) {
      storage.items.set(draftKey(snapshot), raw);
      expect(readDraft(storage, snapshot)).toBeNull();
    }
  });

  it("offers a copy that differs from the file it was taken against", () => {
    const storage = fakeStorage();
    const edited = { library, variant: { ...variant, label: "Tailored" } };
    writeDraft(storage, snapshot, stored(edited));

    const offer = recoverableDraft(storage, open, documentsDiffer);
    expect(offer?.document.variant.label).toBe("Tailored");
    expect(offer?.savedAt).toBe("2026-01-02T09:00:00.000Z");
  });

  it("drops a copy that says nothing the file does not, rather than offering it", () => {
    const storage = fakeStorage();
    writeDraft(storage, snapshot, stored());

    expect(recoverableDraft(storage, open, documentsDiffer)).toBeNull();
    expect(storage.items.size).toBe(0);
  });

  it("drops a copy taken against an older version of the file on disk", () => {
    const storage = fakeStorage();
    const edited = { library, variant: { ...variant, label: "Tailored" } };
    writeDraft(storage, snapshot, stored(edited, { baseUpdatedAt: "2025-06-01T00:00:00.000Z" }));

    // The disk moved on under the copy — n8n, a hand edit, another tab that
    // saved — so restoring it would silently undo that on the next Save.
    expect(recoverableDraft(storage, open, documentsDiffer)).toBeNull();
    expect(storage.items.size).toBe(0);
  });

  it("treats a missing or throwing store as simply having no copy", () => {
    const throwing: DraftStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };

    expect(() => writeDraft(null, snapshot, stored())).not.toThrow();
    expect(() => writeDraft(throwing, snapshot, stored())).not.toThrow();
    expect(() => clearDraft(throwing, snapshot)).not.toThrow();
    expect(readDraft(null, snapshot)).toBeNull();
    expect(readDraft(throwing, snapshot)).toBeNull();
    // No `window` in this environment, which is the server-render case.
    expect(browserDraftStorage()).toBeNull();
  });

  it("restores a recovered draft without disturbing the file on disk", () => {
    const store = createEditorStore(snapshot);
    const recovered = { library, variant: { ...variant, label: "Tailored" } };

    store.getState().restore(recovered);

    expect(store.getState().draft.variant.label).toBe("Tailored");
    expect(store.getState().saved.variant.label).toBe("Detailed");
    expect(isDirty(store.getState())).toBe(true);

    // And Revert still goes back to disk, not to the recovered draft.
    store.getState().revert();
    expect(store.getState().draft.variant.label).toBe("Detailed");
  });
});
