"use client";

/**
 * Technical Skills, curated at two levels (SPEC §5.7, §12.3).
 *
 * A group is included or not; within an included group, each skill is included
 * or not. Same ID-list pattern as an entry and its bullets, so it goes through
 * the same store actions — but skills are two or three words, not sentences,
 * so they render as a wrapped row of checkboxes rather than a stack of fields.
 */
import type { SkillGroup } from "@/lib/schema/library";

import { useEditor } from "./EditorStoreProvider";

export interface SkillGroupChoice {
  group: SkillGroup;
  included: boolean;
  includedSkillIds: readonly string[];
}

function GroupRow({ sectionIndex, choice }: { sectionIndex: number; choice: SkillGroupChoice }) {
  const setEntryIncluded = useEditor((state) => state.setEntryIncluded);
  const setBulletIncluded = useEditor((state) => state.setBulletIncluded);
  const { group, included, includedSkillIds } = choice;

  return (
    <div className="space-y-1 px-3 py-2">
      <label className="flex items-baseline gap-2">
        <input
          type="checkbox"
          data-entry-toggle={group.id}
          checked={included}
          onChange={(event) => setEntryIncluded(sectionIndex, group.id, event.target.checked)}
        />
        <span className={`text-sm font-medium ${included ? "text-gray-900" : "text-gray-400"}`}>
          {group.label}
        </span>
      </label>
      {included ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pl-6">
          {group.skills.map((skill) => (
            <label key={skill.id} className="flex items-center gap-1 text-xs text-gray-700">
              <input
                type="checkbox"
                data-bullet-toggle={skill.id}
                checked={includedSkillIds.includes(skill.id)}
                onChange={(event) =>
                  setBulletIncluded(sectionIndex, group.id, skill.id, event.target.checked)
                }
              />
              {skill.text}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SkillCuration({
  sectionIndex,
  choices,
}: {
  sectionIndex: number;
  choices: SkillGroupChoice[];
}) {
  const included = choices.filter((choice) => choice.included);
  const rest = choices.filter((choice) => !choice.included);

  return (
    <div className="border-t border-gray-100">
      <div className="divide-y divide-gray-100">
        {included.map((choice) => (
          <GroupRow key={choice.group.id} sectionIndex={sectionIndex} choice={choice} />
        ))}
      </div>
      {rest.length > 0 ? (
        <div className="divide-y divide-gray-100 border-t border-dashed border-gray-200 bg-gray-50">
          <p className="px-3 pt-2 text-xs font-medium text-gray-500">Not in this variant</p>
          {rest.map((choice) => (
            <GroupRow key={choice.group.id} sectionIndex={sectionIndex} choice={choice} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
