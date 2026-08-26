"use client";

/**
 * The filter box at the head of the editor's form (SPEC §7).
 *
 * One box over the whole column rather than one per section: the question it
 * answers — "where did I write about Kubernetes" — is not asked of a section,
 * and a per-section box would have to be found first, which is the problem.
 *
 * It is deliberately not a search *result list*. The rows stay where they are,
 * in their sections, in the variant's own order (§15.3), with their checkboxes
 * and their fields; the column simply gets shorter. Everything a person knows
 * how to do to a row still works while the filter is on, because it is the
 * same row.
 *
 * The count is stated even when nothing is hidden, and especially when
 * everything is: a filter that empties the column has to say that it did, or
 * it reads as a library that has lost its contents.
 *
 * `/` puts the cursor here from anywhere on the page — but only from outside a
 * text field, where the slash was a command rather than a character being
 * typed (`shortcuts.ts`). The key is printed in the box while it is empty,
 * because a shortcut nobody can see is a shortcut nobody uses, and it steps
 * aside for Clear once there is something to clear.
 */
import { useRef } from "react";

import { useShortcut } from "./shortcuts";

const FIELD =
  "w-full rounded border border-gray-300 py-1 pl-7 pr-16 text-sm text-gray-900 focus:border-gray-500 focus:outline-none";

export function FilterBox({
  value,
  onChange,
  shown,
  total,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Sections surviving the filter, and how many there are in all. */
  shown: number;
  total: number;
}) {
  const active = value.trim() !== "";
  const field = useRef<HTMLInputElement | null>(null);

  // Select rather than merely focus: `/` on a box that already reads
  // "kubernetes" is the start of a new question, and the old one goes when the
  // next character lands — while Escape still puts it back.
  useShortcut("focusFilter", () => field.current?.select());

  return (
    <section className="space-y-1">
      <div className="relative">
        <span aria-hidden className="absolute left-2 top-1.5 text-sm text-gray-400">
          ⌕
        </span>
        <input
          aria-label="Filter the form"
          className={FIELD}
          data-filter
          name="filter"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Filter entries, bullets and tags"
          ref={field}
          type="search"
          value={value}
        />
        {active ? (
          <button
            className="absolute right-1.5 top-1 rounded px-2 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            data-filter-clear
            onClick={() => onChange("")}
            type="button"
          >
            Clear
          </button>
        ) : (
          <kbd
            aria-hidden
            className="absolute right-2 top-1.5 rounded border border-gray-200 px-1 font-mono text-[10px] leading-4 text-gray-400"
          >
            /
          </kbd>
        )}
      </div>

      {active ? (
        <p className="text-xs text-gray-500" data-filter-count>
          {shown === 0 ? (
            <span className="text-amber-700">
              Nothing matches — clear the filter to get the form back.
            </span>
          ) : (
            <>
              {shown} of {total} sections. Filtering hides rows; it changes nothing in the
              CV.
            </>
          )}
        </p>
      ) : null}
    </section>
  );
}
