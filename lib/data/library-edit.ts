/**
 * Editing the content library itself (SPEC §11.4, §7's library manager).
 *
 * Every operation here is a pure function from one library to the next: find
 * the item by ID anywhere in the file — top level, or a bullet inside an entry
 * — apply the change, and hand back a new library. Nothing writes to disk;
 * the server action does that once, through the store's atomic write.
 *
 * That an edit *propagates* is not a feature implemented here — it is what
 * follows from a variant holding IDs and no text (§6.2). Rewriting the item's
 * text in the library is the whole operation; every variant referencing that
 * ID renders the new wording the next time it is resolved.
 *
 * The result is re-parsed through the schema before it is returned, so a
 * change that would produce an unwritable library fails here rather than at
 * the store, with the offending field named.
 */
import { contentLibrarySchema, type ContentLibrary } from "../schema/library";
import { ITEM_FIELDS, type LibraryItemKind } from "./library-index";

/** No item in the library carries this ID. */
export class UnknownItemError extends Error {
  override readonly name = "UnknownItemError";

  constructor(readonly id: string) {
    super(`No library item with id ${JSON.stringify(id)}`);
  }
}

/** A change that would make `content-library.json` fail its own schema. */
export class InvalidEditError extends Error {
  override readonly name = "InvalidEditError";
}

/** A library record, read and rewritten one field at a time. */
type Raw = Record<string, unknown>;

/**
 * Visits one item. Returning the item unchanged keeps it, returning a new
 * object replaces it, returning `null` removes it, and returning an array
 * splices those items in its place — which is what a fork needs (§11.4).
 */
type Visitor = (item: Raw, kind: LibraryItemKind, parentId: string | null) => Raw | Raw[] | null;

function visitAll(
  items: unknown,
  kind: LibraryItemKind,
  parentId: string | null,
  visit: Visitor,
  nested?: { key: "bullets" | "skills"; kind: LibraryItemKind },
): Raw[] {
  const out: Raw[] = [];
  for (const raw of (items ?? []) as Raw[]) {
    const withChildren = nested
      ? { ...raw, [nested.key]: visitAll(raw[nested.key], nested.kind, String(raw.id), visit) }
      : raw;

    const result = visit(withChildren, kind, parentId);
    if (result === null) continue;
    if (Array.isArray(result)) out.push(...result);
    else out.push(result);
  }
  return out;
}

/**
 * Walks every item in the library, children before their parents, and rebuilds
 * it from what the visitor returns. One traversal serves edit, tag, fork and
 * delete — the twelve item kinds differ only in which fields they carry.
 */
export function mapLibraryItems(library: ContentLibrary, visit: Visitor): ContentLibrary {
  const next = {
    ...library,
    aboutMe: visitAll(library.aboutMe, "aboutMe", null, visit),
    competencies: visitAll(library.competencies, "competency", null, visit),
    experience: visitAll(library.experience, "experience", null, visit, {
      key: "bullets",
      kind: "bullet",
    }),
    projects: visitAll(library.projects, "project", null, visit, { key: "bullets", kind: "bullet" }),
    education: visitAll(library.education, "education", null, visit),
    skillGroups: visitAll(library.skillGroups, "skillGroup", null, visit, {
      key: "skills",
      kind: "skill",
    }),
    certifications: visitAll(library.certifications, "certification", null, visit),
    recommendations: visitAll(library.recommendations, "recommendation", null, visit),
    languages: visitAll(library.languages, "language", null, visit),
    customSections: visitAll(library.customSections, "customSection", null, visit, {
      key: "bullets",
      kind: "bullet",
    }),
  };

  const parsed = contentLibrarySchema.safeParse(next);
  if (!parsed.success) throw new InvalidEditError(parsed.error.message);
  return parsed.data;
}

export interface FoundItem {
  kind: LibraryItemKind;
  parentId: string | null;
  item: Raw;
}

/** Locates an item by ID, wherever it lives. */
export function findItem(library: ContentLibrary, id: string): FoundItem | null {
  let found: FoundItem | null = null;
  mapLibraryItems(library, (item, kind, parentId) => {
    if (item.id === id) found = { kind, parentId, item };
    return item;
  });
  return found;
}

/**
 * Applies form values to one item's fields.
 *
 * Only fields the manager declares for that kind are written, so a stray key
 * in the payload cannot introduce one the schema would then reject — and an
 * absent key leaves its field alone rather than blanking it.
 *
 * A blank link becomes `null`, not `""`: §6.4's URL fields are nullable and
 * the schema rejects an empty string, so clearing one has to mean absent.
 */
export function updateItemFields(
  library: ContentLibrary,
  id: string,
  values: Record<string, string>,
): ContentLibrary {
  let seen = false;

  const next = mapLibraryItems(library, (item, kind) => {
    if (item.id !== id) return item;
    seen = true;

    const updated: Raw = { ...item };
    for (const field of ITEM_FIELDS[kind]) {
      const value = values[field.name];
      if (value === undefined) continue;
      const trimmed = value.trim();
      updated[field.name] = field.url ? (trimmed.length > 0 ? trimmed : null) : value;
    }
    return updated;
  });

  if (!seen) throw new UnknownItemError(id);
  return next;
}

/**
 * Normalises a comma-separated tag list (§6.1).
 *
 * Lowercased, trimmed and de-duplicated in the order typed: tags exist to
 * filter and to feed AI drafting, and `Backend`, `backend ` and `backend`
 * being three different tags would quietly split every filter three ways.
 */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(",")) {
    const tag = raw.trim().toLowerCase();
    if (tag.length > 0) seen.add(tag);
  }
  return [...seen];
}

/** Replaces one item's tags, leaving its text and children alone (§6.1). */
export function setItemTags(
  library: ContentLibrary,
  id: string,
  tags: readonly string[],
): ContentLibrary {
  let seen = false;
  const next = mapLibraryItems(library, (item) => {
    if (item.id !== id) return item;
    seen = true;
    return { ...item, tags: [...tags] };
  });
  if (!seen) throw new UnknownItemError(id);
  return next;
}

/**
 * An item's own ID plus every ID nested under it. What a delete would take
 * with it, and therefore what has to be checked for references first (§7).
 */
export function itemAndDescendantIds(library: ContentLibrary, id: string): string[] {
  const found = findItem(library, id);
  if (!found) throw new UnknownItemError(id);

  const ids = [id];
  for (const key of ["bullets", "skills"] as const) {
    const children = found.item[key];
    if (Array.isArray(children)) {
      for (const child of children as Raw[]) ids.push(String(child.id));
    }
  }
  return ids;
}

/**
 * Removes an item, and anything nested under it, from the library (§7).
 *
 * Nothing here checks whether a variant still references it — that check needs
 * every variant on disk and belongs to the caller (`orphans.ts`). This
 * function is the removal alone, so the check can never be half-applied by a
 * caller that forgot to look.
 */
export function deleteItem(library: ContentLibrary, id: string): ContentLibrary {
  let seen = false;
  const next = mapLibraryItems(library, (item) => {
    if (item.id !== id) return item;
    seen = true;
    return null;
  });
  if (!seen) throw new UnknownItemError(id);
  return next;
}

export interface ForkResult {
  library: ContentLibrary;
  /** Old ID → new ID, for the forked item and any children it carried. */
  replacements: Map<string, string>;
}

/**
 * Duplicates one item under a fresh ID — §11.4's "Fork this bullet".
 *
 * The point of a fork is job-specific wording that does *not* reach the other
 * variants, so the copy has to be a new library item rather than an edit: the
 * original keeps its ID, every variant referencing it keeps rendering it, and
 * only the variant repointed by the caller moves to the copy.
 *
 * The copy is inserted immediately after the original rather than appended.
 * Library order is what the editor's "not in this variant" list shows (§15.3),
 * and a fork that jumped to the bottom of a long list would read as a new,
 * unrelated item instead of a sibling wording.
 *
 * Children are forked too, each with its own new ID: an entry sharing its
 * bullets with the original would leave the fork only half independent, and
 * editing one of those bullets would propagate straight back (§11.4).
 */
export function forkItem(
  library: ContentLibrary,
  id: string,
  generate: (kind: LibraryItemKind) => string,
): ForkResult {
  const replacements = new Map<string, string>();

  const forked = mapLibraryItems(library, (item, kind) => {
    if (item.id !== id) return item;

    const copy: Raw = { ...item, id: generate(kind) };
    replacements.set(String(item.id), String(copy.id));

    for (const key of ["bullets", "skills"] as const) {
      const children = item[key];
      if (!Array.isArray(children)) continue;
      copy[key] = (children as Raw[]).map((child) => {
        const childKind: LibraryItemKind = key === "bullets" ? "bullet" : "skill";
        const childCopy = { ...child, id: generate(childKind) };
        replacements.set(String(child.id), String(childCopy.id));
        return childCopy;
      });
    }

    return [item, copy];
  });

  if (replacements.size === 0) throw new UnknownItemError(id);
  return { library: forked, replacements };
}
