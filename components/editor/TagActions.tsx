"use client";

/**
 * Tag-driven bulk curation, one row per section (SPEC §6.1, §6.2).
 *
 * Tags are the vocabulary a library is tailored in — "everything tagged
 * `backend`" is the shape of the decision, not "these eleven checkboxes" —
 * and until now they existed only in the library manager. Here each tag in
 * play in this section gets the two actions the decision actually has:
 * include all of it, or drop all of it.
 *
 * Scoped per section rather than offered once for the whole variant. A tag
 * means something different in Experience than in Projects, and the counts
 * only make sense against one list; a global "include everything tagged X"
 * would also reach sections the person is not looking at.
 *
 * The counts are the point of the chip. `3/5` says what the button will do
 * before it does it, and it is why the actions disable themselves at the ends
 * — a button that would change nothing should say so rather than push an
 * empty undo step. It counts both curated levels together, entries and the
 * bullets inside included entries, because that is what the action reaches.
 *
 * The count therefore moves as the section does: a job pulled in brings its
 * tagged bullets into scope, so `2/2` can become `2/7`. That is the honest
 * reading — those bullets genuinely were not on this CV a moment ago.
 */
import { useEditor } from "./EditorStoreProvider";
import { sectionTags } from "./tags";

import type { ContentLibrary } from "@/lib/schema/library";
import type { VariantSection } from "@/lib/schema/variant";

const ACTION =
  "rounded px-1 font-mono text-xs leading-none text-gray-500 hover:bg-white hover:text-gray-900 disabled:cursor-default disabled:text-gray-300 disabled:hover:bg-transparent";

export function TagActions({
  section,
  index,
  library,
}: {
  section: VariantSection;
  index: number;
  library: ContentLibrary;
}) {
  const setTaggedIncluded = useEditor((state) => state.setTaggedIncluded);
  const tags = sectionTags(library, section);

  // Silent where there is nothing to say: a section whose collection carries
  // no tags at all, and every section type that curates no entry list.
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2 text-xs text-gray-500">
      <span>Tags</span>
      {tags.map(({ tag, total, includedCount }) => (
        <span
          className="flex items-center gap-1 rounded bg-blue-50 py-0.5 pl-2 pr-1 text-blue-700"
          data-section-tag={tag}
          key={tag}
        >
          {tag}
          <span className="text-blue-400">
            {includedCount}/{total}
          </span>
          <button
            aria-label={`Include all ${total} tagged ${tag}`}
            className={ACTION}
            data-tag-include={tag}
            disabled={includedCount === total}
            onClick={() => setTaggedIncluded(index, tag, true)}
            title={`Include all ${total} tagged ${tag}`}
            type="button"
          >
            +
          </button>
          <button
            aria-label={`Exclude all ${total} tagged ${tag}`}
            className={ACTION}
            data-tag-exclude={tag}
            disabled={includedCount === 0}
            onClick={() => setTaggedIncluded(index, tag, false)}
            title={`Exclude all ${total} tagged ${tag}`}
            type="button"
          >
            −
          </button>
        </span>
      ))}
    </div>
  );
}
