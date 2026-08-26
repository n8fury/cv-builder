/**
 * Certifications — one bold line each, dates right-aligned (SPEC §5.8, §4.5).
 *
 * `text` is one combined string (`Career Development Program | Northwind
 * Training Center`), not a title/issuer pair: §5.8 corrects the earlier split-field
 * draft, and the issuer carries no styling of its own. The whole line is
 * bold, dates included, at 13pt leading.
 *
 * `credentialUrl` renders whenever present, with no toggle (§6.4). It sits
 * inline after the text, on the same " | " separator the text itself already
 * uses, so a certification stays one line. It is left roman rather than bold
 * so the link reads as a reference and not as part of the title — the source
 * sets no credential URL, so nothing here is measured.
 */
import { InlineText } from "./InlineText";
import { linkLabel } from "./ResumeProjectLinks";
import { linkTarget } from "./link-targets";

import type { Certification } from "@/lib/schema/library";

const SEPARATOR = " | ";

export function ResumeCertifications({ entries }: { entries: Certification[] }) {
  return (
    <div className="resume-body">
      {entries.map((entry) => (
        <div className="resume-certification" key={entry.id} {...linkTarget("entry", entry.id)}>
          <span className="resume-certification-text">
            <InlineText text={entry.text} />
            {entry.credentialUrl === null ? null : (
              <>
                {SEPARATOR}
                <a className="resume-link resume-credential" href={entry.credentialUrl}>
                  {linkLabel(entry.credentialUrl)}
                </a>
              </>
            )}
          </span>
          <span className="resume-certification-dates">{entry.dates}</span>
        </div>
      ))}
    </div>
  );
}
