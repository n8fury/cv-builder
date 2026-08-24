"use client";

/**
 * The live overflow indicator (SPEC §11.5).
 *
 * Reads whatever `PageGuides` last measured in the preview and says how long
 * the CV currently runs. Purely informational: §11.5 allows a CV to span
 * pages and explicitly rules out blocking the export on overflow, so nothing
 * here disables anything — it exists so a break is not a surprise discovered
 * in the PDF.
 */
import type { Pagination } from "@/lib/render/pagination";

export function PageCount({ pagination }: { pagination: Pagination }) {
  const { pageCount } = pagination;
  const overflows = pageCount > 1;

  return (
    <span
      data-page-count={pageCount}
      className={`text-xs ${overflows ? "text-amber-700" : "text-gray-500"}`}
      title={
        overflows
          ? "Guides in the preview mark each page break. Multi-page CVs export normally."
          : undefined
      }
    >
      {pageCount} {pageCount === 1 ? "page" : "pages"}
      {overflows ? " — crosses a page boundary" : null}
    </span>
  );
}
