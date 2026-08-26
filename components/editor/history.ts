/**
 * Undo and redo over the draft (SPEC §7).
 *
 * The store already keeps the whole document in one immutable value, so a
 * history is a list of those values rather than a list of inverse operations:
 * every mutation, from a keystroke to a drag-reorder to a new section, is
 * undone the same way — by putting back the document that preceded it. There
 * is nothing an action has to remember to make undoable.
 *
 * Two things stop that being one entry per keystroke. Consecutive edits to the
 * *same* field, close together in time, coalesce into the one entry: a `tag`
 * names the field a change was addressed to, and a change carrying the tag on
 * top of the stack extends it instead of stacking on it. And the stack is
 * capped — an editing session is long, and a document is not small.
 *
 * Anything untagged (`null`) never coalesces: a toggle, a reorder, a deletion
 * is its own step even when two of them land in the same millisecond.
 */
import type { EditorDocument } from "./store";

/** Consecutive edits to one field within this window are one undo step. */
export const COALESCE_MS = 600;

/** Oldest entries fall off the bottom past this. */
export const HISTORY_LIMIT = 100;

export interface HistoryEntry {
  /** The document as it was *before* the change this entry undoes. */
  document: EditorDocument;
  /** What the change was addressed to, or `null` for a step of its own. */
  tag: string | null;
  /** When the entry was opened, for the coalescing window. */
  at: number;
}

export interface History {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export const EMPTY_HISTORY: History = { past: [], future: [] };

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

/**
 * Record a change that has just replaced `before`.
 *
 * A new change always drops the redo stack: once the document has taken a
 * different turn, the futures recorded from the old one are no longer reachable
 * from where it now is, and offering them would splice two histories together.
 */
export function recorded(
  history: History,
  before: EditorDocument,
  tag: string | null,
  at: number,
): History {
  const top = history.past.at(-1);
  if (tag !== null && top && top.tag === tag && at - top.at <= COALESCE_MS) {
    // Extend the open entry: it already holds the document to go back to, and
    // only its clock moves, so a steadily typed word stays one step.
    return {
      past: [...history.past.slice(0, -1), { ...top, at }],
      future: [],
    };
  }
  return {
    past: [...history.past, { document: before, tag, at }].slice(-HISTORY_LIMIT),
    future: [],
  };
}

/**
 * The document one step back, and the history to hold alongside it — or `null`
 * when there is nothing to undo. `current` becomes the redo entry, so the pair
 * is exactly reversible.
 */
export function undone(
  history: History,
  current: EditorDocument,
): { history: History; document: EditorDocument } | null {
  const top = history.past.at(-1);
  if (!top) return null;
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [{ document: current, tag: top.tag, at: top.at }, ...history.future],
    },
    document: top.document,
  };
}

/** The mirror image: one step forward, with `current` pushed back onto `past`. */
export function redone(
  history: History,
  current: EditorDocument,
): { history: History; document: EditorDocument } | null {
  const [next, ...rest] = history.future;
  if (!next) return null;
  return {
    history: {
      past: [...history.past, { document: current, tag: next.tag, at: next.at }],
      future: rest,
    },
    document: next.document,
  };
}
