"use client";

/**
 * The editor's left column (SPEC §7, §12.5).
 *
 * The variant's own identity — its tag and label — above the section list the
 * curation controls hang off. Every field writes to the draft in the store,
 * which is what the preview and Save both read; nothing here calls the server.
 *
 * The section list is draggable: a section's position in this array *is* its
 * position in the CV (§15.3), so reordering here rewrites nothing but the
 * array itself.
 *
 * Above the list, the jump rail (`SectionRail`): one chip per card, sticky at
 * the top of the column, because the cards never collapse and the column is
 * therefore long. Its measured height is published to the cards as
 * `--rail-top`, which is where their own sticky headers stop and where a jump
 * lands them.
 *
 * The filter box below it narrows what the list shows (`filter.ts`). The term
 * is React state, not store state: filtering is a way of looking at the draft,
 * so it must not make the draft dirty, must not push an undo step, and must
 * not survive into the file. The variant's own tag and label sit outside it —
 * they are this document's identity, not content to search.
 */
import { useCallback, useMemo, useState, type CSSProperties } from "react";

import { NEW_ENTRY } from "@/lib/data/new-items";

import { FilterBox } from "./FilterBox";
import { useEditor } from "./EditorStoreProvider";
import { NewItemForm } from "./NewItemForm";
import { SectionCard } from "./SectionCard";
import { SectionRail } from "./SectionRail";
import { SortableList } from "./Sortable";
import { filterTerms, matchSections } from "./filter";
import { sectionKeys } from "./ordering";
import { railItems, sectionDomId } from "./rail";

const FIELD =
  "w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none";

export function VariantForm() {
  const tag = useEditor((state) => state.draft.variant.tag);
  const label = useEditor((state) => state.draft.variant.label);
  const sections = useEditor((state) => state.draft.variant.sections);
  const library = useEditor((state) => state.draft.library);
  const setTag = useEditor((state) => state.setTag);
  const setLabel = useEditor((state) => state.setLabel);
  const moveSection = useEditor((state) => state.moveSection);
  const addCustomSection = useEditor((state) => state.addCustomSection);

  const [term, setTerm] = useState("");
  // The rail's measured height, published to the cards below as `--rail-top`
  // so their sticky headers stop at the rail rather than under it, and a jump
  // lands the card clear of it. Stable callback: it is a ResizeObserver's
  // effect dependency, and a new function each render would rebind the
  // observer on every keystroke.
  const [railHeight, setRailHeight] = useState(0);
  const onRailHeight = useCallback((px: number) => setRailHeight(px), []);

  // Keyed by type-and-occurrence rather than by index: an index changes under
  // the very drag that uses it, and would remount every row below the drop.
  const keys = sectionKeys(sections);

  // Recomputed per keystroke over the whole library, which is a few hundred
  // short strings — cheap enough that a debounce would only add lag between
  // the letter and the list.
  const matches = useMemo(
    () => matchSections(library, sections, filterTerms(term)),
    [library, sections, term],
  );
  const filtering = term.trim() !== "";
  const shown = sections
    .map((section, index) => ({ section, index }))
    .filter(({ index }) => matches[index] !== null);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => event.preventDefault()}
      style={{ "--rail-top": `${railHeight}px` } as CSSProperties}
    >
      {/* Above the filter box, and sticky: it names the sections rather than
          searching them, and it is the one control that must stay reachable
          from the bottom of a five-screen column. */}
      <SectionRail
        items={railItems(shown, keys, library)}
        onHeight={onRailHeight}
      />

      <FilterBox
        onChange={setTerm}
        shown={shown.length}
        total={sections.length}
        value={term}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Variant</h2>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">Tag</span>
          <input
            className={FIELD}
            name="tag"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">Label</span>
          <input
            className={FIELD}
            name="label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">
          Sections{" "}
          <span className="font-normal text-gray-500">
            ({filtering ? `${shown.length}/${sections.length}` : sections.length})
          </span>
        </h2>
        {sections.length === 0 ? (
          <p className="text-sm text-gray-500">This variant has no sections.</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-gray-500">No section matches “{term.trim()}”.</p>
        ) : (
          // Dragging keeps working while filtered. Every move is addressed by
          // a pair of IDs resolved against the *full* array (`moveSection`
          // below, `movedIds` beneath the other two levels), so dropping one
          // visible card onto another puts it exactly where the screen says —
          // the hidden cards in between keep their own relative order.
          <SortableList
            ids={shown.map(({ index }) => keys[index])}
            onMove={(fromId, toId) => moveSection(keys.indexOf(fromId), keys.indexOf(toId))}
          >
            <ul className="divide-y divide-gray-100 rounded border border-gray-200">
              {shown.map(({ section, index }) => (
                <SectionCard
                  domId={sectionDomId(keys[index])}
                  key={keys[index]}
                  sortId={keys[index]}
                  section={section}
                  index={index}
                  library={library}
                  filter={matches[index]!}
                />
              ))}
            </ul>
          </SortableList>
        )}

        {/* The one section type a person invents (§12.4). It is added to the
            variant here rather than inside an existing card, because a second
            custom section is a second *section*, not a second pointer on the
            first one — and it lands at the end, where the drag handles take
            over (§15.3).

            Withdrawn while the filter is on, as every other Add is: a new
            item is empty, an empty item matches no term, so adding one here
            would create something and then immediately hide it. */}
        {filtering ? null : <NewItemForm spec={NEW_ENTRY.custom} onAdd={addCustomSection} />}
      </section>
    </form>
  );
}
