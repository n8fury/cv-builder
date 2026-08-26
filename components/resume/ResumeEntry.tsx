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
import { linkTarget } from "./link-targets";
import type { BulletOwner } from "@/lib/schema/library";

import type { ResolvedBullet } from "@/lib/data/resolve";
import type { EntryKind } from "@/lib/render/metrics";

/**
 * Which library collection an entry kind's bullets live in, for the editor's
 * in-place editing. Education is absent on purpose: its one bullet is the
 * entry's `description` field rendered as a bullet (§16.4), not a library
 * bullet, so there is nothing for a keystroke on it to write to.
 */
const BULLET_OWNER: Partial<Record<EntryKind, BulletOwner>> = {
  experience: "experience",
  projects: "projects",
};

export function ResumeEntry({
  id,
  kind,
  title,
  subtitle,
  dates,
  location,
  aside,
  bullets,
  children,
}: {
  /** The library entry this renders — what the form's row is keyed by. */
  id: string;
  kind: EntryKind;
  title: string;
  subtitle: ReactNode;
  dates: string;
  location?: string;
  aside?: ReactNode;
  bullets: ResolvedBullet[];
  children?: ReactNode;
}) {
  const owner = BULLET_OWNER[kind];
  return (
    <article className="resume-entry" data-entry-kind={kind} {...linkTarget("entry", id)}>
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
      <ResumeBullets bullets={bullets} source={owner && { owner, entryId: id }} />
    </article>
  );
}
