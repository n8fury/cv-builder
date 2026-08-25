/**
 * The selectors that make up the pagination model's atoms (SPEC §11.5, §18.2).
 *
 * These name the same elements the stylesheet marks `break-inside: avoid` and
 * `break-after: avoid`. They are kept here, apart from the measuring
 * component, so `page-blocks.test.ts` can hold them against `resume.css`: a
 * rule added there and not here would leave the preview's sheets modelling a
 * page the printer no longer produces.
 *
 * The `[data-split="true"]` halves are §18.2's opt-in: a section that allows
 * its entries to split stops offering the entry as one atom and offers only
 * its head. Both sets are listed here unconditionally — they are mutually
 * exclusive by selector, so a document mixing split and unsplit sections
 * measures each the way the printer will fragment it.
 *
 * A split entry's bullets are absent on purpose. They are ordinary breakable
 * prose under §18.2, governed by `orphans`/`widows` rather than by an atom,
 * and this model has no concept of a line box — so a break inside a bullet
 * run is reported at the page's full height, accurate to within one line's
 * leading, exactly as the module header describes for prose generally.
 */

/** Everything the stylesheet declares `break-inside: avoid`. */
export const UNBREAKABLE_SELECTOR = [
  ".resume-section-heading",
  ".resume-section:not([data-split=\"true\"]) .resume-entry",
  ".resume-recommendation",
  ".resume-section[data-split=\"true\"] .resume-entry-head",
].join(", ");

/** Everything the stylesheet declares `break-after: avoid` (§15.11, §18.2). */
export const KEEP_WITH_NEXT_SELECTOR = [
  ".resume-section-heading",
  ".resume-section[data-split=\"true\"] .resume-entry-head",
].join(", ");

/**
 * A split entry's head on its own (§18.2), for the one thing the block model
 * cannot express: `break-after: avoid` means something must follow the head on
 * the same page, and under §18.2 what follows is prose, not a block.
 * `chainTop` only ever fires when a *following block* overruns, so with
 * nothing but bullets below it the head would be modelled as sitting happily
 * at the foot of a page the printer would never produce.
 *
 * `PagedDocument` therefore measures the head as reaching down into the lines
 * it is obliged to keep, and the ordinary overrun rule does the rest.
 */
export const SPLIT_ENTRY_HEAD_SELECTOR = '.resume-section[data-split="true"] .resume-entry-head';

/**
 * `orphans` and `widows` on a split bullet (§18.2) — the fewest lines it may
 * leave behind, and the fewest it may carry over. Named here rather than in
 * the stylesheet alone because the preview has to reproduce the same arithmetic
 * to know where a bullet is allowed to break.
 */
export const SPLIT_BULLET_ORPHANS = 2;
export const SPLIT_BULLET_WIDOWS = 2;

/** The lines a split head must keep with it — the following bullet's orphans. */
export const SPLIT_HEAD_KEEPS_LINES = SPLIT_BULLET_ORPHANS;

/**
 * A split entry's bullets (§18.2) — the prose whose line boxes the preview
 * measures, so a page window never slices a line in half.
 *
 * Scoped to split sections rather than to all prose on purpose. These are the
 * only breaks §18.2 introduced, and leaving every other run alone keeps an
 * un-opted-in document's preview identical to what it was.
 */
export const SPLIT_BULLET_SELECTOR = '.resume-section[data-split="true"] .resume-bullet';
