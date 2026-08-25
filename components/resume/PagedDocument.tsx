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
  BODY_LEADING_PT,
} from "@/lib/render/metrics";
import {
  pageWindows,
  paginate,
  type FlowBlock,
  type ProseRun,
  type Pagination,
} from "@/lib/render/pagination";

import {
  KEEP_WITH_NEXT_SELECTOR,
  SPLIT_BULLET_ORPHANS,
  SPLIT_BULLET_SELECTOR,
  SPLIT_BULLET_WIDOWS,
  SPLIT_ENTRY_HEAD_SELECTOR,
  SPLIT_HEAD_KEEPS_LINES,
  UNBREAKABLE_SELECTOR,
} from "./page-blocks";
import { usePaginationListener } from "./pagination-context";

/**
 * Slack, in points, before an overrun counts as a second page. A one-page CV
 * fills its page exactly, and the browser reports heights rounded to whole
 * device pixels, so without this a sub-pixel crumb invents a second sheet at
 * the very bottom of a document that has none.
 */
const TOLERANCE_PT = 0.5;

/**
 * A document that has not been measured yet: one page, holding nothing.
 *
 * Run through `paginate` rather than written out, so the empty reading is the
 * same shape the real one is — including a page fill of a whole empty page,
 * which is what the editor's fit report shows before the first measurement
 * lands.
 */
export const EMPTY_PAGINATION: Pagination = paginate({
  blocks: [],
  contentHeight: 0,
  usableHeight: CONTENT_HEIGHT_PT,
});

/**
 * Two readings that would draw the same sheets and report the same fit.
 *
 * The page fills are compared as well as the breaks, and they have to be: a
 * one-page CV gains and loses lines without its break list ever changing, and
 * that is exactly the movement the space-left gauge exists to show.
 */
function samePagination(a: Pagination, b: Pagination): boolean {
  return (
    a.pageCount === b.pageCount &&
    a.breaks.length === b.breaks.length &&
    a.breaks.every((value, index) => Math.abs(value - b.breaks[index]) < 0.01) &&
    a.pages.every(
      (page, index) =>
        Math.abs(page.used - b.pages[index].used) < 0.01 &&
        page.pushed === b.pages[index].pushed,
    )
  );
}

/**
 * What to call a block the editor has to name (SPEC §11.5).
 *
 * Read out of the document rather than declared on it: an entry is already
 * headed by its title and a heading is already its own words, so there is no
 * second copy to keep in step with the first. Truncated because these end up
 * in one line of chrome, and an entry title can run to half a line of prose.
 */
const LABEL_SELECTOR = ".resume-entry-title, .resume-recommendation-name";
const LABEL_MAX_CHARS = 48;

function blockLabel(element: HTMLElement): string | undefined {
  const source = element.querySelector<HTMLElement>(LABEL_SELECTOR) ?? element;
  const text = (source.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text === "") return undefined;
  return text.length > LABEL_MAX_CHARS ? `${text.slice(0, LABEL_MAX_CHARS - 1)}…` : text;
}

/**
 * How far down a split entry's head really reaches, in viewport pixels
 * (SPEC §18.2), or `undefined` for any other element.
 *
 * `break-after: avoid` on the head means content must follow it on the same
 * page, and under §18.2 what follows is prose. `paginate` only consults
 * `keepWithNext` when a following *block* overruns, so with only bullets below
 * it the head would model as sitting contentedly at the foot of a page the
 * printer would never produce. Extending the head's box down over the lines it
 * is obliged to keep turns that into an ordinary overrun, which the model
 * already handles — no new glue direction, and nothing to keep in step.
 *
 * Two lines, matching the bullet's `orphans`. Capped at the first bullet's own
 * bottom: a one-line bullet cannot satisfy `orphans: 2` at all, so Chromium
 * declines to break after the head and keeps the whole bullet instead, which
 * is exactly where the cap lands.
 */
function keptBottom(element: HTMLElement, pxPerPt: number): number | undefined {
  if (!element.matches(SPLIT_ENTRY_HEAD_SELECTOR)) return undefined;
  const bullet = element.parentElement?.querySelector<HTMLElement>(".resume-bullet");
  if (!bullet) return undefined;
  const rect = bullet.getBoundingClientRect();
  return Math.min(rect.top + SPLIT_HEAD_KEEPS_LINES * BODY_LEADING_PT * pxPerPt, rect.bottom);
}

/**
 * Is `element`'s `break-after: avoid` actually gluing it to `next`?
 *
 * The rule glues an element to whatever immediately follows it in the flow.
 * That is `next` only when `next` sits inside the element's own next sibling —
 * a heading and the entry beneath it, or a heading and the head of the first
 * entry when the section is split. When the next sibling is prose instead (an
 * About Me paragraph, a bullet list under an entry head), the element is glued
 * to text that carries no block at all, and reporting it as glued to the next
 * *block* is how a chain ends up spanning the whole document.
 */
function gluedToNextBlock(element: HTMLElement, next: HTMLElement | undefined): boolean {
  const sibling = element.nextElementSibling;
  if (next === undefined || sibling === null) return false;
  return sibling === next || sibling.contains(next);
}

/**
 * Every split bullet as a prose run, with the offsets it may break at (§18.2).
 *
 * A Range over the element's contents yields one client rect per inline box.
 * That is a line box wherever the text is plain, and more than one wherever it
 * is not — an italic span, the bullet marker — so the tops are deduplicated
 * before they are counted. Counting matters here: the legal offsets are
 * derived from the line *index*, and a line seen twice would shift them.
 *
 * A break before line `i` leaves `i` lines above and `n - i` below, so it is
 * legal exactly while both sides clear the bullet's `orphans` and `widows`.
 * A bullet too short to satisfy both has no legal offset at all, which is the
 * model's way of saying the printer will move it whole.
 *
 * This is the only place the preview looks at line boxes. It is worth it here
 * because the alternative is visible: a page window cutting a line of prose in
 * half shows the top of the glyphs on one sheet and the bottom on the next.
 */
function proseRuns(flow: HTMLElement, origin: number, pxPerPt: number): ProseRun[] {
  const runs: ProseRun[] = [];
  const range = document.createRange();

  for (const bullet of flow.querySelectorAll<HTMLElement>(SPLIT_BULLET_SELECTOR)) {
    range.selectNodeContents(bullet);

    const tops: number[] = [];
    for (const rect of range.getClientRects()) {
      const top = (rect.top - origin) / pxPerPt;
      // Same line, second inline box: within a point of one already seen.
      if (!tops.some((seen) => Math.abs(seen - top) < 1)) tops.push(top);
    }
    tops.sort((a, b) => a - b);

    const rect = bullet.getBoundingClientRect();
    runs.push({
      top: (rect.top - origin) / pxPerPt,
      bottom: (rect.bottom - origin) / pxPerPt,
      breaks: tops.slice(SPLIT_BULLET_ORPHANS, Math.max(tops.length - SPLIT_BULLET_WIDOWS + 1, 0)),
    });
  }

  return runs;
}

/** Reads page one's flow and runs the §11.5 model over it. */
function measure(flow: HTMLElement): Pagination {
  const flowRect = flow.getBoundingClientRect();
  // Zero width means the document is not laid out yet — a freshly written
  // iframe, or a collapsed column. Nothing to measure, and dividing by it
  // would report Infinity as a page count.
  if (flowRect.width === 0) return EMPTY_PAGINATION;

  // Derived from the box rather than assumed to be 96/72: it absorbs whatever
  // the browser rounded 502pt to, so the blocks and the page height are
  // converted on the same scale.
  const pxPerPt = flowRect.width / CONTENT_WIDTH_PT;
  // Flow coordinates: 0 is the first content line. Page one's window starts
  // at the top of the flow, so this element's own top edge is that origin.
  const origin = flowRect.top;

  // Collected with their elements: whether a block is glued to the next one is
  // a question about the pair, so it cannot be answered inside the loop.
  const found: { element: HTMLElement; top: number; bottom: number }[] = [];
  let previousBottom = Number.NEGATIVE_INFINITY;
  for (const element of flow.querySelectorAll<HTMLElement>(UNBREAKABLE_SELECTOR)) {
    const rect = element.getBoundingClientRect();
    const top = (rect.top - origin) / pxPerPt;
    // `paginate` takes atoms in order and not overlapping. An unbreakable box
    // inside another is already covered by the outer one, and would otherwise
    // read as a block that starts before the previous one ended.
    if (top < previousBottom) continue;
    previousBottom = ((keptBottom(element, pxPerPt) ?? rect.bottom) - origin) / pxPerPt;
    found.push({ element, top, bottom: previousBottom });
  }

  const blocks: FlowBlock[] = found.map((item, index) => ({
    top: item.top,
    bottom: item.bottom,
    keepWithNext:
      item.element.matches(KEEP_WITH_NEXT_SELECTOR) &&
      gluedToNextBlock(item.element, found[index + 1]?.element),
    label: blockLabel(item.element),
  }));

  return paginate({
    blocks,
    proseRuns: proseRuns(flow, origin, pxPerPt),
    // The flow's own height, not the sheet's: the sheet is clipped to one
    // page, while the flow inside it is the whole document.
    contentHeight: flowRect.height / pxPerPt,
    usableHeight: CONTENT_HEIGHT_PT,
    tolerance: TOLERANCE_PT,
  });
}

export function PagedDocument({ children }: { children: ReactNode }) {
  const firstFlow = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const latest = useRef<Pagination>(EMPTY_PAGINATION);
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
