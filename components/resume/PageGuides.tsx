"use client";

/**
 * Page-boundary guides (SPEC §11.5).
 *
 * The preview is one continuous column, not a stack of sheets, so the breaks
 * have to be worked out rather than observed: this measures the document's
 * unbreakable blocks, hands them to `paginate()`, and draws a hairline where
 * each page ends. It also reports the page count outwards, which is §11.5's
 * live overflow indicator.
 *
 * Informational chrome throughout — absolutely positioned, pointer- and
 * screen-only, so it contributes nothing to layout and cannot reach a PDF
 * (Puppeteer renders under print media, §15.10).
 *
 * The guides were a fixed hairline every 792pt before this. That is only
 * right for page one: every later page loses 110pt to its own margins, so
 * from the first break the drawn line ran further and further ahead of the
 * real one — by a whole 110pt by page two, more than an inch.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { PAGE_HEIGHT_PT, PAGE_MARGIN_PT, PAGE_WIDTH_PT } from "@/lib/render/metrics";
import { paginate, type FlowBlock, type Pagination } from "@/lib/render/pagination";

import { KEEP_WITH_NEXT_SELECTOR, UNBREAKABLE_SELECTOR } from "./page-blocks";
import { usePaginationListener } from "./pagination-context";

/** Content height of one page: 792pt less the two 55pt margins (§4.1). */
const USABLE_HEIGHT_PT = PAGE_HEIGHT_PT - 2 * PAGE_MARGIN_PT;

/**
 * Slack, in points, before an overrun counts as a second page. A one-page CV
 * fills its page exactly, and the browser reports heights rounded to whole
 * device pixels, so without this a sub-pixel crumb invents a page break at
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

function measure(page: HTMLElement): Pagination {
  const pageRect = page.getBoundingClientRect();
  // Zero width means the document is not laid out yet — a freshly written
  // iframe, or a collapsed column. Nothing to measure, and dividing by it
  // would report Infinity as a page count.
  if (pageRect.width === 0) return EMPTY;

  // Derived from the box rather than assumed to be 96/72: it absorbs whatever
  // the browser rounded 612pt to, so the blocks and the page height are
  // converted on the same scale.
  const pxPerPt = pageRect.width / PAGE_WIDTH_PT;
  const style = getComputedStyle(page);
  const padTop = Number.parseFloat(style.paddingTop);
  const padBottom = Number.parseFloat(style.paddingBottom);
  // Flow coordinates: 0 is the first content line, inside the top margin.
  const origin = pageRect.top + padTop;

  const blocks: FlowBlock[] = [];
  let previousBottom = Number.NEGATIVE_INFINITY;
  for (const element of page.querySelectorAll<HTMLElement>(UNBREAKABLE_SELECTOR)) {
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
    contentHeight: (page.scrollHeight - padTop - padBottom) / pxPerPt,
    usableHeight: USABLE_HEIGHT_PT,
    tolerance: TOLERANCE_PT,
  });
}

export function PageGuides() {
  const root = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState<Pagination>(EMPTY);
  const report = usePaginationListener();

  // Re-measures in place, and keeps the previous object when nothing moved —
  // which is what stops a measurement that runs on every render from
  // triggering the next one.
  const remeasure = useCallback((page: HTMLElement) => {
    setPagination((current) => {
      const next = measure(page);
      return samePagination(current, next) ? current : next;
    });
  }, []);

  // No dependency array on purpose: every draft keystroke re-renders the
  // document, and a reorder can move the breaks without changing its overall
  // height — which a ResizeObserver alone would never see.
  useEffect(() => {
    const page = root.current?.closest<HTMLElement>(".resume-page");
    if (page) remeasure(page);
  });

  // Reflow the render pass cannot see: web fonts arriving, or the editor
  // column being resized under a preview that is already committed.
  useEffect(() => {
    const page = root.current?.closest<HTMLElement>(".resume-page");
    if (!page) return;
    const observer = new ResizeObserver(() => remeasure(page));
    observer.observe(page);
    return () => observer.disconnect();
  }, [remeasure]);

  useEffect(() => report(pagination), [report, pagination]);

  return (
    <div ref={root} className="resume-page-guides" aria-hidden="true">
      {pagination.breaks.map((offset, index) => (
        <div
          key={index}
          className="resume-page-guide"
          style={{ top: `${PAGE_MARGIN_PT + offset}pt` }}
        >
          <span className="resume-page-guide-label">Page {index + 2}</span>
        </div>
      ))}
    </div>
  );
}
