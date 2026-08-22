/** Project entries (SPEC §5.5). */
import { ResumeEntry } from "./ResumeEntry";
import { ResumeProjectLinks } from "./ResumeProjectLinks";

import type { ResolvedProject } from "@/lib/data/resolve";

export function ResumeProjects({ entries }: { entries: ResolvedProject[] }) {
  return (
    <>
      {entries.map((entry) => (
        <ResumeEntry
          key={entry.id}
          kind="projects"
          title={entry.title}
          subtitle={entry.subtitle}
          dates={entry.dates}
          aside={<ResumeProjectLinks repoUrl={entry.repoUrl} demoUrl={entry.demoUrl} />}
          bullets={entry.bullets}
        />
      ))}
    </>
  );
}
