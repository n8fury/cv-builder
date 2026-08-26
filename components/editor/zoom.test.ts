/**
 * The three sizes, and what each one resolves to (SPEC §7, §11.5).
 *
 * The figures below are the real page — 816×1056 CSS pixels — so a scale that
 * passes here is one the preview could actually be drawn at.
 */
import { describe, expect, it } from "vitest";

import {
  PAGE_HEIGHT_PX,
  PAGE_WIDTH_PX,
  clampPage,
  previewViewportHeight,
  zoomPercent,
  zoomScale,
} from "./zoom";

describe("the page in pixels", () => {
  it("is US Letter at 96dpi", () => {
    expect(PAGE_WIDTH_PX).toBe(816);
    expect(PAGE_HEIGHT_PX).toBe(1056);
  });
});

describe("zoomScale", () => {
  const roomy = { width: 2000, height: 2000 };

  it("draws 100% at 100%, however little room there is", () => {
    expect(zoomScale("actual", roomy)).toBe(1);
    expect(zoomScale("actual", { width: 300, height: 300 })).toBe(1);
  });

  it("fits the width to the column", () => {
    expect(zoomScale("fit-width", { width: 408, height: 2000 })).toBe(0.5);
    // Height is not its question: a short column still fills its width.
    expect(zoomScale("fit-width", { width: 408, height: 100 })).toBe(0.5);
  });

  it("fits the page to whichever of the two is tighter", () => {
    // Wide but short: the height decides.
    expect(zoomScale("fit-page", { width: 2000, height: 528 })).toBe(0.5);
    // Tall but narrow: the width does.
    expect(zoomScale("fit-page", { width: 408, height: 2000 })).toBe(0.5);
    // Both tight: the smaller of the two.
    expect(zoomScale("fit-page", { width: 408, height: 264 })).toBe(0.25);
  });

  it("never enlarges past the printed size", () => {
    for (const mode of ["fit-width", "fit-page"] as const) {
      expect(zoomScale(mode, roomy)).toBe(1);
    }
  });

  it("falls back to 100% rather than to nothing in an unmeasured column", () => {
    expect(zoomScale("fit-width", { width: 0, height: 0 })).toBe(1);
    expect(zoomScale("fit-page", { width: 0, height: 0 })).toBe(1);
    // Half measured: the dimension that has a figure is still honoured.
    expect(zoomScale("fit-page", { width: 0, height: 528 })).toBe(0.5);
  });
});

describe("zoomPercent", () => {
  it("prints whole percent", () => {
    expect(zoomPercent(1)).toBe("100%");
    expect(zoomPercent(0.6237)).toBe("62%");
  });
});

describe("previewViewportHeight", () => {
  it("is what the window leaves below the preview's top edge", () => {
    expect(previewViewportHeight(200, 1000)).toBe(776);
  });

  it("stops shrinking rather than fitting a page into nothing", () => {
    expect(previewViewportHeight(900, 1000)).toBe(240);
  });
});

describe("clampPage", () => {
  it("stays inside the stack", () => {
    expect(clampPage(2, 3)).toBe(2);
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(9, 3)).toBe(3);
  });

  it("lands on page one when there is not even a stack yet", () => {
    expect(clampPage(3, 0)).toBe(1);
  });
});
