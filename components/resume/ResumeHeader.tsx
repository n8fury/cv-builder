/**
 * The header block (SPEC §5.1, §15.9, §16.6, §18.1).
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
 *
 * Contact details are live links (§18.1). Only the href is new: the same
 * characters print in the same order at the same positions, so every §4.1
 * metric and §11.2's golden are untouched.
 */
import type { Header } from "@/lib/schema/library";
import type { HeaderMode } from "@/lib/schema/variant";

const CONTACT_SEPARATOR = " | ";

/** One printed field on a contact line, with what it points at (§18.1). */
export interface ContactField {
  text: string;
  /** `null` when the text yields no target — it then renders as plain text. */
  href: string | null;
}

/** Profile prefixes for the two named socials, used only on a bare handle. */
const HANDLE_PREFIX = {
  linkedin: "https://linkedin.com/in/",
  github: "https://github.com/",
} as const;

/**
 * `jordan.rivera@example.com` → `mailto:jordan.rivera@example.com`.
 *
 * Deliberately loose: this is a display string the person typed, not a
 * validated field, and the test is only "is this addressable" — one `@` with
 * something either side and no spaces. Anything else prints as text, which is
 * what it did before this existed.
 */
function emailHref(text: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? `mailto:${text}` : null;
}

/**
 * `+1-555-0142` → `tel:+15550142`.
 *
 * `tel:` takes no spaces, dashes or brackets, so they come out — the printed
 * text keeps every one of them. A leading `+` survives because it is the
 * difference between an international number and a local one. Fewer than seven
 * digits is not a phone number worth handing to a dialler.
 */
function phoneHref(text: string): string | null {
  const digits = text.replace(/[^\d]/g, "");
  if (digits.length < 7) return null;
  return `tel:${text.trimStart().startsWith("+") ? "+" : ""}${digits}`;
}

/**
 * `github.com/jordan-rivera-demo` → `https://github.com/jordan-rivera-demo`; `jordan-rivera-demo` →
 * `https://github.com/jordan-rivera-demo`.
 *
 * Two shapes because both are typed in practice. A text carrying a dot or a
 * slash is already a URL missing its scheme, so it only needs the scheme; a
 * bare handle is not recoverable as one and gets the site's profile prefix.
 * Whitespace means it is prose, not an address — LinkedIn's own display form
 * for a person with no vanity URL — so it links to nothing.
 */
function socialHref(site: keyof typeof HANDLE_PREFIX, text: string): string | null {
  if (/\s/.test(text)) return null;
  if (/^https?:\/\//i.test(text)) return text;
  return /[./]/.test(text) ? `https://${text}` : `${HANDLE_PREFIX[site]}${text}`;
}

/**
 * The contact lines as printed fields, each with its href (§18.1).
 *
 * The separators live between the fields rather than inside them, so no `|`
 * ever falls inside a link — an anchor that swallowed the separator would put
 * a clickable gap between two unrelated addresses.
 */
export function contactFields(header: Header, mode: HeaderMode): ContactField[][] {
  const field = (text: string, href: string | null): ContactField => ({ text, href });

  const location = field(header.location, null);
  const email = field(header.email, emailHref(header.email.trim()));
  const phone = field(header.phone, phoneHref(header.phone));
  const linkedin = field(header.linkedin, socialHref("linkedin", header.linkedin.trim()));
  const github = field(header.github, socialHref("github", header.github.trim()));

  // Extra links ride the same line as LinkedIn and GitHub, in library order:
  // they are more of the same thing, and a line of their own would cost 17.07pt
  // that the header slot has not got (§16.6). Their target is stored, not
  // derived — there is no site to derive it from (§18.1).
  const links = header.links.map((link) => field(link.text, link.url));

  const lines =
    mode === "full"
      ? [
          [location, email, phone],
          [linkedin, github, ...links],
        ]
      : [[email, linkedin, github, ...links]];

  return lines
    .map((fields) => fields.filter((entry) => entry.text.trim() !== ""))
    .filter((fields) => fields.length > 0);
}

/**
 * The same lines as plain strings — what actually prints.
 *
 * Kept as the definition of the printed text so a test can hold the rendered
 * anchors against it: §18.1 turns on the printed characters being unchanged,
 * and one function producing them is how that stays checkable.
 */
export function contactLines(header: Header, mode: HeaderMode): string[] {
  return contactFields(header, mode).map((fields) =>
    fields.map((entry) => entry.text).join(CONTACT_SEPARATOR),
  );
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
      {contactFields(header, mode).map((fields, lineIndex) => (
        <div className="resume-contact" key={fields.map((entry) => entry.text).join("|")}>
          {fields.map((entry, index) => (
            <span key={`${lineIndex}-${index}-${entry.text}`}>
              {index === 0 ? null : CONTACT_SEPARATOR}
              {entry.href === null ? (
                entry.text
              ) : (
                <a className="resume-contact-link" href={entry.href}>
                  {entry.text}
                </a>
              )}
            </span>
          ))}
        </div>
      ))}
    </header>
  );
}
