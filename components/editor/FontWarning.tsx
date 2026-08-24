"use client";

/**
 * The preview's font-fallback warning (SPEC §13, §15.14).
 *
 * §13 splits a missing face by path: the export refuses to produce a PDF,
 * because a plausible-looking document in the wrong typeface is the kind of
 * thing you notice after sending it — while the preview is a working draft
 * and simply carries on in `serif`. Carrying on quietly is the one thing it
 * must not do, though: the preview would then be a faithful picture of
 * nothing, and the first sign of trouble would be an export that 500s for no
 * visible reason.
 *
 * So this says both halves, and disables nothing.
 */
export function FontWarning({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;

  return (
    <p
      data-font-warning
      role="status"
      className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
    >
      <strong className="font-semibold">Preview is showing a fallback serif.</strong>{" "}
      {problems.join("; ")}. The layout below is not to scale, and PDF export will fail
      until the fonts are rebuilt — run <code className="font-mono">npm run build:fonts</code>.
    </p>
  );
}
