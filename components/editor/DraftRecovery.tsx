"use client";

/**
 * Surviving a refresh (SPEC §7, §13).
 *
 * Three small behaviours, kept together because they are one story about the
 * same unsaved draft:
 *
 * - while it is dirty, the browser asks before unloading the page;
 * - while it is dirty, a copy of it is written to `localStorage` (debounced),
 *   and the moment it is clean that copy is removed;
 * - on opening a variant whose copy outlived a session, the editor offers it
 *   back, and Discard drops the copy without touching the file on disk.
 *
 * The order matters: the copy is read *once*, on mount, before any writing
 * starts. A persistence subscription that ran first would see a clean editor,
 * clear the key, and destroy the very draft this is here to recover.
 */
import { useEffect, useState } from "react";

import { useEditor, useEditorStore } from "./EditorStoreProvider";
import {
  browserDraftStorage,
  clearDraft,
  recoverableDraft,
  writeDraft,
  type StoredDraft,
} from "./draft-storage";
import { documentsDiffer, isDirty } from "./store";

/**
 * Long enough that a burst of typing writes once, short enough that a refresh
 * a moment after the last keystroke still finds the keystroke.
 */
const WRITE_DELAY_MS = 400;

/** `undefined` while the copy is still being looked for; `null` once resolved. */
type Pending = StoredDraft | null | undefined;

function useUnloadGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      // Both spellings: browsers disagree on which one arms the prompt, and
      // none of them show a message we choose.
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
}

export function DraftRecovery() {
  const store = useEditorStore();
  const dirty = useEditor(isDirty);
  const restore = useEditor((state) => state.restore);
  const [pending, setPending] = useState<Pending>(undefined);

  useUnloadGuard(dirty);

  // Look for a copy, once per open document. Effects run after mount, so this
  // never touches `localStorage` during a server render; the read is deferred
  // one task further so the answer lands in its own render rather than
  // cascading out of this one — nothing is waiting on it.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPending(recoverableDraft(browserDraftStorage(), store.getState(), documentsDiffer) ?? null);
    }, 0);
    return () => clearTimeout(timer);
  }, [store]);

  // Then, and only then, start keeping the copy up to date. Subscribing to the
  // vanilla store rather than selecting through React keeps a keystroke from
  // re-rendering — and so from re-paginating — the preview.
  useEffect(() => {
    // `null` — and only `null` — means the offer is settled: nothing was
    // found, or it was answered. The copy is this session's to write from
    // there on; while an offer is on screen it is left exactly as it is.
    if (pending !== null) return;

    const storage = browserDraftStorage();
    const { profileId, variantId } = store.getState();
    const id = { profileId, variantId };
    let timer: ReturnType<typeof setTimeout> | undefined;

    const persist = () => {
      const state = store.getState();
      if (!isDirty(state)) {
        clearDraft(storage, id);
        return;
      }
      writeDraft(storage, id, {
        savedAt: new Date().toISOString(),
        baseUpdatedAt: state.saved.variant.updatedAt,
        document: state.draft,
      });
    };

    persist();
    const unsubscribe = store.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(persist, WRITE_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [pending, store]);

  if (!pending) return null;

  return (
    <div
      data-draft-recovery
      className="mb-3 flex flex-wrap items-center gap-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
    >
      <span>
        Unsaved changes from {formatSavedAt(pending.savedAt)} were found for this variant. Nothing
        has been written to disk.
      </span>
      <span className="ml-auto flex items-center gap-2">
        <button
          type="button"
          data-restore-draft
          className="rounded bg-amber-700 px-2 py-1 font-medium text-white hover:bg-amber-800"
          onClick={() => {
            restore(pending.document);
            setPending(null);
          }}
        >
          Restore them
        </button>
        <button
          type="button"
          data-discard-draft
          className="rounded border border-amber-300 px-2 py-1 font-medium text-amber-900 hover:bg-amber-100"
          onClick={() => {
            const { profileId, variantId } = store.getState();
            clearDraft(browserDraftStorage(), { profileId, variantId });
            setPending(null);
          }}
        >
          Discard
        </button>
      </span>
    </div>
  );
}

/**
 * The reader only needs to recognise the session, so the local clock's own
 * formatting is enough. It runs after mount, past any hydration comparison.
 */
function formatSavedAt(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "an earlier session";
  return at.toLocaleString();
}
