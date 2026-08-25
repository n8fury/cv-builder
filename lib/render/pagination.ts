/**
 * Where the printed page breaks fall (SPEC §11.5).
 *
 * The document is laid out once, as one continuous flow, and the preview then
 * shows it as a stack of sheets — each sheet a window onto a slice of that
 * flow. Nothing observes where the slices fall, because on screen the flow is
 * never fragmented, so where a printer would cut it has to be worked out.
 *
 * This module is that model, kept pure and free of the DOM so it can be
 * tested against hand-built layouts. The measuring half lives in
 * `components/resume/PagedDocument.tsx`.
 *
 * The model is Chromium's block-fragmentation rules reduced to the two that
 * the resume stylesheet actually uses:
 *
 *   - `break-inside: avoid` (entries, headings, recommendations) — an atom
 *     that will not be cut, and is pushed whole to the next page instead.
 *   - `break-after: avoid` (headings, §15.11) — glue to whatever follows, so
 *     a heading pushed down takes its first entry with it and vice versa.
 *
 * Everything between the atoms is ordinary breakable prose. Since a page must
 * end on a line boundary and this model does not know where the lines are, a
 * break inside such a run is reported at the page's full height — accurate to
 * within one line's leading. Breaks forced by an atom, which is where every
 * visible jump in the preview comes from, are exact.
 */

/** A `break-inside: avoid` box, in flow coordinates: 0 is the first line. */
export type FlowBlock = {
  top: number;
  bottom: number;
  /** `break-after: avoid` — must not be left as the last block on a page. */
  keepWithNext: boolean;
};

export type Pagination = {
  /** Flow offsets where a page ends, ascending; empty for a one-page CV. */
  breaks: number[];
  pageCount: number;
};

export type PaginateOptions = {
  /** Blocks, non-overlapping and in document order. */
  blocks: readonly FlowBlock[];
  /** Total flowed height of the content box. */
  contentHeight: number;
  /** Height available for content on one page — page height less margins. */
  usableHeight: number;
  /**
   * Slack before an overrun counts. Measurements arrive as sub-pixel browser
   * values and a one-page CV's content is exactly one page tall, so without
   * this a rounding crumb invents a second page.
   */
  tolerance?: number;
};

/** The top of the earliest block glued to `index` by `keepWithNext`. */
function chainTop(blocks: readonly FlowBlock[], index: number): number {
  let first = index;
  while (first > 0 && blocks[first - 1].keepWithNext) first -= 1;
  return blocks[first].top;
}

export function paginate({
  blocks,
  contentHeight,
  usableHeight,
  tolerance = 0,
}: PaginateOptions): Pagination {
  if (usableHeight <= 0) throw new Error("paginate: usableHeight must be positive");

  const breaks: number[] = [];
  let pageStart = 0;

  /** Ends the current page at `at`. Ignores anything that cannot move it on. */
  const breakAt = (at: number): boolean => {
    if (at <= pageStart) return false;
    breaks.push(at);
    pageStart = at;
    return true;
  };

  /** Fills whole pages with breakable content until `end` is on this page. */
  const fillTo = (end: number): void => {
    while (end > pageStart + usableHeight + tolerance) {
      if (!breakAt(pageStart + usableHeight)) return;
    }
  };

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];

    // Prose ahead of this block can run over one or more page boundaries on
    // its own; those breaks land before the block is even considered.
    fillTo(block.top);

    if (block.bottom <= pageStart + usableHeight + tolerance) continue;

    // It overruns. Push it — and anything glued above it — to a fresh page,
    // unless it already starts one, in which case there is nothing to push.
    const anchor = chainTop(blocks, i);
    breakAt(anchor > pageStart ? anchor : block.top);

    // A block (or glued chain) taller than a page has to be cut regardless.
    fillTo(block.bottom);
  }

  // Prose after the last block.
  fillTo(contentHeight);

  return { breaks, pageCount: breaks.length + 1 };
}

/** One preview sheet: which page it is, and what slice of the flow it shows. */
export type PageWindow = {
  /** 1-based, as printed. */
  pageNumber: number;
  /** Flow offset, in points, of the first line this sheet shows. */
  offset: number;
  /**
   * Height of the slice, in points, or `undefined` for the last sheet — which
   * runs to the full page and needs no cap.
   *
   * A page does not always fill its height: an unbreakable block that will not
   * fit is pushed whole to the next page, ending this one early. The sheet is
   * still a whole page tall, but its window onto the flow has to stop where
   * the page did, or it shows the pushed block in the leftover space at the
   * bottom — and then the next sheet shows it again.
   */
  height?: number;
};

/**
 * The sheets a pagination describes (SPEC §11.5).
 *
 * Page one starts at the top of the flow and every later page starts where
 * the previous one was cut, so the offsets are the breaks with a leading zero
 * — which is the whole translation from "where does it break" to "what does
 * each sheet show". Kept here, beside the model that produced the breaks, so
 * the sheet stack cannot drift from the page count reported next to it.
 */
export function pageWindows({ breaks, pageCount }: Pagination): PageWindow[] {
  return Array.from({ length: pageCount }, (_, index) => {
    const offset = index === 0 ? 0 : breaks[index - 1];
    const end = breaks[index];
    return {
      pageNumber: index + 1,
      offset,
      height: end === undefined ? undefined : end - offset,
    };
  });
}
