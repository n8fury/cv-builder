import { describe, expect, it } from "vitest";

import { PAGE_HEIGHT_PT, PAGE_MARGIN_PT } from "./metrics";
import { pageWindows, paginate, type FlowBlock } from "./pagination";

/** The real page: 792pt less two 55pt margins (§4.1). */
const USABLE = PAGE_HEIGHT_PT - 2 * PAGE_MARGIN_PT;

function block(top: number, height: number, keepWithNext = false): FlowBlock {
  return { top, bottom: top + height, keepWithNext };
}

describe("paginate", () => {
  it("reports one page when the content fits exactly", () => {
    expect(
      paginate({ blocks: [block(0, 100)], contentHeight: USABLE, usableHeight: USABLE }),
    ).toEqual({ breaks: [], pageCount: 1 });
  });

  it("breaks prose at the page height when no block is in the way", () => {
    expect(paginate({ blocks: [], contentHeight: USABLE + 50, usableHeight: USABLE })).toEqual({
      breaks: [USABLE],
      pageCount: 2,
    });
  });

  it("pushes an unbreakable block that straddles the boundary onto the next page", () => {
    // Starts 40pt before the boundary, so a printer moves the whole box down.
    const entry = block(USABLE - 40, 90);
    expect(
      paginate({ blocks: [entry], contentHeight: entry.bottom, usableHeight: USABLE }),
    ).toEqual({ breaks: [entry.top], pageCount: 2 });
  });

  it("takes a keepWithNext heading down with the entry it pushes", () => {
    const heading = block(USABLE - 60, 20, true);
    const entry = block(USABLE - 40, 90);
    expect(
      paginate({ blocks: [heading, entry], contentHeight: entry.bottom, usableHeight: USABLE }),
    ).toEqual({ breaks: [heading.top], pageCount: 2 });
  });

  it("leaves a heading alone when its entry still fits", () => {
    const heading = block(USABLE - 200, 20, true);
    const entry = block(USABLE - 180, 90);
    expect(
      paginate({ blocks: [heading, entry], contentHeight: entry.bottom, usableHeight: USABLE }),
    ).toEqual({ breaks: [], pageCount: 1 });
  });

  it("cuts a block taller than a page rather than looping forever", () => {
    const giant = block(0, USABLE * 2 + 30);
    expect(
      paginate({ blocks: [giant], contentHeight: giant.bottom, usableHeight: USABLE }),
    ).toEqual({ breaks: [USABLE, USABLE * 2], pageCount: 3 });
  });

  it("does not push a block that already starts its own page", () => {
    // Break forced at 600; the next block starts there and overruns anyway.
    const first = block(600, 200);
    const second = block(600 + USABLE, 10);
    expect(
      paginate({
        blocks: [first, second],
        contentHeight: second.bottom,
        usableHeight: USABLE,
      }),
    ).toEqual({ breaks: [600, 600 + USABLE], pageCount: 3 });
  });

  it("measures the second page from the pushed block, not from the page grid", () => {
    // The whole point of the guides: after a push, the next boundary is one
    // page below where the pushed block landed — not two page heights down.
    const pushed = block(USABLE - 40, 90);
    const later = block(USABLE - 40 + USABLE - 20, 60);
    expect(
      paginate({ blocks: [pushed, later], contentHeight: later.bottom, usableHeight: USABLE }),
    ).toEqual({ breaks: [pushed.top, later.top], pageCount: 3 });
  });

  it("ignores an overrun inside the tolerance", () => {
    expect(
      paginate({
        blocks: [],
        contentHeight: USABLE + 0.3,
        usableHeight: USABLE,
        tolerance: 0.5,
      }),
    ).toEqual({ breaks: [], pageCount: 1 });
  });

  it("rejects a non-positive page height instead of looping", () => {
    expect(() => paginate({ blocks: [], contentHeight: 10, usableHeight: 0 })).toThrow(
      /usableHeight/,
    );
  });
});

describe("pageWindows", () => {
  it("gives a one-page CV a single sheet showing the top of the flow", () => {
    expect(pageWindows({ breaks: [], pageCount: 1 })).toEqual([
      { pageNumber: 1, offset: 0, height: undefined },
    ]);
  });

  it("starts each later sheet where the previous page was cut", () => {
    expect(pageWindows({ breaks: [600, 1200], pageCount: 3 })).toEqual([
      { pageNumber: 1, offset: 0, height: 600 },
      { pageNumber: 2, offset: 600, height: 600 },
      // The last sheet runs to the full page — nothing caps it.
      { pageNumber: 3, offset: 1200, height: undefined },
    ]);
  });

  it("windows a real measurement end to end, leaving no gap between sheets", () => {
    // A block that will not fit under the boundary is pushed whole, so its
    // page ends early — and the next sheet has to pick up exactly there, or
    // the preview shows a slice of the document twice or not at all.
    const pagination = paginate({
      blocks: [block(USABLE - 20, 60)],
      contentHeight: USABLE + 200,
      usableHeight: USABLE,
    });
    const windows = pageWindows(pagination);

    expect(windows).toHaveLength(2);
    expect(windows[1].offset).toBe(USABLE - 20);
    expect(windows[1].offset).toBeLessThan(USABLE);
    // The page ended 20pt early, so its window has to stop 20pt early too —
    // otherwise the sheet shows the pushed block that page two starts with.
    expect(windows[0].height).toBe(USABLE - 20);
  });

  it("never gives a sheet a window taller than the page", () => {
    const pagination = paginate({
      blocks: [],
      contentHeight: USABLE * 2.5,
      usableHeight: USABLE,
    });
    for (const { height } of pageWindows(pagination)) {
      if (height !== undefined) expect(height).toBeLessThanOrEqual(USABLE);
    }
  });
});

/**
 * An entry as §18.2's opt-in presents it, the way `measure()` reports it: the
 * head is the only atom, glued forward, and its box is extended down over the
 * two bullet lines `orphans` obliges it to keep. Everything below that is
 * ordinary breakable prose and contributes no block at all.
 */
function splitEntry(top: number, headHeight: number, bulletsHeight: number) {
  const KEPT = 24; // two lines of body leading, matching the bullet's orphans
  return {
    head: block(top, headHeight + KEPT, true),
    bottom: top + headHeight + bulletsHeight,
  };
}

describe("paginate over a splittable entry (§18.2)", () => {
  const HEAD = 24;

  it("cuts inside the bullets rather than migrating the entry", () => {
    // Head starts 200pt before the boundary; the bullets run well past it.
    const top = USABLE - 200;
    const { head, bottom } = splitEntry(top, HEAD, 400);
    const { breaks, pageCount } = paginate({
      blocks: [head],
      contentHeight: bottom,
      usableHeight: USABLE,
    });

    expect(pageCount).toBe(2);
    // Below the head, not at the top of the entry: the head and the bullets
    // that fit stay put, and the rest flows over.
    expect(breaks).toEqual([USABLE]);
    expect(breaks[0]).toBeGreaterThan(head.bottom);
  });

  it("never leaves the head as the last thing on a page", () => {
    // The head itself fits with 4pt to spare, but the two lines it must keep
    // do not — so it goes down with its bullets instead of sitting alone.
    const top = USABLE - HEAD - 4;
    const { head, bottom } = splitEntry(top, HEAD, 400);
    const [cut] = paginate({ blocks: [head], contentHeight: bottom, usableHeight: USABLE }).breaks;

    expect(cut).toBe(top);
  });

  it("takes the section heading down when the head cannot stay", () => {
    const heading = block(USABLE - HEAD - 24, 20, true);
    const { head, bottom } = splitEntry(USABLE - HEAD - 4, HEAD, 400);
    const [cut] = paginate({
      blocks: [heading, head],
      contentHeight: bottom,
      usableHeight: USABLE,
    }).breaks;

    expect(cut).toBe(heading.top);
  });

  it("leaves a head that fits where it is, and breaks the prose below it", () => {
    // The bullets overrun on their own; that is a prose break, and it must
    // not drag the head — which is the whole difference from §11.5's atom.
    const top = USABLE - 300;
    const { head, bottom } = splitEntry(top, HEAD, 400);
    const [cut] = paginate({ blocks: [head], contentHeight: bottom, usableHeight: USABLE }).breaks;

    expect(cut).toBe(USABLE);
    expect(cut).toBeGreaterThan(head.bottom);
  });
});

/**
 * A bullet of `count` lines starting at `top`, as `measure()` reports it —
 * legal break offsets already filtered by orphans and widows.
 */
function bullet(top: number, count: number, leading = 12) {
  const tops = Array.from({ length: count }, (_, i) => top + i * leading);
  return {
    top,
    bottom: top + count * leading,
    breaks: tops.slice(2, Math.max(tops.length - 1, 0)),
  };
}

describe("prose breaks land where the prose can break (§18.2)", () => {
  it("moves a break that would cut a line up to a legal line boundary", () => {
    // Ten lines from 604; the 682pt boundary falls through the line at 676.
    const run = bullet(604, 10);
    const { breaks } = paginate({
      blocks: [],
      proseRuns: [run],
      contentHeight: 900,
      usableHeight: USABLE,
    });

    expect(breaks[0]).toBe(676);
    expect(run.breaks).toContain(breaks[0]);
  });

  it("keeps two lines behind and two over, as orphans and widows require", () => {
    const run = bullet(604, 10);
    const [cut] = paginate({
      blocks: [],
      proseRuns: [run],
      contentHeight: 900,
      usableHeight: USABLE,
    }).breaks;

    expect((cut - run.top) / 12).toBeGreaterThanOrEqual(2);
    expect((run.bottom - cut) / 12).toBeGreaterThanOrEqual(2);
  });

  it("moves a bullet too short to break whole", () => {
    // Three lines cannot leave two and carry two, so the printer moves it all.
    const run = bullet(USABLE - 24, 3);
    expect(run.breaks).toHaveLength(0);

    const [cut] = paginate({
      blocks: [],
      proseRuns: [run],
      contentHeight: 900,
      usableHeight: USABLE,
    }).breaks;

    expect(cut).toBe(run.top);
  });

  it("moves the break down a line rather than stranding a widow", () => {
    // The boundary cuts the last line, which may not travel alone; the legal
    // offset at or above it is one line earlier.
    const run = bullet(USABLE - 8 * 12 + 4, 8);
    const [cut] = paginate({
      blocks: [],
      proseRuns: [run],
      contentHeight: 900,
      usableHeight: USABLE,
    }).breaks;

    expect(cut).toBeLessThanOrEqual(USABLE);
    expect((run.bottom - cut) / 12).toBeGreaterThanOrEqual(2);
  });

  it("leaves a break that falls between runs alone", () => {
    const { breaks } = paginate({
      blocks: [],
      proseRuns: [bullet(USABLE - 120, 10)],
      contentHeight: 900,
      usableHeight: USABLE,
    });

    expect(breaks[0]).toBe(USABLE);
  });

  it("ignores runs nowhere near the boundary", () => {
    // Snapping to "the last legal offset anywhere" would drag the page end
    // 380pt up; only a run the boundary lands inside counts.
    const { breaks } = paginate({
      blocks: [],
      proseRuns: [bullet(180, 10)],
      contentHeight: 900,
      usableHeight: USABLE,
    });

    expect(breaks[0]).toBe(USABLE);
  });

  it("paginates identically to before when no runs are supplied", () => {
    const withNone = paginate({ blocks: [], contentHeight: 900, usableHeight: USABLE });
    expect(withNone).toEqual({ breaks: [USABLE], pageCount: 2 });
    expect(
      paginate({ blocks: [], proseRuns: [], contentHeight: 900, usableHeight: USABLE }),
    ).toEqual(withNone);
  });

  it("still terminates when every page ends on a snapped line", () => {
    const runs = Array.from({ length: 12 }, (_, i) => bullet(4 + i * 240, 20));
    const { pageCount, breaks } = paginate({
      blocks: [],
      proseRuns: runs,
      contentHeight: 2884,
      usableHeight: USABLE,
    });

    expect(pageCount).toBeGreaterThan(1);
    expect(breaks).toEqual([...breaks].sort((a, b) => a - b));
    expect(new Set(breaks).size).toBe(breaks.length);
  });
});

describe("keepWithNext means glued to the next block, not just declared", () => {
  it("does not chain headings that only have prose between them", () => {
    // About Me and Competencies both declare break-after: avoid, but each is
    // glued to its own paragraph — prose, carrying no block. Reporting them as
    // glued to one another builds a single chain from the first heading to the
    // last, and the first overrun anywhere pushes the whole document to page
    // two. That is what `gluedToNextBlock` in PagedDocument decides.
    const chained: FlowBlock[] = [
      { top: 60, bottom: 75, keepWithNext: true },
      { top: 200, bottom: 215, keepWithNext: true },
      { top: 300, bottom: 315, keepWithNext: true },
      { top: 330, bottom: 355, keepWithNext: true },
      { top: 670, bottom: 695, keepWithNext: true },
    ];
    // 60 is the first heading's top: the whole document moves to page two.
    expect(
      paginate({ blocks: chained, contentHeight: 1400, usableHeight: USABLE }).breaks[0],
    ).toBe(60);

    // The same geometry, reported correctly: nothing is glued to the block
    // after it, so the overrunning block moves and nothing else does.
    const honest = chained.map((item) => ({ ...item, keepWithNext: false }));
    expect(
      paginate({ blocks: honest, contentHeight: 1400, usableHeight: USABLE }).breaks[0],
    ).toBe(670);
  });

  it("still takes a heading down with the entry it is genuinely glued to", () => {
    const heading = block(USABLE - 60, 20, true);
    const entry = block(USABLE - 40, 90);
    expect(
      paginate({ blocks: [heading, entry], contentHeight: entry.bottom, usableHeight: USABLE })
        .breaks,
    ).toEqual([heading.top]);
  });
});
