/**
 * A text filter over the editor's whole left column (SPEC §7, §6.1).
 *
 * The form lists everything the library holds — every job, every bullet, every
 * skill, whether or not this variant includes it — because curation is choosing
 * from all of it (§6.2). On a real profile that is a very long column, and
 * finding the one bullet worth rewording means scrolling past forty that are
 * not. This narrows it to what a term names.
 *
 * Nothing here writes. A filter is a way of looking at the draft, not an edit
 * to it: no store action, no undo step, no dirty flag, and clearing the box
 * leaves curation exactly as it was. That is also why the term lives in React
 * state in the form rather than in the store — a draft that remembered how it
 * had been searched would be a draft that differed from the file over nothing.
 *
 * **What is searched.** Every string field of the item, plus its `tags` and its
 * `id`. The fields are walked generically rather than listed per collection:
 * a library item is a flat record of strings, and a new field that no search
 * could reach would be a field the person cannot find their own writing by.
 * Tags are in because §6.1 makes them the vocabulary tailoring is done in, and
 * the ID is in because that is what a §13 "not in the library" message names.
 *
 * **A bullet inherits its entry's text.** A bullet matches on its own text
 * *plus its parent's*, so "acme api" finds the API bullets of the job at Acme
 * — which is how a scoped search reads, and is not something either level can
 * answer alone. Terms are AND-ed; each must appear somewhere.
 *
 * **A parent whose child matched is kept**, showing only the children that
 * matched — the rule the library manager's tag filter already settled (§7).
 * A parent that matched on its own keeps all of its children, because the
 * match was the job, not one sentence in it.
 *
 * **Sections that curate no list** — the header, About Me, Languages, a custom
 * section (§12.3, §12.4, §15.6) — are all-or-nothing: their content is fields,
 * not a list to narrow, so the card is either shown whole or not shown.
 */
import { SECTION_TITLE } from "@/lib/render/section-titles";
import type { ContentLibrary } from "@/lib/schema/library";
import type { VariantSection } from "@/lib/schema/variant";

import { childrenOf, sectionCollection } from "./tags";

/**
 * What one section shows under the filter. `null` on either level means "no
 * narrowing here" — every entry, every bullet — which is what an unfiltered
 * column and a section matched by its own name both produce.
 */
export interface SectionFilter {
  entryIds: ReadonlySet<string> | null;
  bulletIds: ReadonlySet<string> | null;
}

/** The whole section, unnarrowed. */
export const SHOW_ALL: SectionFilter = { entryIds: null, bulletIds: null };

/**
 * The terms a filter box's contents stand for: lowercased, whitespace-split,
 * all of which must appear. An empty or blank box is no filter at all.
 */
export function filterTerms(term: string): string[] {
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "");
}

function matchesAll(haystack: string, terms: readonly string[]): boolean {
  const text = haystack.toLowerCase();
  return terms.every((term) => text.includes(term));
}

/**
 * Every string an item carries in its own right — its own fields plus `tags`.
 *
 * Nested object arrays (an entry's bullets, a group's skills) are skipped:
 * they are separately curated items with their own row in the form, and
 * folding their text into their parent's would make an entry match every term
 * any one of its bullets happens to contain.
 */
function ownText(item: object): string {
  const parts: string[] = [];
  for (const value of Object.values(item)) {
    if (typeof value === "string") {
      parts.push(value);
    } else if (Array.isArray(value)) {
      for (const element of value) if (typeof element === "string") parts.push(element);
    }
  }
  return parts.join(" ");
}

/** What the card is called on screen, so a term can name a section outright. */
function sectionLabel(library: ContentLibrary, section: VariantSection): string {
  if (section.type === "header") return "Header header";
  if (section.type === "custom") {
    const found = library.customSections.find(
      (item) => item.id === section.options.customSectionId,
    );
    return `${found?.title ?? "Custom section"} custom`;
  }
  return `${SECTION_TITLE[section.type]} ${section.type}`;
}

/** The searchable content of a section that curates no list of its own. */
function staticText(library: ContentLibrary, section: VariantSection): string {
  switch (section.type) {
    case "header":
      return [ownText(library.header), ...library.header.links.map(ownText)].join(" ");
    case "aboutMe": {
      const found = library.aboutMe.find((item) => item.id === section.options.aboutMeId);
      return found ? ownText(found) : "";
    }
    case "languages":
      return library.languages.map(ownText).join(" ");
    case "custom": {
      const found = library.customSections.find(
        (item) => item.id === section.options.customSectionId,
      );
      return found ? [ownText(found), ...found.bullets.map(ownText)].join(" ") : "";
    }
    default:
      return "";
  }
}

/**
 * How one section reads under one term — or `null` if nothing in it matches,
 * which is the card being dropped from the column entirely.
 *
 * Scoped to the library's content rather than to what the variant includes:
 * the point of the column is that excluded entries are visible to be picked
 * up, and a filter that searched only what is already on the CV could not help
 * anyone add anything to it.
 */
export function matchSection(
  library: ContentLibrary,
  section: VariantSection,
  terms: readonly string[],
): SectionFilter | null {
  if (terms.length === 0) return SHOW_ALL;
  if (matchesAll(sectionLabel(library, section), terms)) return SHOW_ALL;

  const collection = sectionCollection(library, section);
  if (collection === null) {
    return matchesAll(staticText(library, section), terms) ? SHOW_ALL : null;
  }

  const entryIds = new Set<string>();
  const bulletIds = new Set<string>();

  for (const item of collection) {
    const own = ownText(item);
    if (matchesAll(own, terms)) {
      entryIds.add(item.id);
      for (const child of childrenOf(item)) bulletIds.add(child.id);
      continue;
    }
    // The parent's text is in scope for its children, so a term naming the job
    // and a term naming the sentence can be typed together.
    let matched = false;
    for (const child of childrenOf(item)) {
      if (matchesAll(`${own} ${ownText(child)}`, terms)) {
        bulletIds.add(child.id);
        matched = true;
      }
    }
    if (matched) entryIds.add(item.id);
  }

  return entryIds.size === 0 ? null : { entryIds, bulletIds };
}

/** Every section's reading, by array position — the form's own index (§15.3). */
export function matchSections(
  library: ContentLibrary,
  sections: readonly VariantSection[],
  terms: readonly string[],
): (SectionFilter | null)[] {
  return sections.map((section) => matchSection(library, section, terms));
}

/**
 * What a narrowed card is hiding, said on the card.
 *
 * A filter that silently shortens a list can be misread as the library being
 * shorter than it is — and here that would mean rewording a bullet in the
 * belief that it was the only one. `null` where nothing is hidden.
 */
export function filterNote(
  library: ContentLibrary,
  section: VariantSection,
  filter: SectionFilter,
): string | null {
  const collection = sectionCollection(library, section);
  const shownEntries = filter.entryIds;
  if (collection === null || shownEntries === null) return null;

  const bullets = collection.flatMap((item) => childrenOf(item));
  const shownBullets =
    filter.bulletIds === null
      ? bullets.length
      : bullets.filter((child) => filter.bulletIds?.has(child.id)).length;

  const parts = [`${shownEntries.size} of ${collection.length} entries`];
  if (shownBullets < bullets.length) {
    parts.push(`${shownBullets} of ${bullets.length} bullets`);
  }
  return `Showing ${parts.join(", ")}`;
}
