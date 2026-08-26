"use client";

/**
 * The comparison as it is drawn (SPEC §7).
 *
 * `diff.ts` settles what the two variants differ by; this settles how that
 * reads. Every row carries the same three-way mark — in this one, in the other
 * one, in both — at whatever depth it sits, because a bullet dropped from an
 * entry and an entry dropped from a section are the same kind of fact and are
 * worth being able to scan for in one pass.
 *
 * Pure presentation: it takes a comparison and draws it, touching neither the
 * store nor the disk, which is what lets it be rendered and read in a test.
 */
import type { DiffRow, VariantDiff as Comparison } from "./diff";

/** How each side is marked. `a` is the open draft; `b` is the other variant. */
const MARK = {
  a: { glyph: "+", className: "bg-emerald-100 text-emerald-800" },
  b: { glyph: "−", className: "bg-sky-100 text-sky-800" },
  both: { glyph: "·", className: "bg-gray-100 text-gray-500" },
} as const;

/** Indent per level, in Tailwind's spacing — sections, entries, bullets. */
const INDENT = ["pl-0", "pl-4", "pl-8"];

function Row({ row, depth, other }: { row: DiffRow; depth: number; other: string }) {
  const mark = MARK[row.side];
  const where =
    row.side === "a" ? "Only in this variant" : row.side === "b" ? `Only in ${other}` : "In both";

  return (
    <li data-diff-row data-diff-side={row.side} data-diff-id={row.id}>
      <div className={`flex items-baseline gap-2 py-0.5 ${INDENT[Math.min(depth, 2)]}`}>
        <span
          aria-label={where}
          title={where}
          className={`mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-bold ${mark.className}`}
        >
          {mark.glyph}
        </span>
        <span
          className={`min-w-0 flex-1 truncate ${
            depth === 0 ? "font-medium text-gray-900" : "text-gray-700"
          }`}
          title={row.label}
        >
          {row.label}
        </span>
        {row.reordered ? (
          <span
            data-diff-reordered
            className="shrink-0 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800"
          >
            different order
          </span>
        ) : null}
      </div>

      {row.options.map((option) => (
        <div
          key={option.label}
          data-diff-option
          className={`py-0.5 text-[11px] text-gray-600 ${INDENT[Math.min(depth + 1, 2)]} pl-6`}
        >
          {option.label}: <span className="font-medium text-emerald-800">{option.a}</span> here,{" "}
          <span className="font-medium text-sky-800">{option.b}</span> in {other}
        </div>
      ))}

      {row.children.length > 0 ? (
        <ul>
          {row.children.map((child) => (
            <Row key={child.key} row={child} depth={depth + 1} other={other} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Summary({ diff, other }: { diff: Comparison; other: string }) {
  const { summary } = diff;
  return (
    <p data-diff-summary className="mb-2 text-xs text-gray-600">
      <span className="font-medium text-emerald-800">{summary.onlyA}</span> only here ·{" "}
      <span className="font-medium text-sky-800">{summary.onlyB}</span> only in{" "}
      <span className="font-mono">{other}</span> · {summary.shared} in both
      {summary.options > 0
        ? ` · ${summary.options} ${summary.options === 1 ? "setting differs" : "settings differ"}`
        : ""}
      {diff.sectionsReordered ? " · sections in a different order" : ""}
    </p>
  );
}

/**
 * The whole report: what the two sides differ by, then the rows themselves.
 * `other` is the variant being compared against, named on every row that only
 * it has — "only in tailored_2026-08-01" beats "only in the other one".
 */
export function DiffReport({
  diff,
  other,
  rows,
}: {
  diff: Comparison;
  /** The other variant's id, as the rows and the summary name it. */
  other: string;
  /** What to list — the whole tree, or `onlyDifferences` of it. */
  rows: readonly DiffRow[];
}) {
  return (
    <>
      <Summary diff={diff} other={other} />
      {diff.identical ? (
        <p data-diff-identical className="text-xs text-gray-600">
          These two curate exactly the same content, in the same order.
        </p>
      ) : (
        <ul className="text-xs">
          {rows.map((row) => (
            <Row key={row.key} row={row} depth={0} other={other} />
          ))}
        </ul>
      )}
    </>
  );
}
