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
