/**
 * How big the preview is drawn (SPEC §7, §11.5).
 *
 * The preview had exactly one size: whatever the column happened to be. That
 * is the right default and the wrong only option — reading a page at 62% and
 * checking a break at 62% are different jobs, and neither is helped by the
 * other one's scale.
 *
 * So three named sizes, and nothing in between. A zoom *slider* on a document
 * whose fidelity is the whole point invites a reading taken at 83%, where
 * every measured value is off by a number nobody is holding; each of these
 * three, by contrast, is a question with an answer: *what does the printed
 * page look like* (100%), *what is on this page* (fit page), *where does the
 * text sit in the column* (fit width).
 *
 * None of them enlarges past 100%. A page shown bigger than it prints is a
 * page whose spacing reads wrong in the direction that matters most here —
 * everything looks roomier than the paper will be — so fitting only ever
 * shrinks, and 100% is the ceiling rather than a midpoint.
 */
import { PAGE_HEIGHT_PT, PAGE_WIDTH_PT } from "@/lib/render/metrics";

/** CSS pixels per point: the browser's own 96dpi, which the iframe renders at. */
const PX_PER_PT = 96 / 72;

/** One sheet, unscaled, in the pixels the iframe lays it out in. */
export const PAGE_WIDTH_PX = PAGE_WIDTH_PT * PX_PER_PT;
export const PAGE_HEIGHT_PX = PAGE_HEIGHT_PT * PX_PER_PT;

export type ZoomMode = "fit-width" | "fit-page" | "actual";

/** In the order they are offered, widest fit first. */
export const ZOOM_MODES: readonly ZoomMode[] = ["fit-width", "fit-page", "actual"];

export const ZOOM_LABEL: Record<ZoomMode, string> = {
  "fit-width": "Fit width",
  "fit-page": "Fit page",
  actual: "100%",
};

/** The box the preview has to fit into, in CSS pixels. */
export interface Viewport {
  width: number;
  height: number;
}

/**
 * The scale a mode resolves to in a given viewport.
 *
 * An unmeasured viewport — a column that has not been laid out, a zero from a
 * `ResizeObserver`'s first call on a hidden tab — resolves to 1 rather than to
 * 0: the preview is briefly too big for its column, which the column scrolls,
 * where a zero would collapse it to nothing and take the measurement with it.
 */
export function zoomScale(mode: ZoomMode, viewport: Viewport): number {
  if (mode === "actual") return 1;
  const byWidth = viewport.width > 0 ? viewport.width / PAGE_WIDTH_PX : 1;
  if (mode === "fit-width") return Math.min(1, byWidth);
  const byHeight = viewport.height > 0 ? viewport.height / PAGE_HEIGHT_PX : 1;
  return Math.min(1, byWidth, byHeight);
}

/** The scale as the control prints it — whole percent, which is all it means. */
export function zoomPercent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

/** Room left below the preview's top edge, above the fold. */
const VIEWPORT_GUTTER_PX = 24;
/** Below this a "fit" is not a fit — better to overflow and let it scroll. */
const MIN_VIEWPORT_PX = 240;

/**
 * How tall a box the window leaves the preview.
 *
 * Measured from the preview's position in the *document*, not from its
 * position on screen: the on-screen figure changes as the column scrolls, and
 * a zoom that drifted while you scrolled past it would be unusable. This is
 * the height the preview has when the editor is scrolled to the top, which is
 * where a page is looked at whole.
 */
export function previewViewportHeight(documentTop: number, innerHeight: number): number {
  return Math.max(MIN_VIEWPORT_PX, innerHeight - documentTop - VIEWPORT_GUTTER_PX);
}

/**
 * The sheet a pager should land on, given how many there are.
 *
 * Pages come and go under the pager — a cut bullet closes the last one — so
 * every move is clamped rather than trusted, and a pager left pointing past
 * the end of a shrinking document lands on its last sheet.
 */
export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(page, 1), Math.max(pageCount, 1));
}
