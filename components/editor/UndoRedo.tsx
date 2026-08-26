"use client";

/**
 * Undo and redo, on the keys and in the header (SPEC §7).
 *
 * The history itself lives in the store; this is only the two ways of reaching
 * it. The buttons are there because a shortcut nobody can see is a shortcut
 * nobody uses, and because the disabled states are the only place the editor
 * says how far back it can go.
 *
 * The keys are taken even while a text field has focus, and that is the point:
 * a bullet's field is a view of the draft, not a document of its own, so the
 * browser's own undo would put text back into one box while every other reader
 * of the draft — the preview, the crash copy, the dirty indicator — carried on
 * from the store. One history, one Ctrl+Z.
 */
import { useEffect } from "react";

import { useEditor } from "./EditorStoreProvider";
import { canRedo, canUndo } from "./history";

const BUTTON =
  "rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40";

/** Ctrl+Z / Ctrl+Y, plus the Mac spellings — Cmd+Z and Cmd+Shift+Z. */
function shortcut(event: KeyboardEvent): "undo" | "redo" | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "y") return "redo";
  if (key !== "z") return null;
  return event.shiftKey ? "redo" : "undo";
}

export function UndoRedo() {
  const undo = useEditor((state) => state.undo);
  const redo = useEditor((state) => state.redo);
  const undoable = useEditor((state) => canUndo(state.history));
  const redoable = useEditor((state) => canRedo(state.history));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Mid-composition an IME is using these keys for its own candidate list.
      if (event.isComposing) return;
      const action = shortcut(event);
      if (!action) return;
      event.preventDefault();
      if (action === "undo") undo();
      else redo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        data-undo
        className={BUTTON}
        disabled={!undoable}
        title="Undo (Ctrl+Z)"
        onClick={undo}
      >
        Undo
      </button>
      <button
        type="button"
        data-redo
        className={BUTTON}
        disabled={!redoable}
        title="Redo (Ctrl+Y)"
        onClick={redo}
      >
        Redo
      </button>
    </span>
  );
}
