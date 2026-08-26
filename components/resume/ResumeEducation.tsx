/**
 * Education entries (SPEC §5.6, §16.2, §16.4).
 *
 * Field order is fixed by the canonical source, not by a per-variant option:
 * institution bold on top, degree in Charis SIL Italic below (§16.2) — the
 * same two-line head Experience and Projects use, so it shares `ResumeEntry`.
 *
 * `description` renders as a **single bullet**, not a paragraph — §16.4
 * corrects §15.7's brainstorming-era assumption against both source
 * documents. Feeding it through `ResumeBullets` as a one-item list is what
 * makes that literal: it inherits the bullet glyph, the hanging indent, and
 * §16.3's inline markup for free.
 *
 * Curation is entry-level only (§5.6): there is no bullet array to trim, so
 * an entry is included or excluded whole.
 */
import { ResumeEntry } from "./ResumeEntry";

import type { ResolvedEducation } from "@/lib/data/resolve";

/** The lone bullet's id, derived — the library item has no id of its own for it. */
export function descriptionBulletId(entryId: string): string {
  return `${entryId}-description`;
}

export function ResumeEducation({ entries }: { entries: ResolvedEducation[] }) {
  return (
    <>
      {entries.map((entry) => (
        <ResumeEntry
          key={entry.id}
          id={entry.id}
          kind="education"
          title={entry.institution}
          subtitle={entry.degree}
          dates={entry.dates}
          bullets={
            entry.description
              ? [{ id: descriptionBulletId(entry.id), text: entry.description }]
              : []
          }
        />
      ))}
    </>
  );
}
