/**
 * Editor state (SPEC §7, §11.4).
 *
 * One Zustand store per open variant, created on the client from the server's
 * disk read. It holds two copies of the whole document — `saved`, what is on
 * disk, and `draft`, what every form control edits — so "dirty" is a
 * comparison rather than a flag something has to remember to set, and the
 * preview always shows the document Save would produce.
 *
 * Both files are in the draft, not just the variant. A variant carries no text
 * (§6.2): editing a bullet edits the *library*, and §11.4 has that edit
 * propagate to every variant referencing it. Keeping the library alongside the
 * variant is what lets the editor stage such an edit and preview it before it
 * reaches disk.
 */
import { createStore } from "zustand/vanilla";

import type { Bullet, ContentLibrary } from "@/lib/schema/library";
import type { Variant } from "@/lib/schema/variant";

/** The two files an open editor edits together. */
export interface EditorDocument {
  variant: Variant;
  library: ContentLibrary;
}

export interface EditorSnapshot extends EditorDocument {
  profileId: string;
  variantId: string;
}

/** The library collections whose entries own bullets (§5.4, §5.5, §5.11). */
export type BulletOwner = "experience" | "projects" | "customSections";

export interface EditorState {
  profileId: string;
  variantId: string;
  /** The document as last read from (or written to) disk. */
  saved: EditorDocument;
  /** The edited document — what the preview renders and Save writes. */
  draft: EditorDocument;
  setTag(tag: string): void;
  setLabel(label: string): void;
  /**
   * Bullet IDs are unique only within their entry, so the owner and the entry
   * are part of the address.
   */
  setBulletText(owner: BulletOwner, entryId: string, bulletId: string, text: string): void;
  /** Throw the draft away and go back to the files on disk. */
  revert(): void;
}

export type EditorStore = ReturnType<typeof createEditorStore>;

/**
 * Structural comparison, not identity: reverting an edit by hand should clear
 * the dirty state, because at that point Save would write the same bytes.
 */
export function isDirty(state: EditorState): boolean {
  return JSON.stringify(state.draft) !== JSON.stringify(state.saved);
}

function editBullets<T extends { id: string; bullets: Bullet[] }>(
  entries: T[],
  entryId: string,
  bulletId: string,
  text: string,
): T[] {
  return entries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          bullets: entry.bullets.map((bullet) =>
            bullet.id === bulletId ? { ...bullet, text } : bullet,
          ),
        }
      : entry,
  );
}

/**
 * Written as a switch rather than an indexed write: each branch names one
 * collection, so the entry type stays concrete and a spread that dropped a
 * field would not compile.
 */
function withBulletText(
  library: ContentLibrary,
  owner: BulletOwner,
  entryId: string,
  bulletId: string,
  text: string,
): ContentLibrary {
  switch (owner) {
    case "experience":
      return { ...library, experience: editBullets(library.experience, entryId, bulletId, text) };
    case "projects":
      return { ...library, projects: editBullets(library.projects, entryId, bulletId, text) };
    case "customSections":
      return {
        ...library,
        customSections: editBullets(library.customSections, entryId, bulletId, text),
      };
  }
}

export function createEditorStore({ profileId, variantId, ...document }: EditorSnapshot) {
  return createStore<EditorState>()((set) => ({
    profileId,
    variantId,
    saved: document,
    draft: document,

    setTag: (tag) =>
      set(({ draft }) => ({ draft: { ...draft, variant: { ...draft.variant, tag } } })),

    setLabel: (label) =>
      set(({ draft }) => ({ draft: { ...draft, variant: { ...draft.variant, label } } })),

    setBulletText: (owner, entryId, bulletId, text) =>
      set(({ draft }) => ({
        draft: { ...draft, library: withBulletText(draft.library, owner, entryId, bulletId, text) },
      })),

    revert: () => set((state) => ({ draft: state.saved })),
  }));
}
