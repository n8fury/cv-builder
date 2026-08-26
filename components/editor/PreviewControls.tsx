"use client";

/**
 * The preview's own controls: how big, and how many sheets at once (SPEC §7).
 *
 * Two settings, and they answer different questions, so they are not folded
 * into one. Zoom is *how closely* the page is being read; one-sheet mode is
 * *which page* is being read. A four-page CV checked at 100% wants both; a
 * one-page CV wants neither, and gets no pager at all.
 *
 * Neither is part of the variant. Nothing here goes near the store: a zoom
 * level is how someone is looking at the document, not something the document
 * says, and it must not make the editor dirty or reach the file. It is
 * therefore also not remembered — reopening the editor starts at fit width,
 * which is where the preview has always started.
 *
 * The resolved percentage is printed next to the buttons because two of the
 * three sizes are computed. "Fit page" pressed on its own says only that a
 * page fits; "Fit page 46%" says what is being trusted when a gap looks tight.
 */
import { ZOOM_LABEL, ZOOM_MODES, zoomPercent, type ZoomMode } from "./zoom";

const GROUP = "inline-flex overflow-hidden rounded border border-gray-300";
const SEGMENT =
  "border-l border-gray-300 px-2 py-0.5 text-xs font-medium first:border-l-0 disabled:cursor-not-allowed disabled:opacity-40";
const ON = "bg-gray-900 text-white";
const OFF = "bg-white text-gray-700 hover:bg-gray-50";
const STEP =
  "rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40";

export function PreviewControls({
  zoom,
  onZoom,
  scale,
  single,
  onSingle,
  page,
  pageCount,
  onPage,
}: {
  zoom: ZoomMode;
  onZoom: (next: ZoomMode) => void;
  /** What `zoom` resolved to in the column it is being drawn in. */
  scale: number;
  single: boolean;
  onSingle: (next: boolean) => void;
  /** 1-based, already clamped to the stack. */
  page: number;
  pageCount: number;
  onPage: (next: number) => void;
}) {
  // One sheet *is* the whole document here, so there is nothing to page
  // through and nothing to turn on.
  const paged = pageCount > 1;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-600">
      <span className={GROUP} role="group" aria-label="Preview size">
        {ZOOM_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={zoom === mode}
            className={`${SEGMENT} ${zoom === mode ? ON : OFF}`}
            data-zoom={mode}
            onClick={() => onZoom(mode)}
          >
            {ZOOM_LABEL[mode]}
          </button>
        ))}
      </span>

      {/* The figure, not the mode, is what a tight gap is being judged at. */}
      <span data-preview-scale={Math.round(scale * 100)} className="tabular-nums">
        {zoomPercent(scale)}
      </span>

      {paged ? (
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-pressed={single}
            className={`${SEGMENT} rounded border border-gray-300 ${single ? ON : OFF}`}
            data-single-page
            onClick={() => onSingle(!single)}
          >
            One page at a time
          </button>

          {single ? (
            <>
              <button
                type="button"
                className={STEP}
                data-page-prev
                disabled={page <= 1}
                aria-label="Previous page"
                onClick={() => onPage(page - 1)}
              >
                ‹
              </button>
              <span data-page-showing={page} className="tabular-nums">
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                className={STEP}
                data-page-next
                disabled={page >= pageCount}
                aria-label="Next page"
                onClick={() => onPage(page + 1)}
              >
                ›
              </button>
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
