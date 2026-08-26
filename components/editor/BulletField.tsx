"use client";

/**
 * The field a bullet is written in (SPEC §7, §16.3).
 *
 * One control, used everywhere a bullet's wording is editable — the curated
 * bullets of Experience and Projects, and a custom section's own list — so
 * that what is true of writing a bullet in one place is true of it everywhere.
 *
 * Three things it does that a bare `<textarea rows={2}>` did not:
 *
 * **It grows with what is in it.** A real bullet is three or four lines of
 * prose, and a fixed two-row box scrolls it: the sentence being rewritten is
 * half out of sight, and the text above it is out of reach without scrolling
 * inside a box inside a column. The height is set from the content on every
 * change, and again when the column's width changes under it, because a
 * narrower field wraps to more lines.
 *
 * **It says what the bullet costs.** The figure is the preview's own reading
 * of the laid-out document (`line-counts`), not this box's line count: this
 * box is a different width in a different face, and its own wrapping says
 * nothing about the page. Knowing a word will push a bullet from three lines
 * to four *before* committing to it is the whole point — the alternative is
 * writing it, looking right, and finding out.
 *
 * **Ctrl+I** wraps the selection in `*…*`, §16.3's markup, and takes it off
 * again (`markup-edit`). It is the one piece of formatting a bullet has and
 * the only one with no control at all until now.
 */
import { useCallback, useLayoutEffect, useRef, type ReactNode } from "react";

import { useLineCount } from "./line-counts";
import { isItalicShortcut, toggleItalic } from "./markup-edit";

const FIELD =
  "w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none resize-none overflow-hidden";

export function BulletField({
  id,
  value,
  onChange,
  dimmed = false,
  hover,
  note,
}: {
  /** The library id — what the preview reports its line count under. */
  id: string;
  value: string;
  onChange: (next: string) => void;
  /** Excluded from this variant: still editable, since wording is library. */
  dimmed?: boolean;
  /** Preview-link handlers, where the field is the row (`preview-link`). */
  hover?: Record<string, unknown>;
  /** Anything the caller wants said beside the line count. */
  note?: ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const lines = useLineCount(id);

  // Height from content: cleared first, because a box already tall enough
  // reports its own height as `scrollHeight` and would never shrink again.
  //
  // The border is added back on. `scrollHeight` is content plus padding, the
  // box is sized border-box, and setting one as the other leaves the field
  // two pixels short of its own text — which is a scrollbar, on every field,
  // which is the thing this control exists to remove.
  const fit = useCallback(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = "auto";
    const border = field.offsetHeight - field.clientHeight;
    field.style.height = `${field.scrollHeight + border}px`;
  }, []);

  // Layout, not effect: the box is measured and resized before the browser
  // paints, so a growing field never shows a scrollbar for one frame.
  useLayoutEffect(fit, [fit, value]);

  // A narrower column wraps the same text to more lines, and no keystroke
  // announces that. The observer watches the field's own box for width
  // changes only — reacting to the height would be reacting to `fit` itself.
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    let width = field.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const next = field.getBoundingClientRect().width;
      if (Math.abs(next - width) < 0.5) return;
      width = next;
      fit();
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [fit]);

  return (
    <div className="w-full">
      <textarea
        className={`${FIELD} ${dimmed ? "text-gray-400" : ""}`}
        data-bullet={id}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (!isItalicShortcut(event)) return;
          // The browser's own Ctrl+I does nothing useful in a textarea, but
          // some hosts bind it; this is the editor's meaning of the key.
          event.preventDefault();
          const field = event.currentTarget;
          const next = toggleItalic(value, field.selectionStart, field.selectionEnd);
          onChange(next.text);
          // After React has written the new value, or the selection would be
          // set on the old string and then clobbered by the re-render.
          requestAnimationFrame(() => field.setSelectionRange(next.start, next.end));
        }}
        ref={ref}
        rows={1}
        value={value}
        {...hover}
      />
      {lines === null && !note ? null : (
        <p className="flex justify-end gap-2 pr-0.5 text-[11px] leading-4 text-gray-400">
          {note}
          {lines === null ? null : (
            <span data-bullet-lines={id} title="Lines this bullet takes in the CV">
              {lines} {lines === 1 ? "line" : "lines"}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
