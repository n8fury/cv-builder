/**
 * An entry with a two-column head and a bullet list (SPEC §4.4, §5.4-§5.6).
 *
 * The head is a flex row: title and company on the left, dates and location
 * flush to the right edge of the content box. The right column is lifted
 * 2.31pt — measured, consistent across both source documents, and beyond
 * §11.2's tolerance, so it is reproduced rather than rounded away (§4.4).
 *
 * `aside` fills the right column's second line for entry kinds that have no
 * location to put there — Projects' repo/demo links (§5.5).
 *
 * Education is the same shape with different words in it: institution for
 * title, degree for subtitle, and its one `description` field rendered as a
 * single bullet (§16.2, §16.4).
 *
 * `break-inside: avoid` keeps an entry's head and bullets together across a
 * page break (§11.5).
 */
import type { ReactNode } from "react";

import { ResumeBullets } from "./ResumeBullets";

import type { ResolvedBullet } from "@/lib/data/resolve";
import type { EntryKind } from "@/lib/render/metrics";

export function ResumeEntry({
  kind,
  title,
  subtitle,
  dates,
  location,
  aside,
  bullets,
  children,
}: {
  kind: EntryKind;
  title: string;
  subtitle: ReactNode;
  dates: string;
  location?: string;
  aside?: ReactNode;
  bullets: ResolvedBullet[];
  children?: ReactNode;
}) {
  return (
    <article className="resume-entry" data-entry={kind}>
      <div className="resume-entry-head">
        <div className="resume-entry-left">
          <div className="resume-entry-title">{title}</div>
          <div className="resume-entry-subtitle">{subtitle}</div>
        </div>
        <div className="resume-entry-right">
          <div className="resume-entry-dates">{dates}</div>
          {location === undefined ? null : (
            <div className="resume-entry-location">{location}</div>
          )}
          {aside}
        </div>
      </div>
      {children}
      <ResumeBullets bullets={bullets} />
    </article>
  );
}
