/**
 * Bulk curation, one section at a time (SPEC §6.2, §7, §12.3).
 *
 * Curation is a checkbox per entry, and that is right for the last three
 * decisions of a tailoring pass. It is wrong for the first one: a variant
 * forked from a detailed CV starts with everything in, and narrowing it to
 * four jobs means twenty deliberate un-tickings before the real work begins.
 * "None, then pick" is a shorter sentence than "not that, not that, not that".
 *
 * Three actions, because there are three things anyone actually does to a
 * whole list — take all of it, take none of it, or swap what is in for what
 * is out. Invert is the one that is not obviously worth a button until a
 * variant needs the *other* four jobs, at which point it is the whole task.
 *
 * **Entry level only.** A bullet's own curation is not touched, in either
 * direction, because including an entry already restores the bullets it was
 * saved with (§6.2) — the store's `restoredBullets`. An "include all" that
 * also forced every bullet in would be a different edit from ticking the box,
 * and would silently overwrite the bullet choices the person had made in the
 * jobs they were keeping. Tags are how a bullet is curated in bulk (§6.1,
 * `./tags`); this is how a *list* is.
 *
 * Nothing here writes. Like `./tags`, this resolves a decision into per-item
 * changes that the store then walks through the ordinary `includeEntry` path,
 * which is what makes a bulk press produce exactly the draft the equivalent
 * ticking would — position (§15.3) and saved bullet curation included.
 */
import type { VariantSection } from "@/lib/schema/variant";

import { includedIds } from "./tags";

/** Take all of it, take none of it, or swap what is in for what is out. */
export type BulkMode = "all" | "none" | "invert";

/** One entry's new state — the argument `setEntryIncluded` would be given. */
export interface BulkChange {
  id: string;
  included: boolean;
}

/**
 * What one press changes, over the entries it is offered against.
 *
 * `entryIds` is the list the card is *showing*, not necessarily the whole
 * section: under the form's text filter these buttons act on what is on
 * screen, because a button sitting above a list of three rows offering to
 * clear twenty is not offering what it appears to.
 *
 * Only real changes are returned. An entry already in the state the mode asks
 * for is left out, so `all` on a full section is an empty list — which is what
 * lets each button disable itself at its end rather than push an empty undo
 * step. `invert` never returns an empty list for a non-empty section: every
 * entry changes, by definition.
 *
 * Read once, against the section as it stands. Inverting is defined against
 * the state at the moment of the press, not progressively against a list being
 * rewritten as the fold walks it.
 */
export function bulkChanges(
  section: VariantSection,
  entryIds: readonly string[],
  mode: BulkMode,
): BulkChange[] {
  const current = new Set(includedIds(section));

  if (mode === "invert") {
    return entryIds.map((id) => ({ id, included: !current.has(id) }));
  }
  const included = mode === "all";
  return entryIds.filter((id) => current.has(id) !== included).map((id) => ({ id, included }));
}

/** How much of `entryIds` this section currently includes — the `2/7` on screen. */
export function includedCount(section: VariantSection, entryIds: readonly string[]): number {
  const current = new Set(includedIds(section));
  return entryIds.filter((id) => current.has(id)).length;
}
