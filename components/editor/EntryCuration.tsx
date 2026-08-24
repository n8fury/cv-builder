"use client";

/**
 * Entry- and bullet-level curation (SPEC §6.2, §12.3).
 *
 * One list, in two parts: what this variant includes, in the variant's own
 * order (§15.3), then what the library also offers, greyed out below. A
 * checkbox is the whole model — an entry is in the list or it is not, so
 * nothing here writes a `visible` flag below the section level.
 *
 * Sections whose entries carry no bullets (Education, §15.7; Certifications;
 * Recommendations) pass no bullet data and get no bullet toggles.
 */
import type { Bullet } from "@/lib/schema/library";

import { useEditor } from "./EditorStoreProvider";
import type { BulletOwner } from "./store";

const TEXTAREA =
  "w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none resize-y";

/** One library entry, plus how this variant currently curates it. */
export interface EntryChoice {
  id: string;
  heading: string;
  subheading: string;
  included: boolean;
  /** Absent for entry-only sections — the difference §15.7 turns on. */
  bullets?: { all: Bullet[]; includedIds: readonly string[]; owner: BulletOwner };
}

function BulletRow({
  sectionIndex,
  entryId,
  bullet,
  included,
  owner,
}: {
  sectionIndex: number;
  entryId: string;
  bullet: Bullet;
  included: boolean;
  owner: BulletOwner;
}) {
  const setBulletText = useEditor((state) => state.setBulletText);
  const setBulletIncluded = useEditor((state) => state.setBulletIncluded);

  return (
    <div className="flex items-start gap-2">
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
    </div>
  );
}

function EntryRow({ sectionIndex, entry }: { sectionIndex: number; entry: EntryChoice }) {
  const setEntryIncluded = useEditor((state) => state.setEntryIncluded);
  const bullets = entry.bullets;

  return (
    <div className="space-y-1 px-3 py-2">
      <label className="flex items-baseline gap-2">
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
      {entry.subheading ? <p className="pl-6 text-xs text-gray-500">{entry.subheading}</p> : null}
      {bullets && entry.included ? (
        <div className="space-y-1 pl-6 pt-1">
          {bullets.all.map((bullet) => (
            <BulletRow
              key={bullet.id}
              sectionIndex={sectionIndex}
              entryId={entry.id}
              bullet={bullet}
              included={bullets.includedIds.includes(bullet.id)}
              owner={bullets.owner}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EntryCuration({
  sectionIndex,
  entries,
}: {
  sectionIndex: number;
  entries: EntryChoice[];
}) {
  const included = entries.filter((entry) => entry.included);
  const rest = entries.filter((entry) => !entry.included);

  return (
    <div className="border-t border-gray-100">
      <div className="divide-y divide-gray-100">
        {included.map((entry) => (
          <EntryRow key={entry.id} sectionIndex={sectionIndex} entry={entry} />
        ))}
      </div>
      {rest.length > 0 ? (
        <div className="divide-y divide-gray-100 border-t border-dashed border-gray-200 bg-gray-50">
          <p className="px-3 pt-2 text-xs font-medium text-gray-500">Not in this variant</p>
          {rest.map((entry) => (
            <EntryRow key={entry.id} sectionIndex={sectionIndex} entry={entry} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
