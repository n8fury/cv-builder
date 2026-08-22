/** Experience entries (SPEC §5.4). */
import { ResumeEntry } from "./ResumeEntry";

import type { ResolvedExperience } from "@/lib/data/resolve";

export function ResumeExperience({ entries }: { entries: ResolvedExperience[] }) {
  return (
    <>
      {entries.map((entry) => (
        <ResumeEntry
          key={entry.id}
          kind="experience"
          title={entry.title}
          subtitle={entry.company}
          dates={entry.dates}
          location={entry.location}
          bullets={entry.bullets}
        />
      ))}
    </>
  );
}
