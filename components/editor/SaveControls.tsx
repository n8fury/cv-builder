"use client";

/**
 * Save and Save As (SPEC §7, §12.5).
 *
 * Save overwrites the open variant; Save As forks it into a new file named
 * `{tag}_{date}`, with the tag prefilled from the parent and always editable
 * (§12.5). Both commit *two* files — the variant's curation and the library's
 * text — because that is what an editor session actually produces (§6.3,
 * §11.4).
 *
 * Everything the editor has done up to this point has been staged in memory,
 * so this is the only place in the editor that reaches disk.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/app/(dashboard)/Toaster";
import {
  saveVariantAction,
  saveVariantAsAction,
  type SaveResult,
} from "@/app/(dashboard)/edit/actions";
import { saveAsVariantId } from "@/lib/data/variant-name";
import { editPath } from "@/lib/routes";

import { useEditor } from "./EditorStoreProvider";
import { isDirty } from "./store";

const BUTTON =
  "rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY =
  "rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300";

function Spinner() {
  return (
    <span
      aria-hidden
      data-spinner
      className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white align-[-1px]"
    />
  );
}

export function SaveControls() {
  const profileId = useEditor((state) => state.profileId);
  const variantId = useEditor((state) => state.variantId);
  const draft = useEditor((state) => state.draft);
  const dirty = useEditor(isDirty);
  const markSaved = useEditor((state) => state.markSaved);

  const toast = useToast();
  const router = useRouter();
  const [pending, setPending] = useState<"save" | "saveAs" | null>(null);
  // `null` is closed; a string is the tag being typed, so an emptied field
  // stays open rather than snapping shut.
  const [tag, setTag] = useState<string | null>(null);

  const busy = pending !== null;

  async function run(kind: "save" | "saveAs", call: () => Promise<SaveResult>): Promise<void> {
    setPending(kind);
    try {
      const result = await call();
      if (result.error || !result.saved) {
        toast(result.error ?? "Save failed.", "error");
        return;
      }
      if (result.saved.variantId === variantId) {
        markSaved({ variant: result.saved.variant, library: result.saved.library });
        return;
      }
      // A fork leaves the open variant exactly as it was on disk — so it is
      // still, correctly, unsaved — and the fork becomes the open document.
      toast(`Saved as ${result.saved.variantId}`);
      setTag(null);
      router.push(editPath(profileId, result.saved.variantId));
    } catch (error) {
      // A server action can fail before it returns anything — a dropped
      // connection, a crash. §13: never silently.
      toast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setPending(null);
    }
  }

  const derivedId = tag === null ? null : saveAsVariantId(tag);
  const forking = tag !== null;
  // The primary button is Save or Create depending on the mode; the spinner
  // belongs to whichever action it is about to run.
  const primaryPending = forking ? pending === "saveAs" : pending === "save";
  const primaryDisabled = busy || (forking ? derivedId === null : !dirty);

  return (
    <div className="flex items-center gap-2">
      {tag === null ? null : (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            name="saveAsTag"
            aria-label="Tag for the new variant"
            className="w-44 rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-gray-500 focus:outline-none"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          />
          <span data-derived-id className="font-mono text-xs text-gray-500">
            {derivedId ?? "—"}
          </span>
        </span>
      )}

      <button
        type="button"
        aria-busy={primaryPending}
        data-save
        className={PRIMARY}
        disabled={primaryDisabled}
        onClick={() => {
          if (tag !== null) {
            void run("saveAs", () =>
              saveVariantAsAction({ profileId, variantId, tag, ...draft }),
            );
            return;
          }
          void run("save", () => saveVariantAction({ profileId, variantId, ...draft }));
        }}
      >
        {primaryPending ? <Spinner /> : null}
        {forking ? (primaryPending ? "Creating…" : "Create") : primaryPending ? "Saving…" : "Save"}
      </button>

      <button
        type="button"
        data-save-as
        className={BUTTON}
        disabled={busy}
        onClick={() => setTag(forking ? null : draft.variant.tag)}
      >
        {forking ? "Cancel" : "Save As…"}
      </button>
    </div>
  );
}
