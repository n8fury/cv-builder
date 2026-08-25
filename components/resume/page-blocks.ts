/**
 * The selectors that make up the pagination model's atoms (SPEC §11.5).
 *
 * These name the same elements the stylesheet marks `break-inside: avoid` and
 * `break-after: avoid`. They are kept here, apart from the measuring
 * component, so `page-blocks.test.ts` can hold them against `resume.css`: a
 * rule added there and not here would leave the preview's sheets modelling a
 * page the printer no longer produces.
 */

/** Everything the stylesheet declares `break-inside: avoid`. */
export const UNBREAKABLE_SELECTOR =
  ".resume-section-heading, .resume-entry, .resume-recommendation";

/** Everything the stylesheet declares `break-after: avoid` (§15.11). */
export const KEEP_WITH_NEXT_SELECTOR = ".resume-section-heading";
