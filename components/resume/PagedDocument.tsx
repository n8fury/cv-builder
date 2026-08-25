"use client";

/**
 * The sheet stack (SPEC §11.5).
 *
 * A CV may run to several pages, and every one of them is the same page: the
 * 55pt margins on all four sides, the same 502×682pt content box. The preview
 * used to show one endless column with a hairline drawn where each break
 * fell, which reads nothing like the PDF — text ran straight across the
 * boundary with no bottom margin above it and no top margin below.
 *
 * So the preview is now literal sheets. The trick is that the document is
 * still laid out exactly once, as one continuous flow: each sheet renders the
 * whole document into a 682pt-tall window and shifts it up by that page's
 * flow offset, so the sheet shows its slice and clips the rest. Fragmenting
 * the DOM instead — splitting sections across separate page elements — would
 * mean the preview no longer laid the document out the way the printer does,
 * which is the one thing this preview exists to guarantee.
 *
 * Where the slices fall comes from `paginate()`, run over page one's copy —
 * the only copy anything measures, and the only one that carries the flow's
 * true geometry, since its offset is zero. Rendering more sheets cannot move
 * it, so the measurement does not chase itself.
 *
 * Print is the same flow with the windowing taken off: page one unclips to
 * its full height, the later sheets are hidden, and the text runs through the
 * page boxes `@page` defines (§8, §15.10). Puppeteer prints exactly what it
 * printed before this — the stack is screen chrome around an unchanged
 * document.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  CONTENT_HEIGHT_PT,
  CONTENT_WIDTH_PT,
} from "@/lib/render/metrics";
import {
  pageWindows,
  paginate,
  type FlowBlock,
  type Pagination,
} from "@/lib/render/pagination";

import { KEEP_WITH_NEXT_SELECTOR, UNBREAKABLE_SELECTOR } from "./page-blocks";
import { usePaginationListener } from "./pagination-context";

/**
 * Slack, in points, before an overrun counts as a second page. A one-page CV
 * fills its page exactly, and the browser reports heights rounded to whole
 * device pixels, so without this a sub-pixel crumb invents a second sheet at
 * the very bottom of a document that has none.
 */
const TOLERANCE_PT = 0.5;

const EMPTY: Pagination = { breaks: [], pageCount: 1 };

function samePagination(a: Pagination, b: Pagination): boolean {
  return (
    a.pageCount === b.pageCount &&
    a.breaks.length === b.breaks.length &&
    a.breaks.every((value, index) => Math.abs(value - b.breaks[index]) < 0.01)
  );
}

/** Reads page one's flow and runs the §11.5 model over it. */
function measure(flow: HTMLElement): Pagination {
  const flowRect = flow.getBoundingClientRect();
  // Zero width means the document is not laid out yet — a freshly written
  // iframe, or a collapsed column. Nothing to measure, and dividing by it
  // would report Infinity as a page count.
  if (flowRect.width === 0) return EMPTY;

  // Derived from the box rather than assumed to be 96/72: it absorbs whatever
  // the browser rounded 502pt to, so the blocks and the page height are
  // converted on the same scale.
  const pxPerPt = flowRect.width / CONTENT_WIDTH_PT;
  // Flow coordinates: 0 is the first content line. Page one's window starts
  // at the top of the flow, so this element's own top edge is that origin.
  const origin = flowRect.top;

  const blocks: FlowBlock[] = [];
  let previousBottom = Number.NEGATIVE_INFINITY;
  for (const element of flow.querySelectorAll<HTMLElement>(UNBREAKABLE_SELECTOR)) {
    const rect = element.getBoundingClientRect();
    const top = (rect.top - origin) / pxPerPt;
    // `paginate` takes atoms in order and not overlapping. An unbreakable box
    // inside another is already covered by the outer one, and would otherwise
    // read as a block that starts before the previous one ended.
    if (top < previousBottom) continue;
    previousBottom = (rect.bottom - origin) / pxPerPt;
    blocks.push({
      top,
      bottom: previousBottom,
      keepWithNext: element.matches(KEEP_WITH_NEXT_SELECTOR),
    });
  }

  return paginate({
    blocks,
    // The flow's own height, not the sheet's: the sheet is clipped to one
    // page, while the flow inside it is the whole document.
    contentHeight: flowRect.height / pxPerPt,
    usableHeight: CONTENT_HEIGHT_PT,
    tolerance: TOLERANCE_PT,
  });
}

export function PagedDocument({ children }: { children: ReactNode }) {
  const firstFlow = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState<Pagination>(EMPTY);
  const latest = useRef<Pagination>(EMPTY);
  const report = usePaginationListener();

  // Re-measures in place, and returns without touching state when nothing
  // moved — which is what stops a measurement that runs on every render from
  // triggering the next one.
  //
  // The comparison has to happen *before* `setPagination`, not inside an
  // updater that returns the current value: the effect below has no
  // dependency array, so calling the setter unconditionally schedules a pass
  // on every render, whose effect calls it again. React eventually gives up
  // with "Maximum update depth exceeded" and the preview stops updating. So
  // the last reading is kept in a ref, and state is touched only when the
  // page breaks have actually moved.
  const remeasure = useCallback(() => {
    const flow = firstFlow.current;
    if (!flow) return;
    const next = measure(flow);
    if (samePagination(latest.current, next)) return;
    latest.current = next;
    setPagination(next);
  }, []);

  // No dependency array on purpose: every draft keystroke re-renders the
  // document, and a reorder can move the breaks without changing its overall
  // height — which a ResizeObserver alone would never see.
  useEffect(remeasure);

  // Reflow the render pass cannot see: web fonts arriving, or the editor
  // column being resized under a preview that is already committed.
  useEffect(() => {
    const flow = firstFlow.current;
    if (!flow) return;
    const observer = new ResizeObserver(remeasure);
    observer.observe(flow);
    return () => observer.disconnect();
  }, [remeasure]);

  useEffect(() => report(pagination), [report, pagination]);

  const windows = pageWindows(pagination);

  return (
    <div className="resume-document">
      {windows.map(({ pageNumber, offset, height }) => (
        <div
          key={pageNumber}
          className="resume-page"
          // Only page one is the document as far as assistive tech is
          // concerned; the rest are the same content over again, windowed.
          aria-hidden={pageNumber > 1 ? true : undefined}
        >
          <div
            className="resume-page-clip"
            // Shorter than a full page wherever a pushed block ended this one
            // early. The sheet stays a whole page tall either way — it is the
            // window that stops, so the leftover space at the bottom shows the
            // white it would print as.
            style={height === undefined ? undefined : { height: `${height}pt` }}
          >
            <div
              className="resume-page-flow"
              ref={pageNumber === 1 ? firstFlow : undefined}
              // Page one is never offset, so the flow it measures is never
              // displaced — and print's rule to undo this has nothing to
              // fight over on the one sheet it keeps.
              style={offset ? { top: `${-offset}pt` } : undefined}
            >
              {children}
            </div>
          </div>
          {windows.length > 1 ? (
            <span className="resume-page-label" aria-hidden="true">
              Page {pageNumber} of {windows.length}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
