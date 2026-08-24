/**
 * Editor state (SPEC §7).
 *
 * One Zustand store per open variant, created on the client from the server's
 * disk read. It holds two copies of the variant: `saved` — what is on disk —
 * and `draft`, which every form control edits. The preview resolves `draft`
 * against the library on each change, so the right-hand page is always the
 * document that Save would produce, and "dirty" is a comparison rather than a
 * flag something has to remember to set.
 *
 * The library lives here too because §6.3 has the editor writing new content
 * to the library first and referencing it from the variant; both halves of
 * that have to move together.
 */
import { createStore } from "zustand/vanilla";

import type { ContentLibrary } from "@/lib/schema/library";
import type { Variant } from "@/lib/schema/variant";

export interface EditorSnapshot {
  profileId: string;
  variantId: string;
  library: ContentLibrary;
  variant: Variant;
}

export interface EditorState extends EditorSnapshot {
  /** The variant as last read from (or written to) disk. */
  saved: Variant;
  /** The edited variant — what the preview renders and Save writes. */
  draft: Variant;
  setTag(tag: string): void;
  setLabel(label: string): void;
  /** Throw the draft away and go back to the file on disk. */
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

export function createEditorStore(snapshot: EditorSnapshot) {
  return createStore<EditorState>()((set) => ({
    ...snapshot,
    saved: snapshot.variant,
    draft: snapshot.variant,
    setTag: (tag) => set((state) => ({ draft: { ...state.draft, tag } })),
    setLabel: (label) => set((state) => ({ draft: { ...state.draft, label } })),
    revert: () => set((state) => ({ draft: state.saved })),
  }));
}
