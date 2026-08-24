/**
 * Array-position helpers for the editor (SPEC §15.3).
 *
 * Ordering in a variant is array position and nothing else — there is no
 * `order` field, precisely so a drag-reorder cannot write one source of truth
 * and leave the other stale. Everything here therefore moves items *within* an
 * array; nothing stamps a rank onto an item.
 */

/**
 * Lifts one item out and drops it back in at `to`, the semantics a drag ends
 * with. Out-of-range indices return the list unchanged rather than throwing: a
 * drop whose target has disappeared should do nothing, not break the editor.
 */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from === to) return next;
  if (from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** The same move addressed by ID, which is what a drag event carries. */
export function movedIds(list: readonly string[], fromId: string, toId: string): string[] {
  return moved(list, list.indexOf(fromId), list.indexOf(toId));
}

/** And for a list of records keyed by `id`. */
export function movedById<T extends { id: string }>(
  list: readonly T[],
  fromId: string,
  toId: string,
): T[] {
  const ids = list.map((item) => item.id);
  return moved(list, ids.indexOf(fromId), ids.indexOf(toId));
}

/**
 * Included items first, in the variant's order (§15.3), then whatever else the
 * library offers. The form's order is the CV's order, so the two columns read
 * the same way down the page — and the draggable run is the leading one.
 */
export function ordered<T extends { id: string }>(
  all: readonly T[],
  includedIds: readonly string[],
): T[] {
  const byId = new Map(all.map((item) => [item.id, item]));
  const included = includedIds.flatMap((id) => {
    const found = byId.get(id);
    return found ? [found] : [];
  });
  const includedSet = new Set(includedIds);
  return [...included, ...all.filter((item) => !includedSet.has(item.id))];
}

/**
 * A stable drag/React key per section. Sections have no ID — array position is
 * their identity (§15.3) — but a bare index changes under every reorder, and a
 * variant may hold several sections of the same type (§12.4), so neither alone
 * will do. Type plus its occurrence number is unique and survives a drag.
 */
export function sectionKeys(sections: readonly { type: string }[]): string[] {
  const seen = new Map<string, number>();
  return sections.map((section) => {
    const nth = seen.get(section.type) ?? 0;
    seen.set(section.type, nth + 1);
    return `${section.type}#${nth}`;
  });
}
