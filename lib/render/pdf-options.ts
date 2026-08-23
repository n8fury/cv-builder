/**
 * The `page.pdf()` options the export path uses (SPEC §15.10).
 *
 * Pinned in their own module so `pdf-options.test.ts` can assert them without
 * standing up a browser: these four settings are the difference between a
 * Letter-sized document and a silently-A4 one, and a regression here produces
 * a PDF that still opens fine and is wrong by 17pt of width.
 */
import type { PDFOptions } from "puppeteer";

import { PAGE_HEIGHT_PT, PAGE_WIDTH_PT } from "./metrics";

export const PDF_PAGE_OPTIONS = {
  /*
   * `format` and the stylesheet's `@page { size: 612pt 792pt }` say the same
   * thing on purpose (§15.10): with only one of them, editing the other later
   * changes the page size with nothing to catch it.
   */
  format: "Letter",
  preferCSSPageSize: true,
  /** §2's page is white by paint, not by default — printBackground keeps it. */
  printBackground: true,
  /*
   * Zero on all four sides. The real 55pt margin is the stylesheet's `@page`
   * margin, which every page inherits including continuation pages; adding
   * Puppeteer's own margin on top would inset the page box a second time and
   * interact unpredictably with `preferCSSPageSize` (§8).
   */
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
} as const satisfies PDFOptions;

/** What the generated PDF's MediaBox must read, in points. */
export const EXPECTED_MEDIA_BOX_PT = { width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT };
