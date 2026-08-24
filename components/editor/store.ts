/**
 * Editor state (SPEC §7, §11.4).
 *
 * One Zustand store per open variant, created on the client from the server's
 * disk read. It holds two copies of the whole document — `saved`, what is on
 * disk, and `draft`, what every form control edits — so "dirty" is a
 * comparison rather than a flag something has to remember to set, and the
 * preview always shows the document Save would produce.
 *
 * Both files are in the draft, not just the variant. A variant carries no text
 * (§6.2): editing a bullet edits the *library*, and §11.4 has that edit
 * propagate to every variant referencing it. Keeping the library alongside the
 * variant is what lets the editor stage such an edit and preview it before it
 * reaches disk.
 */
import { createStore } from "zustand/vanilla";

import { generateId, libraryIds } from "@/lib/data/ids";
import { build, type NewItemValues } from "@/lib/data/new-items";

import { moved, movedById, movedIds } from "./ordering";

import type { Bullet, ContentLibrary } from "@/lib/schema/library";
import type {
  HeaderMode,
  RecommendationsMode,
  SectionType,
  Variant,
  VariantSection,
} from "@/lib/schema/variant";

/** The two files an open editor edits together. */
export interface EditorDocument {
  variant: Variant;
  library: ContentLibrary;
}

export interface EditorSnapshot extends EditorDocument {
  profileId: string;
  variantId: string;
}

/** The library collections whose entries own bullets (§5.4, §5.5, §5.11). */
export type BulletOwner = "experience" | "projects" | "customSections";

export interface EditorState {
  profileId: string;
  variantId: string;
  /** The document as last read from (or written to) disk. */
  saved: EditorDocument;
  /** The edited document — what the preview renders and Save writes. */
  draft: EditorDocument;
  setTag(tag: string): void;
  setLabel(label: string): void;
  /**
   * Bullet IDs are unique only within their entry, so the owner and the entry
   * are part of the address.
   */
  setBulletText(owner: BulletOwner, entryId: string, bulletId: string, text: string): void;
  /**
   * Section-level curation (§12.2). Sections are addressed by array position,
   * because that is their only identity — there is no `order` field and a
   * variant may hold several custom sections (§15.3, §12.4).
   */
  setSectionVisible(index: number, visible: boolean): void;
  setHeaderMode(index: number, mode: HeaderMode): void;
  setAboutMeId(index: number, aboutMeId: string): void;
  setRecommendationsMode(index: number, mode: RecommendationsMode): void;
  setCustomSectionId(index: number, customSectionId: string): void;
  /**
   * Entry-level curation (§6.2): an entry is in the variant's list or it is
   * not — there is no `visible` flag below the section level. Covers the flat
   * item lists too (Core Competencies, §12.3) and Technical Skills' groups,
   * which §12.3 defines as mirroring how an entry references its bullets.
   */
  setEntryIncluded(index: number, entryId: string, included: boolean): void;
  /**
   * The second level: a bullet inside an entry (§5.4, §5.5), or a skill inside
   * a skill group (§12.3) — one ID list nested in another, either way.
   */
  setBulletIncluded(index: number, entryId: string, bulletId: string, included: boolean): void;
  /**
   * Reordering, the same three levels as curation (§7). Array position is the
   * whole of a variant's ordering (§15.3), so these move items inside the
   * variant's own arrays and write no rank field anywhere.
   *
   * Sections have no ID, so they move by index; entries and bullets move by
   * the pair of IDs a drop reports — dragged item onto target.
   */
  moveSection(from: number, to: number): void;
  moveEntry(index: number, fromId: string, toId: string): void;
  moveBullet(index: number, entryId: string, fromId: string, toId: string): void;
  /**
   * New content (§6.3). Both write the *library* first, with a generated ID,
   * and then reference that ID from the open variant — never the other way
   * round, and never into the variant alone. There is no path here that
   * produces variant-local text.
   */
  addEntry(index: number, values: NewItemValues): void;
  addBullet(index: number, ownerId: string, values: NewItemValues): void;
  /**
   * Adopt what a save just wrote as the new clean baseline (§7).
   *
   * The draft is deliberately *not* replaced: a save is a round trip, and
   * anything typed while it was in flight belongs to the person, not to the
   * response. `updatedAt` is the one field carried across, because the server
   * sets it and nothing in the editor does — which is enough for an untouched
   * draft to compare equal and the indicator to read "Saved". Copying an
   * editable field back would overwrite a keystroke made mid-request.
   */
  markSaved(document: EditorDocument): void;
  /** Throw the draft away and go back to the files on disk. */
  revert(): void;
}

export type EditorStore = ReturnType<typeof createEditorStore>;

/**
 * Serialises with object keys sorted, so the comparison below sees content
 * rather than construction order. Two documents differing only in key order
 * produce the same file — the schemas fix the written order — so calling that
 * "unsaved changes" would leave the indicator stuck on after a clean save.
 */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item as Record<string, unknown>)
            .sort()
            .map((key) => [key, (item as Record<string, unknown>)[key]]),
        )
      : item,
  );
}

/**
 * Structural comparison, not identity: reverting an edit by hand should clear
 * the dirty state, because at that point Save would write the same bytes.
 */
export function isDirty(state: EditorState): boolean {
  return canonical(state.draft) !== canonical(state.saved);
}

function editBullets<T extends { id: string; bullets: Bullet[] }>(
  entries: T[],
  entryId: string,
  bulletId: string,
  text: string,
): T[] {
  return entries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          bullets: entry.bullets.map((bullet) =>
            bullet.id === bulletId ? { ...bullet, text } : bullet,
          ),
        }
      : entry,
  );
}

/**
 * Written as a switch rather than an indexed write: each branch names one
 * collection, so the entry type stays concrete and a spread that dropped a
 * field would not compile.
 */
function withBulletText(
  library: ContentLibrary,
  owner: BulletOwner,
  entryId: string,
  bulletId: string,
  text: string,
): ContentLibrary {
  switch (owner) {
    case "experience":
      return { ...library, experience: editBullets(library.experience, entryId, bulletId, text) };
    case "projects":
      return { ...library, projects: editBullets(library.projects, entryId, bulletId, text) };
    case "customSections":
      return {
        ...library,
        customSections: editBullets(library.customSections, entryId, bulletId, text),
      };
  }
}

/**
 * Rewrites one section in place. The type is passed in and checked: an index
 * left over from a reorder must not write header options onto a projects
 * section, so a mismatch is a no-op rather than a corrupted variant.
 */
function withSection<T extends SectionType>(
  variant: Variant,
  index: number,
  type: T,
  update: (section: Extract<VariantSection, { type: T }>) => VariantSection,
): Variant {
  const section = variant.sections[index];
  if (section === undefined || section.type !== type) return variant;
  const sections = [...variant.sections];
  sections[index] = update(section as Extract<VariantSection, { type: T }>);
  return { ...variant, sections };
}

/** `visible` is the one curation field every section type shares (§12.2). */
function withVisible(variant: Variant, index: number, visible: boolean): Variant {
  const section = variant.sections[index];
  if (section === undefined) return variant;
  const sections = [...variant.sections];
  sections[index] = { ...section, visible };
  return { ...variant, sections };
}

/**
 * Where a re-included item goes back in. Appending would drop it at the bottom
 * of the section, so a mis-click followed by a correction would silently
 * reorder the CV; instead it lands after the last already-included item that
 * precedes it in the library, which is where it was before.
 */
function insertionIndex(currentIds: readonly string[], order: readonly string[], id: string): number {
  const before = new Set(order.slice(0, order.indexOf(id)));
  let at = 0;
  currentIds.forEach((currentId, position) => {
    if (before.has(currentId)) at = position + 1;
  });
  return at;
}

function withId<T extends { id: string }>(current: readonly T[], order: readonly string[], item: T): T[] {
  if (current.some((entry) => entry.id === item.id)) return [...current];
  const at = insertionIndex(current.map((entry) => entry.id), order, item.id);
  return [...current.slice(0, at), item, ...current.slice(at)];
}

function withoutId<T extends { id: string }>(current: readonly T[], id: string): T[] {
  return current.filter((entry) => entry.id !== id);
}

function toggleIds(
  current: readonly string[],
  order: readonly string[],
  id: string,
  included: boolean,
): string[] {
  if (!included) return current.filter((entry) => entry !== id);
  if (current.includes(id)) return [...current];
  const at = insertionIndex(current, order, id);
  return [...current.slice(0, at), id, ...current.slice(at)];
}

/**
 * Which bullets a newly re-included entry comes back with. The variant on disk
 * is consulted first: un-ticking an entry and ticking it again should not
 * quietly discard the bullet curation that was saved with it. An entry that is
 * new to this variant starts with all of its bullets.
 */
function restoredBullets(saved: Variant, index: number, entryId: string, all: readonly Bullet[]): string[] {
  const section = saved.sections[index];
  if (section && (section.type === "experience" || section.type === "projects")) {
    const found = section.entries.find((entry) => entry.id === entryId);
    if (found) return [...found.bullets];
  }
  return all.map((bullet) => bullet.id);
}

/** The same restore rule one level down in Technical Skills (§12.3). */
function restoredSkills(
  saved: Variant,
  index: number,
  groupId: string,
  all: readonly { id: string }[],
): string[] {
  const section = saved.sections[index];
  if (section?.type === "skills") {
    const found = section.groups.find((group) => group.id === groupId);
    if (found) return [...found.skills];
  }
  return all.map((skill) => skill.id);
}

/** Rewrites one section whatever its type; the update narrows for itself. */
function withSectionAny(
  variant: Variant,
  index: number,
  update: (section: VariantSection) => VariantSection,
): Variant {
  const section = variant.sections[index];
  if (section === undefined) return variant;
  const sections = [...variant.sections];
  sections[index] = update(section);
  return { ...variant, sections };
}

function ids(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id);
}

/**
 * Include or exclude one entry. Section types that curate nothing at entry
 * level — Languages (§12.3), and the option-only sections — fall through
 * unchanged rather than growing an entries array the schema forbids.
 */
function includeEntry(
  library: ContentLibrary,
  saved: Variant,
  index: number,
  section: VariantSection,
  entryId: string,
  included: boolean,
): VariantSection {
  switch (section.type) {
    case "competencies":
      return {
        ...section,
        items: toggleIds(section.items, ids(library.competencies), entryId, included),
      };

    case "experience": {
      if (!included) return { ...section, entries: withoutId(section.entries, entryId) };
      const entry = library.experience.find((item) => item.id === entryId);
      if (!entry) return section;
      return {
        ...section,
        entries: withId(section.entries, ids(library.experience), {
          id: entryId,
          bullets: restoredBullets(saved, index, entryId, entry.bullets),
        }),
      };
    }

    case "projects": {
      if (!included) return { ...section, entries: withoutId(section.entries, entryId) };
      const entry = library.projects.find((item) => item.id === entryId);
      if (!entry) return section;
      return {
        ...section,
        entries: withId(section.entries, ids(library.projects), {
          id: entryId,
          bullets: restoredBullets(saved, index, entryId, entry.bullets),
        }),
      };
    }

    // Entry-level only — Education has no bullets to trim (§15.7), and
    // certifications and recommendations follow the same ID-list pattern.
    case "education":
      return {
        ...section,
        entries: included
          ? withId(section.entries, ids(library.education), { id: entryId })
          : withoutId(section.entries, entryId),
      };

    case "certifications":
      return {
        ...section,
        entries: included
          ? withId(section.entries, ids(library.certifications), { id: entryId })
          : withoutId(section.entries, entryId),
      };

    case "recommendations":
      return {
        ...section,
        entries: included
          ? withId(section.entries, ids(library.recommendations), { id: entryId })
          : withoutId(section.entries, entryId),
      };

    // A skill group is curated exactly like an entry, and its skills like that
    // entry's bullets — §12.3 defines the shape as mirroring the other (§5.7).
    case "skills": {
      if (!included) return { ...section, groups: withoutId(section.groups, entryId) };
      const group = library.skillGroups.find((item) => item.id === entryId);
      if (!group) return section;
      return {
        ...section,
        groups: withId(section.groups, ids(library.skillGroups), {
          id: entryId,
          skills: restoredSkills(saved, index, entryId, group.skills),
        }),
      };
    }

    default:
      return section;
  }
}

/**
 * The nested ID list: bullets on Experience and Projects entries (§5.4, §5.5,
 * §15.7), skills inside a skill group (§12.3). Every other section type has
 * nothing at this level.
 */
function includeBullet(
  library: ContentLibrary,
  section: VariantSection,
  entryId: string,
  bulletId: string,
  included: boolean,
): VariantSection {
  if (section.type === "skills") {
    const order = ids(
      library.skillGroups.find((group) => group.id === entryId)?.skills ?? [],
    );
    return {
      ...section,
      groups: section.groups.map((ref) =>
        ref.id === entryId
          ? { ...ref, skills: toggleIds(ref.skills, order, bulletId, included) }
          : ref,
      ),
    };
  }
  if (section.type !== "experience" && section.type !== "projects") return section;
  const source = section.type === "experience" ? library.experience : library.projects;
  const order = ids(source.find((item) => item.id === entryId)?.bullets ?? []);
  const entries = section.entries.map((ref) =>
    ref.id === entryId
      ? { ...ref, bullets: toggleIds(ref.bullets, order, bulletId, included) }
      : ref,
  );
  return { ...section, entries };
}

/**
 * Reorders one section's curated list. Only the *included* items are here to
 * move: the variant's array is exactly what it includes, and everything else
 * the form offers sits in library order outside it.
 *
 * One branch per collection rather than a shared `entries` write, for the same
 * reason `includeEntry` is written that way — the entry shapes differ, and a
 * union write would lose that.
 */
function moveEntryIn(section: VariantSection, fromId: string, toId: string): VariantSection {
  switch (section.type) {
    case "competencies":
      return { ...section, items: movedIds(section.items, fromId, toId) };
    case "experience":
      return { ...section, entries: movedById(section.entries, fromId, toId) };
    case "projects":
      return { ...section, entries: movedById(section.entries, fromId, toId) };
    case "education":
      return { ...section, entries: movedById(section.entries, fromId, toId) };
    case "certifications":
      return { ...section, entries: movedById(section.entries, fromId, toId) };
    case "recommendations":
      return { ...section, entries: movedById(section.entries, fromId, toId) };
    // A skill group sits at entry level, as §12.3 defines it (§5.7).
    case "skills":
      return { ...section, groups: movedById(section.groups, fromId, toId) };
    // Nothing to order: Languages renders the library list whole (§15.6), and
    // the option-only sections hold no list at all.
    default:
      return section;
  }
}

/** The nested list: an entry's bullets, or a skill group's skills (§12.3). */
function moveBulletIn(
  section: VariantSection,
  entryId: string,
  fromId: string,
  toId: string,
): VariantSection {
  if (section.type === "skills") {
    return {
      ...section,
      groups: section.groups.map((ref) =>
        ref.id === entryId ? { ...ref, skills: movedIds(ref.skills, fromId, toId) } : ref,
      ),
    };
  }
  if (section.type !== "experience" && section.type !== "projects") return section;
  const entries = section.entries.map((ref) =>
    ref.id === entryId ? { ...ref, bullets: movedIds(ref.bullets, fromId, toId) } : ref,
  );
  return { ...section, entries };
}

/**
 * Adds one entry-level item: to the library, then to this variant's list
 * (§6.3). Appended at the end — it is new, so there is no earlier position to
 * restore it to, and the end is where the person was looking when they typed
 * it.
 */
function addEntryTo(document: EditorDocument, index: number, values: NewItemValues): EditorDocument {
  const { library, variant } = document;
  const section = variant.sections[index];
  if (section === undefined) return document;

  // Unique library-wide, not just within the collection: an ID is what the
  // library manager and every variant address an item by (§6.1).
  const taken = libraryIds(library);
  const at = (next: VariantSection): Variant => {
    const sections = [...variant.sections];
    sections[index] = next;
    return { ...variant, sections };
  };

  switch (section.type) {
    case "aboutMe": {
      const id = generateId("aboutMe", taken);
      return {
        library: { ...library, aboutMe: [...library.aboutMe, build.aboutMe(id, values)] },
        // Written here, for this variant, so this variant shows it (§5.2).
        variant: at({ ...section, options: { aboutMeId: id } }),
      };
    }

    case "competencies": {
      const id = generateId("competency", taken);
      return {
        library: {
          ...library,
          competencies: [...library.competencies, build.competency(id, values)],
        },
        variant: at({ ...section, items: [...section.items, id] }),
      };
    }

    case "experience": {
      const id = generateId("experience", taken);
      return {
        library: { ...library, experience: [...library.experience, build.experience(id, values)] },
        variant: at({ ...section, entries: [...section.entries, { id, bullets: [] }] }),
      };
    }

    case "projects": {
      const id = generateId("project", taken);
      return {
        library: { ...library, projects: [...library.projects, build.project(id, values)] },
        variant: at({ ...section, entries: [...section.entries, { id, bullets: [] }] }),
      };
    }

    case "education": {
      const id = generateId("education", taken);
      return {
        library: { ...library, education: [...library.education, build.education(id, values)] },
        variant: at({ ...section, entries: [...section.entries, { id }] }),
      };
    }

    case "skills": {
      const id = generateId("skillGroup", taken);
      return {
        library: {
          ...library,
          skillGroups: [...library.skillGroups, build.skillGroup(id, values)],
        },
        variant: at({ ...section, groups: [...section.groups, { id, skills: [] }] }),
      };
    }

    case "certifications": {
      const id = generateId("certification", taken);
      return {
        library: {
          ...library,
          certifications: [...library.certifications, build.certification(id, values)],
        },
        variant: at({ ...section, entries: [...section.entries, { id }] }),
      };
    }

    case "recommendations": {
      const id = generateId("recommendation", taken);
      return {
        library: {
          ...library,
          recommendations: [...library.recommendations, build.recommendation(id, values)],
        },
        variant: at({ ...section, entries: [...section.entries, { id }] }),
      };
    }

    // Library-only: Languages renders the library's list whole, with no
    // per-variant selection to add the new ID to (§12.3, §15.6).
    case "languages":
      return {
        library: {
          ...library,
          languages: [...library.languages, build.language(generateId("language", taken), values)],
        },
        variant,
      };

    case "custom": {
      const id = generateId("customSection", taken);
      return {
        library: {
          ...library,
          customSections: [...library.customSections, build.customSection(id, values)],
        },
        // This section instance points at the item just written for it; a
        // second custom section is a second section, not a second pointer
        // (§12.4).
        variant: at({ ...section, options: { customSectionId: id } }),
      };
    }

    // The header is one record, not a list — nothing to add to (§5.1).
    default:
      return document;
  }
}

/** Appends bullets to a library entry, and skills to a library group (§12.3). */
function addBulletTo(
  document: EditorDocument,
  index: number,
  ownerId: string,
  values: NewItemValues,
): EditorDocument {
  const { library, variant } = document;
  const section = variant.sections[index];
  if (section === undefined) return document;
  const taken = libraryIds(library);

  const at = (next: VariantSection): Variant => {
    const sections = [...variant.sections];
    sections[index] = next;
    return { ...variant, sections };
  };

  const withBullet = <T extends { id: string; bullets: Bullet[] }>(entries: T[], id: string): T[] =>
    entries.map((entry) =>
      entry.id === ownerId
        ? { ...entry, bullets: [...entry.bullets, build.bullet(id, values)] }
        : entry,
    );

  switch (section.type) {
    case "experience": {
      if (!library.experience.some((entry) => entry.id === ownerId)) return document;
      const id = generateId("bullet", taken);
      return {
        library: { ...library, experience: withBullet(library.experience, id) },
        variant: at({
          ...section,
          entries: section.entries.map((ref) =>
            ref.id === ownerId ? { ...ref, bullets: [...ref.bullets, id] } : ref,
          ),
        }),
      };
    }

    case "projects": {
      if (!library.projects.some((entry) => entry.id === ownerId)) return document;
      const id = generateId("bullet", taken);
      return {
        library: { ...library, projects: withBullet(library.projects, id) },
        variant: at({
          ...section,
          entries: section.entries.map((ref) =>
            ref.id === ownerId ? { ...ref, bullets: [...ref.bullets, id] } : ref,
          ),
        }),
      };
    }

    case "skills": {
      if (!library.skillGroups.some((group) => group.id === ownerId)) return document;
      const id = generateId("skill", taken);
      return {
        library: {
          ...library,
          skillGroups: library.skillGroups.map((group) =>
            group.id === ownerId
              ? { ...group, skills: [...group.skills, build.skill(id, values)] }
              : group,
          ),
        },
        variant: at({
          ...section,
          groups: section.groups.map((ref) =>
            ref.id === ownerId ? { ...ref, skills: [...ref.skills, id] } : ref,
          ),
        }),
      };
    }

    // A custom section's bullets are not curated per variant — the library
    // item is the unit (§12.4) — so there is no reference to add.
    case "custom": {
      if (!library.customSections.some((item) => item.id === ownerId)) return document;
      return {
        library: {
          ...library,
          customSections: withBullet(library.customSections, generateId("bullet", taken)),
        },
        variant,
      };
    }

    default:
      return document;
  }
}

export function createEditorStore({ profileId, variantId, ...document }: EditorSnapshot) {
  return createStore<EditorState>()((set) => ({
    profileId,
    variantId,
    saved: document,
    draft: document,

    setTag: (tag) =>
      set(({ draft }) => ({ draft: { ...draft, variant: { ...draft.variant, tag } } })),

    setLabel: (label) =>
      set(({ draft }) => ({ draft: { ...draft, variant: { ...draft.variant, label } } })),

    setBulletText: (owner, entryId, bulletId, text) =>
      set(({ draft }) => ({
        draft: { ...draft, library: withBulletText(draft.library, owner, entryId, bulletId, text) },
      })),

    setSectionVisible: (index, visible) =>
      set(({ draft }) => ({
        draft: { ...draft, variant: withVisible(draft.variant, index, visible) },
      })),

    setHeaderMode: (index, mode) =>
      set(({ draft }) => ({
        draft: {
          ...draft,
          variant: withSection(draft.variant, index, "header", (section) => ({
            ...section,
            options: { mode },
          })),
        },
      })),

    setAboutMeId: (index, aboutMeId) =>
      set(({ draft }) => ({
        draft: {
          ...draft,
          variant: withSection(draft.variant, index, "aboutMe", (section) => ({
            ...section,
            options: { aboutMeId },
          })),
        },
      })),

    setRecommendationsMode: (index, mode) =>
      set(({ draft }) => ({
        draft: {
          ...draft,
          variant: withSection(draft.variant, index, "recommendations", (section) => ({
            ...section,
            options: { mode },
          })),
        },
      })),

    setCustomSectionId: (index, customSectionId) =>
      set(({ draft }) => ({
        draft: {
          ...draft,
          variant: withSection(draft.variant, index, "custom", (section) => ({
            ...section,
            options: { customSectionId },
          })),
        },
      })),

    setEntryIncluded: (index, entryId, included) =>
      set(({ draft, saved }) => ({
        draft: {
          ...draft,
          variant: withSectionAny(draft.variant, index, (section) =>
            includeEntry(draft.library, saved.variant, index, section, entryId, included),
          ),
        },
      })),

    setBulletIncluded: (index, entryId, bulletId, included) =>
      set(({ draft }) => ({
        draft: {
          ...draft,
          variant: withSectionAny(draft.variant, index, (section) =>
            includeBullet(draft.library, section, entryId, bulletId, included),
          ),
        },
      })),

    moveSection: (from, to) =>
      set(({ draft }) => ({
        draft: {
          ...draft,
          variant: { ...draft.variant, sections: moved(draft.variant.sections, from, to) },
        },
      })),

    moveEntry: (index, fromId, toId) =>
      set(({ draft }) => ({
        draft: {
          ...draft,
          variant: withSectionAny(draft.variant, index, (section) =>
            moveEntryIn(section, fromId, toId),
          ),
        },
      })),

    moveBullet: (index, entryId, fromId, toId) =>
      set(({ draft }) => ({
        draft: {
          ...draft,
          variant: withSectionAny(draft.variant, index, (section) =>
            moveBulletIn(section, entryId, fromId, toId),
          ),
        },
      })),

    addEntry: (index, values) =>
      set(({ draft }) => ({ draft: addEntryTo(draft, index, values) })),

    addBullet: (index, ownerId, values) =>
      set(({ draft }) => ({ draft: addBulletTo(draft, index, ownerId, values) })),

    markSaved: (document) =>
      set(({ draft }) => ({
        saved: document,
        draft: {
          ...draft,
          variant: { ...draft.variant, updatedAt: document.variant.updatedAt },
        },
      })),

    revert: () => set((state) => ({ draft: state.saved })),
  }));
}
