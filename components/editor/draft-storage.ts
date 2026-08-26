/**
 * The draft's crash copy (SPEC §7, §13).
 *
 * Everything the editor does is staged in memory until Save, which makes a
 * refresh — a reload, a closed tab, a crashed browser — silently destructive.
 * The store keeps writing a copy of the draft into `localStorage` under a key
 * naming the open document, so a session that ends without a save can be
 * offered back on the next one.
 *
 * Two rules keep the copy from ever *becoming* the truth:
 *
 * - It is only ever written while the draft is dirty, and removed the moment
 *   it is not, so a clean editor leaves nothing behind to recover.
 * - It is re-parsed through the same schemas the files on disk are parsed
 *   with, and pinned to the `updatedAt` it was taken against. A snapshot that
 *   fails either test is dropped rather than shown: the disk moved on (n8n,
 *   a hand edit, another tab that saved) and a stale draft would silently
 *   undo that on the next Save.
 *
 * Nothing here writes to disk. Declining a recovery discards the copy and
 * leaves the variant file exactly as it was.
 */
import { contentLibrarySchema } from "@/lib/schema/library";
import { variantSchema } from "@/lib/schema/variant";

import type { EditorDocument } from "./store";

/** Bumped if the stored shape changes; older records are dropped, not migrated. */
const RECORD_VERSION = 1;

const KEY_PREFIX = "cv-maker:draft:";

/** The subset of `Storage` used here, so a test can pass a plain object. */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoredDraft {
  /** When the copy was taken, ISO-8601. Shown in the recovery offer. */
  savedAt: string;
  /** The saved document's `updatedAt` at the time — the disk it branched from. */
  baseUpdatedAt: string;
  document: EditorDocument;
}

/** One key per open document, so two variants recover independently. */
export function draftKey({ profileId, variantId }: { profileId: string; variantId: string }): string {
  return `${KEY_PREFIX}${profileId}/${variantId}`;
}

/**
 * `localStorage` where there is one. A server render, a browser with storage
 * disabled and a privacy mode that throws on access all arrive here, and all
 * of them mean the same thing: no crash copy, editor otherwise unaffected.
 */
export function browserDraftStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function writeDraft(
  storage: DraftStorage | null,
  id: { profileId: string; variantId: string },
  record: StoredDraft,
): void {
  if (!storage) return;
  try {
    storage.setItem(draftKey(id), JSON.stringify({ version: RECORD_VERSION, ...record }));
  } catch {
    // A full quota must not take the editor down with it — the draft in
    // memory is still intact, and this is only its copy.
  }
}

export function clearDraft(
  storage: DraftStorage | null,
  id: { profileId: string; variantId: string },
): void {
  if (!storage) return;
  try {
    storage.removeItem(draftKey(id));
  } catch {
    // As above: losing the copy is the harmless direction.
  }
}

/**
 * The stored copy, or `null` if there is none worth offering.
 *
 * Parsing is total: anything that is not this version's record, holding a
 * variant and a library both valid against the current schemas, is treated as
 * absent. Hand-written or half-written JSON cannot reach the store this way.
 */
export function readDraft(
  storage: DraftStorage | null,
  id: { profileId: string; variantId: string },
): StoredDraft | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(draftKey(id));
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const record = parsed as Record<string, unknown>;
  if (record.version !== RECORD_VERSION) return null;
  if (typeof record.savedAt !== "string" || typeof record.baseUpdatedAt !== "string") return null;

  const document = record.document as { variant?: unknown; library?: unknown } | undefined;
  if (!document || typeof document !== "object") return null;

  const variant = variantSchema.safeParse(document.variant);
  const library = contentLibrarySchema.safeParse(document.library);
  if (!variant.success || !library.success) return null;

  return {
    savedAt: record.savedAt,
    baseUpdatedAt: record.baseUpdatedAt,
    document: { variant: variant.data, library: library.data },
  };
}

/**
 * What to offer on opening a variant: a stored draft that parsed, was taken
 * against the document now on disk, and still says something different from
 * it. A snapshot equal to disk is not a recovery — it is noise — and is
 * cleared on the way past.
 */
export function recoverableDraft(
  storage: DraftStorage | null,
  open: { profileId: string; variantId: string; saved: EditorDocument },
  differs: (a: EditorDocument, b: EditorDocument) => boolean,
): StoredDraft | null {
  const stored = readDraft(storage, open);
  if (!stored) return null;

  if (
    stored.baseUpdatedAt !== open.saved.variant.updatedAt ||
    !differs(stored.document, open.saved)
  ) {
    clearDraft(storage, open);
    return null;
  }
  return stored;
}
