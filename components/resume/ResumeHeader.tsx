/**
 * The header block (SPEC §5.1, §15.9).
 *
 *   full     Name / Location | Email | Phone / LinkedIn | GitHub
 *   minimal  Name / Email | LinkedIn | GitHub
 *
 * Both the name and the contact lines are centered. §15.9 calls the name "the
 * only center-aligned element on the page", but the source PDF sets the
 * minimal contact line at x=131.91 — centered, not at the 55pt margin — so the
 * measurement wins, per §16's source-over-assumption rule.
 *
 * Empty fields drop out rather than leaving a stranded separator, and a
 * contact line with nothing in it is not emitted at all: a blank line would
 * still occupy 12pt and push everything below it out of position.
 */
import type { Header } from "@/lib/schema/library";
import type { HeaderMode } from "@/lib/schema/variant";

const CONTACT_SEPARATOR = " | ";

export function contactLines(header: Header, mode: HeaderMode): string[] {
  const lines =
    mode === "full"
      ? [
          [header.location, header.email, header.phone],
          [header.linkedin, header.github],
        ]
      : [[header.email, header.linkedin, header.github]];

  return lines
    .map((fields) => fields.filter((field) => field.trim() !== "").join(CONTACT_SEPARATOR))
    .filter((line) => line !== "");
}

export function ResumeHeader({ header, mode }: { header: Header; mode: HeaderMode }) {
  return (
    <header className="resume-header" data-mode={mode}>
      {/* A div, not an h1: the resume document loads no UA-style reset, and
          h1's default margin and weight would have to be undone anyway. */}
      <div className="resume-name">{header.name}</div>
      {contactLines(header, mode).map((line) => (
        <div className="resume-contact" key={line}>
          {line}
        </div>
      ))}
    </header>
  );
}
