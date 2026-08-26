"use client";

/**
 * All / None / Invert, one row per curated section (SPEC §6.2, §7).
 *
 * Sits above the list it acts on and below the tag chips, in the same bar:
 * the tags say "everything about backend", these say "everything here". Both
 * are shortcuts through the same per-entry path, and both are one undo step.
 *
 * Each button states its own count, and disables itself when that count is
 * zero. A button that would change nothing should say so rather than push an
 * empty step — and the `2/7` beside them is what makes "All" a promise about
 * five specific rows rather than a leap.
 *
 * Under the form's text filter the counts, and the actions, are of the rows
 * the card is *showing*. A button sitting above a list of three rows that
 * quietly cleared twenty would be offering something other than what it
 * appears to, and the card already says how much it is holding back.
 *
 * Entry level only — a bullet keeps whatever curation it was saved with when
 * its entry comes back (§6.2). See `./bulk` for why forcing bullets here
 * would be a different edit from ticking the box.
 */
import type { ContentLibrary } from "@/lib/schema/library";
import type { VariantSection } from "@/lib/schema/variant";

import { useEditor } from "./EditorStoreProvider";
import { bulkChanges, includedCount, type BulkMode } from "./bulk";
import { sectionCollection } from "./tags";

import type { SectionFilter } from "./filter";

const ACTION =
  "rounded px-1.5 py-0.5 font-medium text-gray-600 hover:bg-white hover:text-gray-900 disabled:cursor-default disabled:text-gray-300 disabled:hover:bg-transparent";

/** What each button promises, given how many rows it would change. */
const PROMISE: Record<BulkMode, (count: number, scope: string) => string> = {
  all: (count, scope) => `Include the ${count} ${scope} not in this variant`,
  none: (count, scope) => `Remove all ${count} included ${scope} from this variant`,
  invert: (count, scope) => `Swap what is in for what is out, across ${count} ${scope}`,
};

const LABEL: Record<BulkMode, string> = { all: "All", none: "None", invert: "Invert" };

export function BulkActions({
  section,
  index,
  library,
  filter,
}: {
  section: VariantSection;
  index: number;
  library: ContentLibrary;
  filter: SectionFilter;
}) {
  const setEntriesIncluded = useEditor((state) => state.setEntriesIncluded);
  const collection = sectionCollection(library, section);

  // Silent where there is no list: About Me and Custom point at one item, the
  // header is one record, and Languages is all-or-nothing (§12.3, §15.6).
  if (collection === null) return null;

  const entryIds = collection
    .filter((item) => filter.entryIds === null || filter.entryIds.has(item.id))
    .map((item) => item.id);
  if (entryIds.length === 0) return null;

  const scope = filter.entryIds === null ? "entries" : "shown entries";

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pb-2 text-xs text-gray-500">
      <span>{filter.entryIds === null ? "Entries" : "Shown"}</span>
      <span className="font-mono text-gray-400">
        {includedCount(section, entryIds)}/{entryIds.length}
      </span>
      {(["all", "none", "invert"] as const).map((mode) => {
        const count = bulkChanges(section, entryIds, mode).length;
        const promise = PROMISE[mode](count, scope);
        return (
          <button
            aria-label={promise}
            className={ACTION}
            data-bulk={mode}
            disabled={count === 0}
            key={mode}
            onClick={() => setEntriesIncluded(index, entryIds, mode)}
            title={promise}
            type="button"
          >
            {LABEL[mode]}
          </button>
        );
      })}
    </div>
  );
}
