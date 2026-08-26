"use client";

/**
 * Entry- and bullet-level curation and ordering (SPEC §6.2, §7, §12.3).
 *
 * One list, in two parts: what this variant includes, in the variant's own
 * order (§15.3), then what the library also offers, greyed out below. A
 * checkbox is the whole selection model — an entry is in the list or it is
 * not, so nothing here writes a `visible` flag below the section level.
 *
 * Only the included run is draggable, at both levels. The variant's array *is*
 * its list of included items, so an excluded one has no position to move: it
 * sits in library order until it is ticked, and re-including it puts it back
 * where it was rather than at the end. Excluded rows are therefore rendered
 * outside the sortable list entirely, so they cannot become a drop target that
 * silently does nothing.
 *
 * Sections whose entries carry no bullets (Education, §15.7; Certifications;
 * Recommendations) pass no bullet data and get no bullet toggles or handles.
 */
import type { ReactNode } from "react";

import { NEW_BULLET, type NewItemSpec } from "@/lib/data/new-items";
import type { Bullet } from "@/lib/schema/library";

import { useEditor } from "./EditorStoreProvider";
import { NewItemForm } from "./NewItemForm";
import { DragHandle, SortableList, useSortableRow } from "./Sortable";
import { ordered } from "./ordering";
import { useLinkHover } from "./preview-link";
import type { BulletOwner } from "./store";

const TEXTAREA =
  "w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none resize-y";

/** Holds the un-draggable rows in line with the draggable ones. */
function HandleSpacer({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`select-none px-1 text-transparent ${className}`}>
      ⠿
    </span>
  );
}

/** One library entry, plus how this variant currently curates it. */
export interface EntryChoice {
  id: string;
  heading: string;
  subheading: string;
  included: boolean;
  /** Absent for entry-only sections — the difference §15.7 turns on. */
  bullets?: { all: Bullet[]; includedIds: readonly string[]; owner: BulletOwner };
}

interface BulletProps {
  sectionIndex: number;
  entryId: string;
  bullet: Bullet;
  included: boolean;
  owner: BulletOwner;
}

function BulletControls({ sectionIndex, entryId, bullet, included, owner }: BulletProps) {
  const setBulletText = useEditor((state) => state.setBulletText);
  const setBulletIncluded = useEditor((state) => state.setBulletIncluded);

  return (
    <>
      <input
        type="checkbox"
        className="mt-2"
        aria-label={`Include bullet ${bullet.id}`}
        data-bullet-toggle={bullet.id}
        checked={included}
        onChange={(event) =>
          setBulletIncluded(sectionIndex, entryId, bullet.id, event.target.checked)
        }
      />
      {/* Text stays editable either way: wording belongs to the library, not
          to this variant's selection (§11.4). */}
      <textarea
        className={`${TEXTAREA} ${included ? "" : "text-gray-400"}`}
        data-bullet={bullet.id}
        rows={2}
        value={bullet.text}
        onChange={(event) => setBulletText(owner, entryId, bullet.id, event.target.value)}
      />
    </>
  );
}

function SortableBulletRow(props: BulletProps) {
  const { ref, style, dragging, handleProps } = useSortableRow(props.bullet.id);
  const hover = useLinkHover("bullet", props.bullet.id);
  return (
    <div
      ref={ref}
      style={style}
      {...hover}
      className={`flex items-start gap-1 ${dragging ? "bg-white shadow" : ""}`}
    >
      <DragHandle
        className="mt-1.5 text-xs"
        label={`Reorder bullet ${props.bullet.id}`}
        handleProps={handleProps}
      />
      <BulletControls {...props} />
    </div>
  );
}

function StaticBulletRow(props: BulletProps) {
  const hover = useLinkHover("bullet", props.bullet.id);
  return (
    <div className="flex items-start gap-1" {...hover}>
      <HandleSpacer className="mt-1.5 text-xs" />
      <BulletControls {...props} />
    </div>
  );
}

function BulletList({
  sectionIndex,
  entryId,
  bullets,
}: {
  sectionIndex: number;
  entryId: string;
  bullets: NonNullable<EntryChoice["bullets"]>;
}) {
  const moveBullet = useEditor((state) => state.moveBullet);
  const addBullet = useEditor((state) => state.addBullet);

  // Same split as the entries above: the variant's order first, and only that
  // run is draggable.
  const all = ordered(bullets.all, bullets.includedIds);
  const included = all.filter((bullet) => bullets.includedIds.includes(bullet.id));
  const rest = all.filter((bullet) => !bullets.includedIds.includes(bullet.id));

  return (
    <div className="space-y-1 pl-6 pt-1">
      <SortableList
        ids={included.map((bullet) => bullet.id)}
        onMove={(fromId, toId) => moveBullet(sectionIndex, entryId, fromId, toId)}
      >
        <div className="space-y-1">
          {included.map((bullet) => (
            <SortableBulletRow
              key={bullet.id}
              sectionIndex={sectionIndex}
              entryId={entryId}
              bullet={bullet}
              included
              owner={bullets.owner}
            />
          ))}
        </div>
      </SortableList>
      {rest.map((bullet) => (
        <StaticBulletRow
          key={bullet.id}
          sectionIndex={sectionIndex}
          entryId={entryId}
          bullet={bullet}
          included={false}
          owner={bullets.owner}
        />
      ))}
      <NewItemForm
        spec={NEW_BULLET}
        onAdd={(values) => addBullet(sectionIndex, entryId, values)}
      />
    </div>
  );
}

function EntryBody({
  sectionIndex,
  entry,
  handle,
}: {
  sectionIndex: number;
  entry: EntryChoice;
  handle: ReactNode;
}) {
  const setEntryIncluded = useEditor((state) => state.setEntryIncluded);

  return (
    <>
      <label className="flex items-baseline gap-2">
        {handle}
        <input
          type="checkbox"
          data-entry-toggle={entry.id}
          checked={entry.included}
          onChange={(event) => setEntryIncluded(sectionIndex, entry.id, event.target.checked)}
        />
        <span
          className={`text-sm font-medium ${entry.included ? "text-gray-900" : "text-gray-400"}`}
        >
          {entry.heading}
        </span>
      </label>
      {entry.subheading ? <p className="pl-11 text-xs text-gray-500">{entry.subheading}</p> : null}
      {entry.bullets && entry.included ? (
        <BulletList sectionIndex={sectionIndex} entryId={entry.id} bullets={entry.bullets} />
      ) : null}
    </>
  );
}

function SortableEntryRow({ sectionIndex, entry }: { sectionIndex: number; entry: EntryChoice }) {
  const { ref, style, dragging, handleProps } = useSortableRow(entry.id);
  const hover = useLinkHover("entry", entry.id);
  return (
    <div
      ref={ref}
      style={style}
      {...hover}
      data-entry={entry.id}
      className={`space-y-1 px-3 py-2 ${dragging ? "bg-white shadow-lg" : ""}`}
    >
      <EntryBody
        sectionIndex={sectionIndex}
        entry={entry}
        handle={<DragHandle label={`Reorder ${entry.heading}`} handleProps={handleProps} />}
      />
    </div>
  );
}

function StaticEntryRow({ sectionIndex, entry }: { sectionIndex: number; entry: EntryChoice }) {
  const hover = useLinkHover("entry", entry.id);
  return (
    <div data-entry={entry.id} className="space-y-1 px-3 py-2" {...hover}>
      <EntryBody sectionIndex={sectionIndex} entry={entry} handle={<HandleSpacer />} />
    </div>
  );
}

export function EntryCuration({
  sectionIndex,
  entries,
  newEntry,
}: {
  sectionIndex: number;
  entries: EntryChoice[];
  /** What "add" means for this section, if anything (§6.3). */
  newEntry?: NewItemSpec;
}) {
  const moveEntry = useEditor((state) => state.moveEntry);
  const addEntry = useEditor((state) => state.addEntry);
  const included = entries.filter((entry) => entry.included);
  const rest = entries.filter((entry) => !entry.included);

  return (
    <div className="border-t border-gray-100">
      <SortableList
        ids={included.map((entry) => entry.id)}
        onMove={(fromId, toId) => moveEntry(sectionIndex, fromId, toId)}
      >
        <div className="divide-y divide-gray-100">
          {included.map((entry) => (
            <SortableEntryRow key={entry.id} sectionIndex={sectionIndex} entry={entry} />
          ))}
        </div>
      </SortableList>
      {rest.length > 0 ? (
        <div className="divide-y divide-gray-100 border-t border-dashed border-gray-200 bg-gray-50">
          <p className="px-3 pt-2 text-xs font-medium text-gray-500">Not in this variant</p>
          {rest.map((entry) => (
            <StaticEntryRow key={entry.id} sectionIndex={sectionIndex} entry={entry} />
          ))}
        </div>
      ) : null}
      {newEntry ? (
        <NewItemForm
          className="border-t border-gray-100 px-3 py-2"
          spec={newEntry}
          onAdd={(values) => addEntry(sectionIndex, values)}
        />
      ) : null}
    </div>
  );
}
