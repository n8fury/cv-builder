/**
 * Technical Skills — one `**Group:** skill, skill` line per group
 * (SPEC §5.7, §4.5).
 *
 * Curation happens before this component (two-level, §12.3): it renders the
 * groups and skills the resolver already selected, in array order.
 */
import { Fragment } from "react";

import { InlineText } from "./InlineText";
import { ResumeLabeledLine } from "./ResumeLabeledLine";
import { linkTarget } from "./link-targets";

import type { ResolvedSkillGroup } from "@/lib/data/resolve";

const SEPARATOR = ", ";

export function ResumeSkills({ groups }: { groups: ResolvedSkillGroup[] }) {
  return (
    <div className="resume-body">
      {groups.map((group) => (
        <ResumeLabeledLine key={group.id} label={group.label} {...linkTarget("entry", group.id)}>
          {group.skills.map((skill, index) => (
            // As in the competencies run: the separator is a sibling, so a
            // highlighted skill does not drag the comma before it along.
            <Fragment key={skill.id}>
              {index > 0 ? SEPARATOR : ""}
              <span {...linkTarget("bullet", skill.id)}>
                <InlineText text={skill.text} />
              </span>
            </Fragment>
          ))}
        </ResumeLabeledLine>
      ))}
    </div>
  );
}
