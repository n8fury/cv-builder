/**
 * Editing the header block (SPEC §5.1, §7's library manager, §16.6).
 *
 * The header is the one part of `content-library.json` the item machinery in
 * `library-edit.ts` cannot reach. Everything there is addressed by ID and
 * lives in a collection; the header is a single record with neither, so
 * `mapLibraryItems` never visits it, `findOrphans` has nothing to say about it,
 * and Fork and Delete are meaningless on it. That is why it gets a module of
 * its own rather than a special case threaded through all four operations.
 *
 * Extra contact links *are* a list, and they do carry IDs — but only so a form
 * can address one row. No variant references them (§16.6), so they are edited
 * here with the rest of the header rather than as library items. Each also
 * carries the URL its text points at (§18.1), which is stored rather than
 * derived because nothing about "portfolio.example.com" says where it lives.
 *
 * Like every edit in `library-edit.ts`, these are pure functions: the result is
 * re-parsed through the schema before it is returned, so a change that would
 * produce an unwritable library fails here rather than at the store.
 */
import { contentLibrarySchema, headerSchema, type ContentLibrary } from "../schema/library";
import { randomSuffix } from "./ids";
import { InvalidEditError } from "./library-edit";

/**
 * One editable field on the header, in the order the manager shows them.
 *
 * Held against `headerSchema` by `header-edit.test.ts` for the same reason
 * `ITEM_FIELDS` is held against the item schemas: a field on the header that
 * no screen can reach would be stored, rendered, and impossible to change.
 * `links` is excluded because it is a list with its own controls, not a box.
 */
export const HEADER_FIELDS = [
  { name: "name", label: "Name" },
  { name: "title", label: "Title" },
  { name: "location", label: "Location" },
  { name: "email", label: "Email" },
  { name: "phone", label: "Phone" },
  { name: "linkedin", label: "LinkedIn" },
  { name: "github", label: "GitHub" },
] as const;

/** Header keys the field list deliberately does not offer. */
export const EXCLUDED_HEADER_FIELDS = ["links"] as const;

export type HeaderFieldName = (typeof HEADER_FIELDS)[number]["name"];

/** ID prefix for an extra contact link. */
const LINK_PREFIX = "link";

/**
 * A fresh link ID. Separate from `generateId` in `ids.ts`: that function's
 * `IdKind` is the set of kinds the library manager creates, indexes and forks,
 * and a link is none of those — adding it there would oblige every one of
 * those tables to carry an entry it has no use for.
 */
export function generateLinkId(taken: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const id = `${LINK_PREFIX}-${randomSuffix()}`;
    if (!taken.has(id)) return id;
  }
  throw new Error(`Could not generate a unique ${LINK_PREFIX} id after 50 attempts`);
}

function reparse(library: ContentLibrary, header: unknown): ContentLibrary {
  const parsed = contentLibrarySchema.safeParse({ ...library, header });
  if (!parsed.success) throw new InvalidEditError(parsed.error.message);
  return parsed.data;
}

/**
 * Applies form values to the header's fields.
 *
 * Only the fields `HEADER_FIELDS` declares are written, so a stray key in the
 * payload cannot introduce one the schema would reject — and an absent key
 * leaves its field alone rather than blanking it, which is what lets the links
 * form post without carrying every text box along with it.
 *
 * Values are trimmed. Every one of these prints inside a pipe-separated
 * contact line, where a stray space is invisible on screen and shifts a
 * centered line on the page.
 */
export function updateHeaderFields(
  library: ContentLibrary,
  values: Partial<Record<HeaderFieldName, string>>,
): ContentLibrary {
  const header: Record<string, unknown> = { ...library.header };
  for (const field of HEADER_FIELDS) {
    const value = values[field.name];
    if (value === undefined) continue;
    header[field.name] = value.trim();
  }
  return reparse(library, header);
}

/**
 * A typed link target, in the shape `headerLinkSchema` will accept (§18.1).
 *
 * Blank is `null` — the link then prints as text, which is what every link
 * already on disk does. A scheme is added when there is none, because
 * "portfolio.example.com" is what a person types into a box labelled URL and
 * `z.url()` rejects it; that one prefix is the whole of the leniency here.
 * Anything still malformed is passed through unchanged rather than quietly
 * dropped, so the schema refuses it and the form says so — silently discarding
 * a URL someone typed is the one outcome worse than an error.
 */
export function normalizeLinkUrl(input: string | null | undefined): string | null {
  const url = (input ?? "").trim();
  if (url === "") return null;
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
}

/**
 * Replaces the extra contact links, in the order given (§16.6, §18.1).
 *
 * Blank rows are dropped rather than stored: they render nothing — the header
 * filters empty fields out of the contact line — so keeping them would leave
 * the manager showing rows that cannot appear on any CV. A blank *url* does
 * not drop the row: text with no target is a valid link line, and was the only
 * kind that existed before §18.1. Existing IDs are preserved, and a row
 * arriving without one is given a fresh ID here.
 */
export function setHeaderLinks(
  library: ContentLibrary,
  links: readonly { id?: string; text: string; url?: string | null }[],
): ContentLibrary {
  const taken = new Set(library.header.links.map((link) => link.id));
  const next: { id: string; text: string; url: string | null }[] = [];

  for (const link of links) {
    const text = link.text.trim();
    if (text === "") continue;
    const id = link.id && link.id.trim() !== "" ? link.id.trim() : generateLinkId(taken);
    taken.add(id);
    next.push({ id, text, url: normalizeLinkUrl(link.url) });
  }

  return reparse(library, { ...library.header, links: next });
}

/** The header as a plain field/value list, for the manager's form. */
export function headerFieldValues(
  library: ContentLibrary,
): { name: HeaderFieldName; label: string; value: string }[] {
  const header = headerSchema.parse(library.header);
  return HEADER_FIELDS.map((field) => ({
    name: field.name,
    label: field.label,
    value: header[field.name],
  }));
}
