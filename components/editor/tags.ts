/**
 * Tag-driven curation in the editor (SPEC §6.1, §6.2).
 *
 * Every library item carries optional tags — `backend`, `iot`, `ml` — and
 * §6.1 puts them there for exactly this: tailoring a variant to a posting is
 * mostly "include everything tagged `backend`, drop the rest". The library
 * manager already filters by them (`TagFilter`); this module is what lets the
 * editor *act* on them.
 *
 * Both curated levels, not just entries. A tag sits wherever the person put
 * it, and in a real library that is mostly on bullets — the sentence is what
 * is about backend work, not the job that contained it. An entry-level-only
 * action would leave the chips inert on Experience and Projects, which are
 * the two sections tailoring actually spends its time in.
 *
 * The two levels are addressed in one order, deliberately: entries first, then
 * bullets inside whatever the section includes *after* that pass. So "+" can
 * pull an entry in and curate its bullets in the same action, and a bullet
 * inside an excluded entry is left alone rather than silently dragging its job
 * onto the CV — an entry joins the variant only when the entry itself is
 * tagged.
 *
 * Nothing here writes anything. A tag names a set of IDs; the store then walks
 * them through the ordinary per-item curation path, so a bulk action produces
 * the same draft as ticking the boxes by hand — re-included entries keep their
 * saved bullet curation and their position (§6.2, §15.3).
 */
import type { ContentLibrary } from "@/lib/schema/library";
import type { VariantSection } from "@/lib/schema/variant";

/** The least a taggable library item is — every collection below satisfies it. */
interface Taggable {
  id: string;
  tags: string[];
}

/** One curated item inside an entry: a bullet, or a skill in a group (§12.3). */
export interface BulletRef {
  entryId: string;
  bulletId: string;
}

/** How one tag stands in one section: what it covers, and how much is in. */
export interface TagSummary {
  tag: string;
  /** Entries in this section's collection carrying the tag, library order. */
  entryIds: string[];
  /** Tagged bullets, inside the entries the variant currently includes. */
  bulletRefs: BulletRef[];
  /** Everything the tag reaches here, both levels together. */
  total: number;
  /** How much of that the variant currently includes. */
  includedCount: number;
}

/**
 * The library collection a section curates at entry level, or `null` where
 * there is nothing to curate: About Me and Custom pick one item by ID, the
 * header is one record, and Languages is all-or-nothing (§12.3, §15.6).
 */
export function sectionCollection(
  library: ContentLibrary,
  section: VariantSection,
): Taggable[] | null {
  switch (section.type) {
    case "competencies":
      return library.competencies;
    case "experience":
      return library.experience;
    case "projects":
      return library.projects;
    case "education":
      return library.education;
    case "certifications":
      return library.certifications;
    case "recommendations":
      return library.recommendations;
    // A skill group is curated exactly as an entry is, and its skills as that
    // entry's bullets — §12.3 defines the shape as mirroring the other.
    case "skills":
      return library.skillGroups;
    default:
      return null;
  }
}

/**
 * The IDs this section currently includes. The variant's array *is* its list
 * of included items (§6.2), so this is a read of that array under whichever
 * name the section type gives it.
 */
export function includedIds(section: VariantSection): string[] {
  if (section.type === "competencies") return [...section.items];
  if (section.type === "skills") return section.groups.map((group) => group.id);
  if ("entries" in section) return section.entries.map((entry) => entry.id);
  return [];
}

/**
 * The second curated level, per included entry: which of its bullets (or its
 * skills) the variant currently holds. Empty for the section types whose
 * entries have nothing below them (Education §15.7, Certifications,
 * Recommendations, Competencies).
 */
function includedBulletIds(section: VariantSection, entryId: string): string[] {
  if (section.type === "skills") {
    return [...(section.groups.find((group) => group.id === entryId)?.skills ?? [])];
  }
  if (section.type === "experience" || section.type === "projects") {
    return [...(section.entries.find((entry) => entry.id === entryId)?.bullets ?? [])];
  }
  return [];
}

/**
 * A library entry's own curated children — bullets, or a group's skills.
 *
 * Exported because the editor's text filter walks the same two levels this
 * does (`filter.ts`): "what hangs off an entry" is one answer, and two copies
 * of it would drift the moment a section type gained a third shape.
 */
export function childrenOf(item: Taggable): Taggable[] {
  const source = item as Taggable & { bullets?: Taggable[]; skills?: Taggable[] };
  return source.bullets ?? source.skills ?? [];
}

/** The entries a tag names in one section, in library order (§15.3). */
export function taggedEntryIds(
  library: ContentLibrary,
  section: VariantSection,
  tag: string,
): string[] {
  const collection = sectionCollection(library, section);
  if (collection === null) return [];
  return collection.filter((item) => item.tags.includes(tag)).map((item) => item.id);
}

/**
 * The tagged bullets a tag names in one section — scoped to the entries the
 * section currently includes, because a bullet inside an excluded entry is not
 * on this CV and curating it would be an edit nobody could see the result of.
 */
export function taggedBulletRefs(
  library: ContentLibrary,
  section: VariantSection,
  tag: string,
): BulletRef[] {
  const collection = sectionCollection(library, section);
  if (collection === null) return [];
  const current = new Set(includedIds(section));

  return collection
    .filter((item) => current.has(item.id))
    .flatMap((item) =>
      childrenOf(item)
        .filter((child) => child.tags.includes(tag))
        .map((child) => ({ entryId: item.id, bulletId: child.id })),
    );
}

/**
 * Every tag in play in one section, sorted, with what it covers and how much
 * of that is already in.
 *
 * Scoped to the section's own content rather than to the whole library: a tag
 * used only on projects has nothing to offer the Education card, and showing
 * it there would be a button that does nothing.
 */
export function sectionTags(library: ContentLibrary, section: VariantSection): TagSummary[] {
  const collection = sectionCollection(library, section);
  if (collection === null) return [];

  const current = new Set(includedIds(section));
  const tags = new Set<string>();
  for (const item of collection) {
    for (const tag of item.tags) tags.add(tag);
    if (!current.has(item.id)) continue;
    for (const child of childrenOf(item)) {
      for (const tag of child.tags) tags.add(tag);
    }
  }

  return [...tags]
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => {
      const entryIds = taggedEntryIds(library, section, tag);
      const bulletRefs = taggedBulletRefs(library, section, tag);
      const includedCount =
        entryIds.filter((id) => current.has(id)).length +
        bulletRefs.filter((ref) => includedBulletIds(section, ref.entryId).includes(ref.bulletId))
          .length;

      return { tag, entryIds, bulletRefs, total: entryIds.length + bulletRefs.length, includedCount };
    });
}
