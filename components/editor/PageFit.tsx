"use client";

/**
 * The live fit report (SPEC §11.5).
 *
 * Its predecessor said "2 pages" and stopped. Tailoring a CV is largely a
 * fitting problem — cut a bullet, gain a line, see whether the last page
 * closes — and a bare page count gives that no gradient to descend: it moves
 * once, at the moment the fit is already lost. So this says *how much*: what
 * is left on the last page, what spilled past each break, and which entry a
 * break moved on.
 *
 * Every number here is read out of the same `Pagination` the sheet stack
 * windows itself with, so the report and the pages the preview draws cannot
 * disagree — there is one measurement, taken once, in `PagedDocument`.
 *
 * Informational, all of it. §11.5 allows a CV to run to several pages and
 * explicitly rules out blocking the export on overflow, so nothing here
 * disables anything or turns red.
 */
import { BODY_LEADING_PT, CONTENT_HEIGHT_PT } from "@/lib/render/metrics";
import type { Pagination } from "@/lib/render/pagination";

/** Points, to the nearest whole one — tenths are noise at this size. */
function pt(value: number): string {
  return `${Math.round(value)}pt`;
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/**
 * Points as body lines.
 *
 * A line of body text is the unit a person actually edits in — a bullet is
 * two of them, a cut phrase gives one back — so every point figure here is
 * offered in lines as well. `floor` for room left, because a part-line of
 * space holds nothing; `round` for space used, because that figure includes
 * headings and gaps and is an estimate either way.
 */
function linesFree(points: number): number {
  return Math.floor(points / BODY_LEADING_PT);
}

function linesUsed(points: number): number {
  return Math.max(Math.round(points / BODY_LEADING_PT), points > 0 ? 1 : 0);
}

export function PageFit({ pagination }: { pagination: Pagination }) {
  const { pageCount, pages } = pagination;
  const last = pages[pageCount - 1];
  const room = linesFree(last.free);
  // Against the whole page, not against `used + free`: a last page that ran
  // past the boundary by the model's tolerance still reads as a full bar.
  const filled = Math.min(last.used / CONTENT_HEIGHT_PT, 1);

  return (
    <div className="mb-3 text-xs text-gray-600">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span data-page-count={pageCount} className="font-medium text-gray-900">
          {plural(pageCount, "page")}
        </span>
        <span
          className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-200"
          // The gauge repeats the sentence beside it, which is the accessible
          // reading of this figure — announcing it twice helps nobody.
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-full bg-gray-400"
            style={{ width: `${filled * 100}%` }}
          />
        </span>
        <span data-page-free={Math.round(last.free)}>
          {room >= 1
            ? `Page ${pageCount}: ${pt(last.free)} free — room for ${plural(room, "more line")}`
            : `Page ${pageCount} is full`}
        </span>
      </div>

      {pages.length > 1 ? (
        <ul className="mt-1 space-y-0.5">
          {pages.slice(1).map((page) => {
            // The page before this one is what the break ended, so its push —
            // and the hole that push left — belong on this line.
            const previous = pages[page.pageNumber - 2];
            return (
              <li key={page.pageNumber}>
                {`Page ${page.pageNumber} holds ${pt(page.used)}, about ${plural(
                  linesUsed(page.used),
                  "line",
                )}.`}
                {previous.pushed === undefined
                  ? null
                  : ` “${previous.pushed}” moved here whole, leaving ${pt(
                      previous.free,
                    )} at the foot of page ${previous.pageNumber}.`}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
