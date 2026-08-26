"use client";

/**
 * Technical Skills, curated and ordered at two levels (SPEC §5.7, §7, §12.3).
 *
 * A group is included or not; within an included group, each skill is included
 * or not. Same ID-list pattern as an entry and its bullets, so it goes through
 * the same store actions — but skills are two or three words, not sentences,
 * so they render as a wrapped row of checkboxes rather than a stack of fields.
 *
 * That wrapped row is why skills sort freely on both axes while everything
 * else in the editor is a vertical list: a chip's neighbour may be to its
 * right as easily as below it.
 */
import type { ReactNode } from "react";

import { NEW_ENTRY, NEW_SKILL } from "@/lib/data/new-items";
import type { Skill, SkillGroup } from "@/lib/schema/library";

import { useEditor } from "./EditorStoreProvider";
import { NewItemForm } from "./NewItemForm";
import { DragHandle, SortableList, useSortableRow } from "./Sortable";
import { ordered } from "./ordering";
import { useLinkHover } from "./preview-link";

export interface SkillGroupChoice {
  group: SkillGroup;
  included: boolean;
  includedSkillIds: readonly string[];
}

interface SkillProps {
  sectionIndex: number;
  groupId: string;
  skill: Skill;
  included: boolean;
}

function SkillCheckbox({ sectionIndex, groupId, skill, included }: SkillProps) {
  const setBulletIncluded = useEditor((state) => state.setBulletIncluded);
  const hover = useLinkHover("bullet", skill.id);

  return (
    <label
      {...hover}
      className={`flex items-center gap-1 text-xs ${included ? "text-gray-700" : "text-gray-400"}`}
    >
      <input
        type="checkbox"
        data-bullet-toggle={skill.id}
        checked={included}
        onChange={(event) =>
          setBulletIncluded(sectionIndex, groupId, skill.id, event.target.checked)
        }
      />
      {skill.text}
    </label>
  );
}

function SortableSkill(props: SkillProps) {
  const { ref, style, dragging, handleProps } = useSortableRow(props.skill.id, "wrap");
  return (
    <span
      ref={ref}
      style={style}
      className={`flex items-center gap-0.5 rounded ${dragging ? "bg-white shadow" : ""}`}
    >
      <DragHandle
        className="text-[10px]"
        label={`Reorder skill ${props.skill.id}`}
        handleProps={handleProps}
      />
      <SkillCheckbox {...props} />
    </span>
  );
}

/** Only the included run has a position in the variant, so only it drags. */
function SkillList({
  sectionIndex,
  choice,
  filtering,
}: {
  sectionIndex: number;
  choice: SkillGroupChoice;
  filtering: boolean;
}) {
  const moveBullet = useEditor((state) => state.moveBullet);
  const addBullet = useEditor((state) => state.addBullet);
  const { group, includedSkillIds } = choice;

  const all = ordered(group.skills, includedSkillIds);
  const included = all.filter((skill) => includedSkillIds.includes(skill.id));
  const rest = all.filter((skill) => !includedSkillIds.includes(skill.id));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-11">
      <SortableList
        ids={included.map((skill) => skill.id)}
        layout="wrap"
        onMove={(fromId, toId) => moveBullet(sectionIndex, group.id, fromId, toId)}
      >
        {included.map((skill) => (
          <SortableSkill
            key={skill.id}
            sectionIndex={sectionIndex}
            groupId={group.id}
            skill={skill}
            included
          />
        ))}
      </SortableList>
      {rest.map((skill) => (
        <SkillCheckbox
          key={skill.id}
          sectionIndex={sectionIndex}
          groupId={group.id}
          skill={skill}
          included={false}
        />
      ))}
      {filtering ? null : (
        <NewItemForm
          className="basis-full"
          spec={NEW_SKILL}
          onAdd={(values) => addBullet(sectionIndex, group.id, values)}
        />
      )}
    </div>
  );
}

function GroupBody({
  sectionIndex,
  choice,
  handle,
  filtering,
}: {
  sectionIndex: number;
  choice: SkillGroupChoice;
  handle: ReactNode;
  filtering: boolean;
}) {
  const setEntryIncluded = useEditor((state) => state.setEntryIncluded);
  const { group, included } = choice;

  return (
    <>
      <label className="flex items-baseline gap-2">
        {handle}
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
        <SkillList sectionIndex={sectionIndex} choice={choice} filtering={filtering} />
      ) : null}
    </>
  );
}

function SortableGroupRow({
  sectionIndex,
  choice,
  filtering,
}: {
  sectionIndex: number;
  choice: SkillGroupChoice;
  filtering: boolean;
}) {
  const { ref, style, dragging, handleProps } = useSortableRow(choice.group.id);
  const hover = useLinkHover("entry", choice.group.id);
  return (
    <div
      ref={ref}
      style={style}
      {...hover}
      data-entry={choice.group.id}
      className={`space-y-1 px-3 py-2 ${dragging ? "bg-white shadow-lg" : ""}`}
    >
      <GroupBody
        sectionIndex={sectionIndex}
        choice={choice}
        filtering={filtering}
        handle={
          <DragHandle label={`Reorder ${choice.group.label}`} handleProps={handleProps} />
        }
      />
    </div>
  );
}

function StaticGroupRow({
  sectionIndex,
  choice,
  filtering,
}: {
  sectionIndex: number;
  choice: SkillGroupChoice;
  filtering: boolean;
}) {
  const hover = useLinkHover("entry", choice.group.id);
  return (
    <div data-entry={choice.group.id} className="space-y-1 px-3 py-2" {...hover}>
      <GroupBody
        sectionIndex={sectionIndex}
        choice={choice}
        filtering={filtering}
        handle={
          <span aria-hidden className="select-none px-1 text-transparent">
            ⠿
          </span>
        }
      />
    </div>
  );
}

export function SkillCuration({
  sectionIndex,
  choices,
  filtering = false,
}: {
  sectionIndex: number;
  choices: SkillGroupChoice[];
  /** Whether `choices` is a narrowed view — see `EntryCuration`'s own prop. */
  filtering?: boolean;
}) {
  const moveEntry = useEditor((state) => state.moveEntry);
  const addEntry = useEditor((state) => state.addEntry);
  const included = choices.filter((choice) => choice.included);
  const rest = choices.filter((choice) => !choice.included);

  return (
    <div className="border-t border-gray-100">
      <SortableList
        ids={included.map((choice) => choice.group.id)}
        onMove={(fromId, toId) => moveEntry(sectionIndex, fromId, toId)}
      >
        <div className="divide-y divide-gray-100">
          {included.map((choice) => (
            <SortableGroupRow
              key={choice.group.id}
              sectionIndex={sectionIndex}
              choice={choice}
              filtering={filtering}
            />
          ))}
        </div>
      </SortableList>
      {rest.length > 0 ? (
        <div className="divide-y divide-gray-100 border-t border-dashed border-gray-200 bg-gray-50">
          <p className="px-3 pt-2 text-xs font-medium text-gray-500">Not in this variant</p>
          {rest.map((choice) => (
            <StaticGroupRow
              key={choice.group.id}
              sectionIndex={sectionIndex}
              choice={choice}
              filtering={filtering}
            />
          ))}
        </div>
      ) : null}
      {filtering ? null : (
        <NewItemForm
          className="border-t border-gray-100 px-3 py-2"
          spec={NEW_ENTRY.skills}
          onAdd={(values) => addEntry(sectionIndex, values)}
        />
      )}
    </div>
  );
}
