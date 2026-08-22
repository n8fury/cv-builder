/**
 * Languages — one `**Language:** proficiency` line each (SPEC §5.10, §4.5).
 *
 * Not curated per item: the whole library list renders behind the section's
 * `visible` flag alone (§12.3, §15.6), so there is no ID list to resolve.
 */
import { InlineText } from "./InlineText";
import { ResumeLabeledLine } from "./ResumeLabeledLine";

import type { Language } from "@/lib/schema/library";

export function ResumeLanguages({ entries }: { entries: Language[] }) {
  return (
    <div className="resume-body">
      {entries.map((entry) => (
        <ResumeLabeledLine key={entry.id} label={entry.language}>
          <InlineText text={entry.proficiency} />
        </ResumeLabeledLine>
      ))}
    </div>
  );
}
