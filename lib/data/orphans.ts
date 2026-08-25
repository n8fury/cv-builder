/**
 * Which library items no variant still uses (SPEC §7, §12.7).
 *
 * §7 names this as the reason the library manager exists at all: edit
 * propagates (§11.4), so wording accumulates, and with no delete path the
 * library fills with items nothing can reach and nobody can see. Orphan
 * detection is the "see" half; `deleteItem` is the other.
 *
 * A reference is a reference wherever it comes from — every variant on disk is
 * read, visible or not. A section switched off is still curation the person
 * chose (§12.2), and deleting the item under it would quietly empty the
 * section the next time it was switched back on.
 */
import type { ContentLibrary } from "../schema/library";
import type { Variant } from "../schema/variant";
import { flattenItems, indexLibrary, type LibraryItem } from "./library-index";
import { variantReferencedIds } from "./variant-refs";

/** One variant on disk, by the id its filename gives it (§12.5). */
export interface NamedVariant {
  id: string;
  variant: Variant;
}

/** Which variants name each library ID; absent from the map means orphaned. */
export type ReferenceIndex = Map<string, string[]>;

export function indexReferences(variants: readonly NamedVariant[]): ReferenceIndex {
  const index: ReferenceIndex = new Map();
  for (const { id, variant } of variants) {
    for (const ref of variantReferencedIds(variant)) {
      const seen = index.get(ref);
      if (seen) seen.push(id);
      else index.set(ref, [id]);
    }
  }
  return index;
}

/**
 * Every item no variant references, children included.
 *
 * A bullet is judged on its own reference, not its parent's: a variant that
 * includes a job but not one of its bullets leaves that bullet orphaned, and
 * that is exactly the wording §11.4's propagating edits leave behind.
 */
export function findOrphans(
  library: ContentLibrary,
  references: ReferenceIndex,
): LibraryItem[] {
  return flattenItems(indexLibrary(library)).filter((item) => !references.has(item.id));
}

/**
 * The variants blocking a delete, or an empty array when it is safe.
 *
 * Deleting an item a variant still names would leave that variant referencing
 * an ID the library lacks — which the resolver refuses to render (§13), so the
 * CV would break rather than lose a line. Hence a check with names in it,
 * never a silent cascade.
 */
export function blockingVariants(references: ReferenceIndex, id: string): string[] {
  return references.get(id) ?? [];
}
