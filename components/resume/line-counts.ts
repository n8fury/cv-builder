"use client";

/**
 * How many lines each bullet actually takes (SPEC §7, §11.5, §16.3).
 *
 * The editor's bullet fields say what a sentence costs — three lines, not
 * three lines of *editor* textarea, which is a different width in a different
 * face. The only place that answer exists is the preview: it is the document,
 * laid out at 502pt in Charter, so the count here is a reading of the same
 * boxes `PagedDocument` paginates rather than a second estimate of them.
 *
 * The reading is arithmetic on one rect per bullet, not a walk of line boxes.
 * Bullets are consecutive body-leading lines with no gap between them (§4.5),
 * so a bullet's own height *is* its line count times the leading — and the
 * cheap version matters, because this runs inside a measurement that already
 * re-runs on every keystroke.
 *
 * It leaves by the same route the page count does — a context, since the
 * preview lives in an iframe and its listener is editor chrome — and by
 * default there is no listener at all: `/render` renders the same document
 * and has nothing to tell.
 */
import { createContext, useContext } from "react";

import { BODY_LEADING_PT } from "@/lib/render/metrics";

import { LINK_ATTRIBUTE } from "./link-targets";

/** Every bullet the document laid out, by the library id it carries. */
export type BulletLines = ReadonlyMap<string, number>;

export type LineCountListener = (lines: BulletLines) => void;

const LineCountContext = createContext<LineCountListener | null>(null);

export const LineCountReporter = LineCountContext.Provider;

/** `null` where nothing is listening, which is what stops the work happening. */
export function useLineCountListener(): LineCountListener | null {
  return useContext(LineCountContext);
}

/**
 * A measured height in points as a count of lines.
 *
 * Rounded, not floored: the browser reports heights rounded to whole device
 * pixels, and a three-line bullet coming back a hundredth of a point short
 * must not read as two lines. Never below one — an empty bullet still occupies
 * its line, and a bullet that measured zero is one the preview has not laid
 * out yet.
 */
export function lineCount(heightPt: number, leadingPt: number = BODY_LEADING_PT): number {
  if (!(heightPt > 0) || !(leadingPt > 0)) return 1;
  return Math.max(1, Math.round(heightPt / leadingPt));
}

const BULLET_SELECTOR = `.resume-bullet[${LINK_ATTRIBUTE.bullet}]`;

/**
 * Page one's bullets and their line counts.
 *
 * Page one only, like every other measurement here: the later sheets are the
 * same flow re-rendered and windowed, so a bullet appears once per sheet and
 * only the first copy carries the flow's true geometry.
 */
export function measureBulletLines(flow: HTMLElement, pxPerPt: number): BulletLines {
  const lines = new Map<string, number>();
  if (!(pxPerPt > 0)) return lines;

  for (const bullet of flow.querySelectorAll<HTMLElement>(BULLET_SELECTOR)) {
    const id = bullet.getAttribute(LINK_ATTRIBUTE.bullet);
    if (!id || lines.has(id)) continue;
    lines.set(id, lineCount(bullet.getBoundingClientRect().height / pxPerPt));
  }

  return lines;
}

/** Whether two readings would print the same figure beside every field. */
export function sameLines(a: BulletLines, b: BulletLines): boolean {
  if (a.size !== b.size) return false;
  for (const [id, count] of a) if (b.get(id) !== count) return false;
  return true;
}
