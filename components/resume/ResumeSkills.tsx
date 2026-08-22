/**
 * Technical Skills — one `**Group:** skill, skill` line per group
 * (SPEC §5.7, §4.5).
 *
 * Curation happens before this component (two-level, §12.3): it renders the
 * groups and skills the resolver already selected, in array order.
 */
import { InlineText } from "./InlineText";
import { ResumeLabeledLine } from "./ResumeLabeledLine";

import type { ResolvedSkillGroup } from "@/lib/data/resolve";

const SEPARATOR = ", ";

export function ResumeSkills({ groups }: { groups: ResolvedSkillGroup[] }) {
  return (
    <div className="resume-body">
      {groups.map((group) => (
        <ResumeLabeledLine key={group.id} label={group.label}>
          {group.skills.map((skill, index) => (
            <span key={skill.id}>
              {index > 0 ? SEPARATOR : ""}
              <InlineText text={skill.text} />
            </span>
          ))}
        </ResumeLabeledLine>
      ))}
    </div>
  );
}
