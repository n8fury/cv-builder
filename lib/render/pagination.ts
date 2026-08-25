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
 * Everything between the atoms is ordinary breakable prose. A page must end on
 * a line boundary, and the model has no idea where the lines are, so a break
 * inside such a run lands at the page's full height — off by up to one line's
 * leading. That was invisible while the only prose was a paragraph or two;
 * §18.2 made a split entry's bullets prose as well, and the error started
 * showing as a line sliced in half by the preview's page window.
 *
 * So the caller may supply the prose runs it knows about, each carrying the
 * offsets at which a break may legally fall — which is where its own
 * `orphans`/`widows` allow one. They are used for one thing: when a page
 * boundary lands *inside* a run, the break moves up to the last legal offset
 * at or above it, or to the top of the run when the run admits no break at
 * all. Nothing else consults them, and without them the model behaves exactly
 * as it did before.
 *
 * Breaks forced by an atom, which is where every visible jump in the preview
 * comes from, are exact either way.
 *
 * Alongside the breaks the model reports how full each page ended up, and what
 * a break moved on when it moved something whole. Those readings are pure
 * arithmetic over the breaks it just committed to — the editor's fit report is
 * a second reading of the pagination, never a second measurement of it.
 */

/** A `break-inside: avoid` box, in flow coordinates: 0 is the first line. */
export type FlowBlock = {
  top: number;
  bottom: number;
  /**
   * Glued to the block that follows it in this list.
   *
   * Narrower than "the element declares `break-after: avoid`", and the
   * difference matters: that rule glues an element to whatever immediately
   * follows it *in the flow*, which is often prose rather than the next block.
   * An About Me heading is glued to its paragraph, not to the next section's
   * heading, so it must not extend a chain reaching back from there — the
   * caller resolves that and reports the answer, not the raw declaration.
   */
  keepWithNext: boolean;
  /**
   * What to call this block when a break pushes it — an entry's title, a
   * section heading's words (SPEC §11.5). Purely for the editor's fit
   * readout: nothing in the model reads it, and omitting it changes no break.
   */
  label?: string;
};

/**
 * How full one page ended up (SPEC §11.5).
 *
 * The counterpart to `PageWindow`: that says what slice of the flow a sheet
 * shows, this says how much of the page that slice fills. Both are derived
 * from the same breaks, so the editor's readout and the sheets it describes
 * cannot disagree.
 *
 * `free` is the hole at the foot of the page. On the last page it is the room
 * left to fill — the gradient §11.5's page count never gave. On an earlier
 * page it is what a pushed block left behind, and `pushed` names that block.
 */
export type PageFit = {
  /** 1-based, as printed. */
  pageNumber: number;
  /** Flow height, in points, of what this page holds. */
  used: number;
  /** Points of page left unused; zero on a page filled to the boundary. */
  free: number;
  /**
   * The block whose push ended this page early, if one did — the label of the
   * block that would not fit, which now opens the next page. Absent when the
   * page ended on a prose line boundary, and on the last page.
   */
  pushed?: string;
};

export type Pagination = {
  /** Flow offsets where a page ends, ascending; empty for a one-page CV. */
  breaks: number[];
  pageCount: number;
  /** One entry per page, in order — how full each ended up (§11.5). */
  pages: PageFit[];
};

/**
 * A run of breakable prose, in flow coordinates, with the offsets a break may
 * legally fall at inside it.
 *
 * `breaks` is not "every line boundary": a bullet carries `orphans: 2` and
 * `widows: 2` (§18.2), so the first two and last two boundaries are not legal
 * break points, and a run of fewer than four lines has none at all — which is
 * how the model reproduces Chromium moving a short bullet whole.
 */
export type ProseRun = {
  top: number;
  bottom: number;
  breaks: readonly number[];
};

export type PaginateOptions = {
  /** Blocks, non-overlapping and in document order. */
  blocks: readonly FlowBlock[];
  /**
   * Breakable prose, so a break can be moved off a line it would otherwise cut
   * in half and onto one its `orphans`/`widows` actually permit. Optional;
   * omitting it restores the older, line-unaware behaviour exactly.
   */
  proseRuns?: readonly ProseRun[];
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

/**
 * The top of the earliest block glued to `index` by `keepWithNext`.
 *
 * Correct only because `keepWithNext` means "glued to the *next block*" rather
 * than "declares break-after: avoid" — see `FlowBlock`. Under the looser
 * reading a document whose sections have paragraph bodies grows one unbroken
 * chain from its first heading to its last, and the first overrun anywhere
 * pushes the whole document onto page two.
 */
function chainStart(blocks: readonly FlowBlock[], index: number): number {
  let first = index;
  while (first > 0 && blocks[first - 1].keepWithNext) first -= 1;
  return first;
}

export function paginate({
  blocks,
  proseRuns = [],
  contentHeight,
  usableHeight,
  tolerance = 0,
}: PaginateOptions): Pagination {
  if (usableHeight <= 0) throw new Error("paginate: usableHeight must be positive");

  const breaks: number[] = [];
  /**
   * What each break pushed, aligned with `breaks` — `undefined` wherever a
   * page simply ran out of room mid-prose and nothing was moved whole.
   */
  const pushed: (string | undefined)[] = [];
  let pageStart = 0;

  /**
   * Moves a prose break to a place the prose it lands in would actually break.
   *
   * Deliberately conditional on `at` falling inside a run: a break already in
   * the gap between two runs — or in a stretch with no prose recorded at all —
   * is left exactly where it was. Snapping unconditionally to "the last legal
   * offset" would drag a break hundreds of points up when the nearest prose is
   * far above it.
   *
   * Falling back to `run.top` is not a fudge: a run whose `orphans`/`widows`
   * admit no break at or above `at` is one the printer moves whole, and its
   * top is where the printer moves it to.
   */
  const onLineBoundary = (at: number): number => {
    const run = proseRuns.find((item) => item.top < at - tolerance && item.bottom > at + tolerance);
    if (run === undefined) return at;
    let best = run.top;
    for (const offset of run.breaks) {
      if (offset <= at + tolerance && offset > best) best = offset;
    }
    return best;
  };

  /** Ends the current page at `at`. Ignores anything that cannot move it on. */
  const breakAt = (at: number, moved?: string): boolean => {
    if (at <= pageStart) return false;
    breaks.push(at);
    pushed.push(moved);
    pageStart = at;
    return true;
  };

  /** Fills whole pages with breakable content until `end` is on this page. */
  const fillTo = (end: number): void => {
    while (end > pageStart + usableHeight + tolerance) {
      if (!breakAt(onLineBoundary(pageStart + usableHeight))) return;
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
    //
    // The name reported is the overrunning block's own, not the chain's: the
    // chain may start at a section heading that came along only because it is
    // glued forward, and the block that would not fit is the one worth
    // naming. The heading's label stands in when the entry carries none.
    const start = chainStart(blocks, i);
    const anchor = blocks[start].top;
    breakAt(anchor > pageStart ? anchor : block.top, block.label ?? blocks[start].label);

    // A block (or glued chain) taller than a page has to be cut regardless.
    fillTo(block.bottom);
  }

  // Prose after the last block.
  fillTo(contentHeight);

  return { breaks, pageCount: breaks.length + 1, pages: pageFits() };

  /**
   * How full each page ended up — the same arithmetic `pageWindows` does, read
   * against the page rather than against the flow (§11.5).
   *
   * A page runs from the previous break to its own, and the last one runs to
   * the end of the content, so `used` is a difference of two numbers the model
   * has already committed to. That is what keeps the readout and the sheets
   * the preview draws in agreement: neither measures anything the other does
   * not.
   */
  function pageFits(): PageFit[] {
    return Array.from({ length: breaks.length + 1 }, (_, index) => {
      const top = index === 0 ? 0 : breaks[index - 1];
      // A break past the content's own end cannot happen, but a document
      // shorter than its last break would report a negative fill if one did.
      const used = Math.max((breaks[index] ?? contentHeight) - top, 0);
      return {
        pageNumber: index + 1,
        used,
        // Clamped: the last page may exceed the boundary by the tolerance, and
        // "-0.3pt free" is a rounding crumb dressed up as an overflow.
        free: Math.max(usableHeight - used, 0),
        pushed: pushed[index],
      };
    });
  }
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
export function pageWindows({
  breaks,
  pageCount,
}: Pick<Pagination, "breaks" | "pageCount">): PageWindow[] {
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
