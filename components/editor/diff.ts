/**
 * Variant-to-variant comparison (SPEC §7, §11.4, §12.5).
 *
 * A profile keeps a family of variants alive at once — one per application —
 * and they drift. This module answers the question that follows: what does
 * this one include that the other does not?
 *
 * It compares *resolved* documents, not variant files. A variant is nothing
 * but IDs, and two lists of IDs cannot be read; `resolveVariant` has already
 * dropped the hidden sections and looked every reference up in the library, so
 * what is compared here is what the two CVs actually print, described in the
 * words they print it in. Both sides resolve against the same library — they
 * are variants of one profile — so a difference reported here is always a
 * difference in curation, never a difference in content.
 *
 * The matching is by identity and never by text: items are paired on their
 * library ID, so an edit to a bullet's wording — which propagates to every
 * variant referencing it (§11.4) — cannot show up as one side dropping a
 * bullet and the other adding one.
 *
 * `a` is the open document throughout and `b` the one it is being compared
 * against. Nothing here names either of them; naming is the caller's business.
 */
import type { RenderModel, ResolvedBullet, ResolvedSection } from "@/lib/data/resolve";
import { SECTION_TITLE } from "@/lib/render/section-titles";

/** Which side of the comparison a row belongs to. */
export type DiffSide = "both" | "a" | "b";

/** A setting both sides carry and disagree about — never a presence question. */
export interface DiffOption {
  label: string;
  a: string;
  b: string;
}

export interface DiffRow {
  /** Unique among its siblings — a render key, not an identity. */
  key: string;
  /** Library ID, or the section's key for a section row. */
  id: string;
  label: string;
  side: DiffSide;
  /** Both sides have these children, but hold them in a different order. */
  reordered: boolean;
  /** Only ever set on a section row, and only where both sides have it. */
  options: DiffOption[];
  children: DiffRow[];
}

export interface DiffSummary {
  /** Rows at every level: sections, entries and bullets alike. */
  onlyA: number;
  onlyB: number;
  shared: number;
  /** Settings that disagree, and shared lists held in a different order. */
  options: number;
  reordered: number;
}

export interface VariantDiff {
  rows: DiffRow[];
  /** Both print the same sections, in a different order. */
  sectionsReordered: boolean;
  summary: DiffSummary;
  /** Nothing to report: same sections, same contents, same order, same options. */
  identical: boolean;
}

/** An item as the comparison sees it: an identity and something to call it. */
interface Unit {
  id: string;
  label: string;
  children: Unit[];
}

/** A section flattened to the same shape, plus the settings it carries. */
interface SectionView extends Unit {
  options: { label: string; value: string }[];
}

function unit(id: string, label: string, children: Unit[] = []): Unit {
  return { id, label, children };
}

/**
 * A row's headline, built from the fields the CV itself shows. Falls back to
 * the ID, so an item whose text is still blank is a labelled row rather than
 * an empty one — the rule the library manager reads its rows by.
 */
function headline(id: string, ...parts: (string | null)[]): string {
  const joined = parts
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" — ");
  return joined.length > 0 ? joined : id;
}

function texts(items: readonly ResolvedBullet[]): Unit[] {
  return items.map((item) => unit(item.id, headline(item.id, item.text)));
}

const either = (on: boolean, yes: string, no: string) => (on ? yes : no);

/**
 * One section as a comparable unit.
 *
 * Two section types deliberately have no children. Languages renders the whole
 * library list (§12.3, §15.6) and a custom section renders its library item
 * whole (§12.4) — neither is curated item by item, so the only thing either
 * variant decides about them is whether the section is there at all.
 */
function sectionView(section: ResolvedSection): SectionView {
  const view = (
    key: string,
    label: string,
    children: Unit[] = [],
    options: { label: string; value: string }[] = [],
  ): SectionView => ({ id: key, label, children, options });

  switch (section.type) {
    case "header":
      return view(
        "header",
        "Header",
        [],
        [
          { label: "Style", value: section.mode === "full" ? "Full" : "Minimal" },
          { label: "Job title", value: either(section.showTitle, "Shown", "Hidden") },
        ],
      );

    case "aboutMe":
      return view("aboutMe", SECTION_TITLE.aboutMe, [
        unit(section.id, headline(section.id, section.text)),
      ]);

    case "competencies":
      return view("competencies", SECTION_TITLE.competencies, texts(section.items));

    case "experience":
      return view(
        "experience",
        SECTION_TITLE.experience,
        section.entries.map((entry) =>
          unit(entry.id, headline(entry.id, entry.title, entry.company), texts(entry.bullets)),
        ),
        [{ label: "Split across pages", value: either(section.splitEntries, "Allowed", "Never") }],
      );

    case "projects":
      return view(
        "projects",
        SECTION_TITLE.projects,
        section.entries.map((entry) =>
          unit(entry.id, headline(entry.id, entry.title, entry.subtitle), texts(entry.bullets)),
        ),
        [{ label: "Split across pages", value: either(section.splitEntries, "Allowed", "Never") }],
      );

    case "education":
      return view(
        "education",
        SECTION_TITLE.education,
        section.entries.map((entry) =>
          unit(entry.id, headline(entry.id, entry.institution, entry.degree)),
        ),
      );

    case "skills":
      return view(
        "skills",
        SECTION_TITLE.skills,
        section.groups.map((group) =>
          unit(group.id, headline(group.id, group.label), texts(group.skills)),
        ),
      );

    case "certifications":
      return view(
        "certifications",
        SECTION_TITLE.certifications,
        section.entries.map((entry) => unit(entry.id, headline(entry.id, entry.text))),
      );

    case "languages":
      return view("languages", SECTION_TITLE.languages);

    case "recommendations":
      return view(
        "recommendations",
        SECTION_TITLE.recommendations,
        section.entries.map((entry) => unit(entry.id, headline(entry.id, entry.name, entry.role))),
        [{ label: "Detail", value: section.mode === "expanded" ? "Entries listed" : "One line" }],
      );

    // Keyed by the library item it points at rather than by "custom": a
    // variant may carry several, and two variants pointing at different items
    // are showing different sections, not one section set differently (§12.4).
    case "custom":
      return view(
        `custom:${section.section.id}`,
        headline(section.section.id, section.section.title),
      );
  }
}

interface Pair<T extends Unit> {
  id: string;
  side: DiffSide;
  a: T | null;
  b: T | null;
}

/**
 * Matches two lists by ID, keeping **A's order as the spine**: every A item is
 * emitted where A has it, and each B-only item follows the last shared item
 * that preceded it in B (or leads, if none did).
 *
 * A merge cannot honour two orders at once, and picking one beats inventing a
 * third: A is the document the person has open, so the comparison reads down
 * their own CV with the other one's extras slotted in. Whether the shared
 * items are held in a *different* order is then reported in its own right,
 * rather than being smuggled into the layout where it cannot be seen.
 */
function pair<T extends Unit>(
  a: readonly T[],
  b: readonly T[],
): { pairs: Pair<T>[]; reordered: boolean } {
  const inA = new Map(a.map((item) => [item.id, item]));
  const inB = new Map(b.map((item) => [item.id, item]));

  // B-only items, grouped under the shared item they follow in B.
  const after = new Map<string | null, T[]>();
  let anchor: string | null = null;
  for (const item of b) {
    if (inA.has(item.id)) {
      anchor = item.id;
      continue;
    }
    const group = after.get(anchor);
    if (group) group.push(item);
    else after.set(anchor, [item]);
  }

  const pairs: Pair<T>[] = [];
  const pushOnlyB = (items: T[] | undefined) => {
    for (const item of items ?? []) pairs.push({ id: item.id, side: "b", a: null, b: item });
  };

  pushOnlyB(after.get(null));
  for (const item of a) {
    const other = inB.get(item.id) ?? null;
    pairs.push({ id: item.id, side: other ? "both" : "a", a: item, b: other });
    if (other) pushOnlyB(after.get(item.id));
  }

  const sharedIds = (items: readonly T[], other: Map<string, T>) =>
    items.filter((item) => other.has(item.id)).map((item) => item.id);
  const reordered = sharedIds(a, inB).join(" ") !== sharedIds(b, inA).join(" ");

  return { pairs, reordered };
}

/** The settings both sides carry that disagree. Empty on a one-sided row. */
function optionDiffs(a: SectionView, b: SectionView): DiffOption[] {
  const byLabel = new Map(b.options.map((option) => [option.label, option.value]));
  const out: DiffOption[] = [];
  for (const option of a.options) {
    const other = byLabel.get(option.label);
    if (other !== undefined && other !== option.value) {
      out.push({ label: option.label, a: option.value, b: other });
    }
  }
  return out;
}

/**
 * The contents of a row only one side has. Such an entry still lists its
 * bullets — an entry the other variant left out is worth seeing whole — and
 * every descendant inherits the side its parent is on.
 */
function oneSidedRows(parentKey: string, items: readonly Unit[], side: DiffSide): DiffRow[] {
  return items.map((item, index) => {
    const key = `${parentKey}/${index}:${item.id}`;
    return {
      key,
      id: item.id,
      label: item.label,
      side,
      reordered: false,
      options: [] as DiffOption[],
      children: oneSidedRows(key, item.children, side),
    };
  });
}

/** One matched pair's children, whichever side (or sides) it is on. */
function nestedRows<T extends Unit>(
  key: string,
  match: Pair<T>,
): { rows: DiffRow[]; reordered: boolean } {
  if (match.side === "both") return rowsFor(key, match.a!.children, match.b!.children);
  return { rows: oneSidedRows(key, (match.a ?? match.b!).children, match.side), reordered: false };
}

/** One level of rows below a section — entries, then their bullets. */
function rowsFor(
  parentKey: string,
  a: readonly Unit[],
  b: readonly Unit[],
): { rows: DiffRow[]; reordered: boolean } {
  const { pairs, reordered } = pair(a, b);
  const rows = pairs.map((match, index) => {
    const key = `${parentKey}/${index}:${match.id}`;
    const nested = nestedRows(key, match);
    return {
      key,
      id: match.id,
      label: (match.a ?? match.b!).label,
      side: match.side,
      reordered: nested.reordered,
      options: [] as DiffOption[],
      children: nested.rows,
    };
  });
  return { rows, reordered };
}

function tally(rows: readonly DiffRow[], summary: DiffSummary): void {
  for (const row of rows) {
    if (row.side === "a") summary.onlyA += 1;
    else if (row.side === "b") summary.onlyB += 1;
    else summary.shared += 1;
    if (row.reordered) summary.reordered += 1;
    summary.options += row.options.length;
    tally(row.children, summary);
  }
}

/**
 * Compares two resolved documents, section by section and entry by entry.
 *
 * `a` is the document the person has open; `b` is what they are comparing it
 * against. Hidden sections are already gone by the time the models arrive, so
 * a section switched off on one side is reported as that side not having it —
 * which is what it means for the CV that prints.
 */
export function diffVariants(a: RenderModel, b: RenderModel): VariantDiff {
  const left = a.sections.map(sectionView);
  const right = b.sections.map(sectionView);

  const { pairs, reordered } = pair(left, right);
  const rows = pairs.map((match, index) => {
    const key = `${index}:${match.id}`;
    const nested = nestedRows(key, match);
    return {
      key,
      id: match.id,
      label: (match.a ?? match.b!).label,
      side: match.side,
      reordered: nested.reordered,
      options: match.side === "both" ? optionDiffs(match.a!, match.b!) : [],
      children: nested.rows,
    };
  });

  const summary: DiffSummary = {
    onlyA: 0,
    onlyB: 0,
    shared: 0,
    options: 0,
    reordered: reordered ? 1 : 0,
  };
  tally(rows, summary);

  return {
    rows,
    sectionsReordered: reordered,
    summary,
    identical:
      summary.onlyA === 0 &&
      summary.onlyB === 0 &&
      summary.options === 0 &&
      summary.reordered === 0,
  };
}

/**
 * The same tree with everything both variants agree on removed.
 *
 * A real profile shares most of its content between variants, so the whole
 * tree is mostly rows saying "unchanged" — which is the answer to a question
 * nobody opened the comparison to ask. A row survives if it is one-sided, if
 * it carries a disagreement of its own, or if something below it did; a
 * one-sided row keeps its contents whole, because an entry the other variant
 * left out is left out bullets and all.
 */
export function onlyDifferences(rows: readonly DiffRow[]): DiffRow[] {
  const out: DiffRow[] = [];
  for (const row of rows) {
    if (row.side !== "both") {
      out.push(row);
      continue;
    }
    const children = onlyDifferences(row.children);
    if (children.length > 0 || row.options.length > 0 || row.reordered) {
      out.push({ ...row, children });
    }
  }
  return out;
}
