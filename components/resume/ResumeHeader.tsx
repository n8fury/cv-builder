/**
 * The header block (SPEC §5.1, §15.9, §16.6).
 *
 *   full     Name / [Title] / Location | Email | Phone / LinkedIn | GitHub | …links
 *   minimal  Name / [Title] / Email | LinkedIn | GitHub | …links
 *
 * Both the name and the contact lines are centered. §15.9 calls the name "the
 * only center-aligned element on the page", but the source PDF sets the
 * minimal contact line at x=131.91 — centered, not at the 55pt margin — so the
 * measurement wins, per §16's source-over-assumption rule.
 *
 * Empty fields drop out rather than leaving a stranded separator, and a
 * contact line with nothing in it is not emitted at all: a blank line would
 * still occupy 12pt and push everything below it out of position.
 *
 * The title is content the variant switches on (§16.6), so it takes both — and
 * a variant asking for a title the library has not been given renders no line
 * rather than an empty one, for exactly the reason above.
 */
import type { Header } from "@/lib/schema/library";
import type { HeaderMode } from "@/lib/schema/variant";

const CONTACT_SEPARATOR = " | ";

export function contactLines(header: Header, mode: HeaderMode): string[] {
  // Extra links ride the same line as LinkedIn and GitHub, in library order:
  // they are more of the same thing, and a line of their own would cost 17.07pt
  // that the header slot has not got (§16.6).
  const links = header.links.map((link) => link.text);

  const lines =
    mode === "full"
      ? [
          [header.location, header.email, header.phone],
          [header.linkedin, header.github, ...links],
        ]
      : [[header.email, header.linkedin, header.github, ...links]];

  return lines
    .map((fields) => fields.filter((field) => field.trim() !== "").join(CONTACT_SEPARATOR))
    .filter((line) => line !== "");
}

/** The title line, or null when there is nothing to print (§16.6). */
export function titleLine(header: Header, showTitle: boolean): string | null {
  if (!showTitle) return null;
  const title = header.title.trim();
  return title === "" ? null : title;
}

export function ResumeHeader({
  header,
  mode,
  showTitle,
}: {
  header: Header;
  mode: HeaderMode;
  showTitle: boolean;
}) {
  const title = titleLine(header, showTitle);

  return (
    // data-title carries whether a title actually printed, not whether one was
    // asked for: it selects About Me's space-before (§4.2), and a variant that
    // wants a title the library lacks must not open a gap for a line that is
    // not there. Always present, never omitted — resume.css names both states,
    // so an absent attribute would match no rule at all.
    <header className="resume-header" data-mode={mode} data-title={title !== null}>
      {/* A div, not an h1: the resume document loads no UA-style reset, and
          h1's default margin and weight would have to be undone anyway. */}
      <div className="resume-name">{header.name}</div>
      {title === null ? null : <div className="resume-title">{title}</div>}
      {contactLines(header, mode).map((line) => (
        <div className="resume-contact" key={line}>
          {line}
        </div>
      ))}
    </header>
  );
}
