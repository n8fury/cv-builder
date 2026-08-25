/**
 * A flat, uniform view of a content library (SPEC §7's library manager, §12.7).
 *
 * The library manager browses, edits, tags and deletes *every* kind of item
 * with one set of controls, so it needs one shape to render them in. This
 * module is that shape: each collection becomes a group, each item a
 * `LibraryItem` carrying its id, tags and editable fields, with bullets and
 * skills nested under the entry they belong to.
 *
 * Nesting rather than a flat list of every bullet in the profile: a bullet's
 * text is only meaningful next to the job it describes, and the whole point of
 * this screen is deciding whether an item is still worth keeping.
 *
 * The field lists are the manager's editing surface, and `library-index.test.ts`
 * holds them against the Zod schemas — a field on `content-library.json` that
 * no screen can reach would otherwise be invisible and uneditable.
 */
import {
  aboutMeSchema,
  bulletSchema,
  certificationSchema,
  competencySchema,
  customSectionSchema,
  educationSchema,
  experienceSchema,
  languageSchema,
  projectSchema,
  recommendationSchema,
  skillGroupSchema,
  skillSchema,
  type ContentLibrary,
} from "../schema/library";
import type { IdKind } from "./ids";

/**
 * Every addressable kind of library item (§6.1).
 *
 * The same set `ids.ts` mints IDs for, and deliberately the *same type*: a
 * kind the manager can create but has no ID prefix for — or the reverse —
 * would be a compile error rather than a run-time surprise mid-fork.
 */
export type LibraryItemKind = IdKind;

/**
 * One editable field on an item. `url` is separate from plain text because
 * §6.4's link fields are nullable and the schema rejects a non-URL string — a
 * blank has to be written back as `null`, not `""`.
 */
export interface LibraryField {
  name: string;
  label: string;
  value: string;
  multiline?: boolean;
  url?: boolean;
}

export interface LibraryItem {
  kind: LibraryItemKind;
  id: string;
  /** The entry a bullet or skill hangs off; `null` for top-level items. */
  parentId: string | null;
  /** One-line headline for the row, derived from the item's own fields. */
  title: string;
  fields: LibraryField[];
  tags: string[];
  /** Bullets under an entry, skills inside a group — same shape, nested. */
  children: LibraryItem[];
}

/** The collections of `content-library.json`, by their key on the file. */
export type LibraryCollection =
  | "aboutMe"
  | "competencies"
  | "experience"
  | "projects"
  | "education"
  | "skillGroups"
  | "certifications"
  | "recommendations"
  | "languages"
  | "customSections";

export interface LibraryGroup {
  collection: LibraryCollection;
  label: string;
  /** What the group holds at its top level. */
  kind: LibraryItemKind;
  items: LibraryItem[];
}

/**
 * Fields the manager never edits, whatever the kind: `id` is the item's
 * permanent identity (every variant addresses it, §11.4), `tags` have their
 * own control (§6.1), and the nested `bullets`/`skills` arrays are items in
 * their own right rather than a field of their parent.
 */
export const EXCLUDED_FIELDS = ["id", "tags", "bullets", "skills"] as const;

const field = (
  name: string,
  label: string,
  extra: Partial<LibraryField> = {},
): Omit<LibraryField, "value"> => ({ name, label, ...extra });

/** The editable fields per kind, in the order the manager shows them. */
export const ITEM_FIELDS: Record<LibraryItemKind, Omit<LibraryField, "value">[]> = {
  aboutMe: [field("key", "Key"), field("text", "Paragraph", { multiline: true })],
  competency: [field("text", "Phrase")],
  experience: [
    field("title", "Title"),
    field("company", "Company"),
    field("location", "Location"),
    field("dates", "Dates"),
  ],
  project: [
    field("title", "Title"),
    field("subtitle", "Subtitle"),
    field("dates", "Dates"),
    field("repoUrl", "Repo URL", { url: true }),
    field("demoUrl", "Demo URL", { url: true }),
  ],
  education: [
    field("institution", "Institution"),
    field("degree", "Degree"),
    field("dates", "Dates"),
    field("description", "Description", { multiline: true }),
  ],
  skillGroup: [field("label", "Group label")],
  skill: [field("text", "Skill")],
  certification: [
    field("text", "Certification"),
    field("dates", "Dates"),
    field("credentialUrl", "Credential URL", { url: true }),
  ],
  recommendation: [
    field("name", "Name"),
    field("role", "Role"),
    field("location", "Location"),
    field("email", "Email"),
  ],
  language: [field("language", "Language"), field("proficiency", "Proficiency")],
  customSection: [field("title", "Title"), field("paragraph", "Paragraph", { multiline: true })],
  bullet: [field("text", "Bullet", { multiline: true })],
};

/**
 * The schema each kind's field list is checked against. Kept beside the lists
 * so a kind added without a schema to hold it to is a type error rather than a
 * silently unguarded entry.
 */
export const ITEM_SCHEMAS = {
  aboutMe: aboutMeSchema,
  competency: competencySchema,
  experience: experienceSchema,
  project: projectSchema,
  education: educationSchema,
  skillGroup: skillGroupSchema,
  skill: skillSchema,
  certification: certificationSchema,
  recommendation: recommendationSchema,
  language: languageSchema,
  customSection: customSectionSchema,
  bullet: bulletSchema,
} satisfies Record<LibraryItemKind, { shape: Record<string, unknown> }>;

/** A record straight off the library, read one field at a time. */
type Raw = Record<string, unknown>;

/** `null` links and absent fields both render as an empty input. */
function readField(source: Raw, name: string): string {
  const value = source[name];
  return typeof value === "string" ? value : "";
}

function readTags(source: Raw): string[] {
  return Array.isArray(source.tags) ? (source.tags as string[]) : [];
}

/** Which fields make up an item's headline, when its first field will not do. */
const HEADLINE_FIELDS: Partial<Record<LibraryItemKind, string[]>> = {
  aboutMe: ["key"],
  experience: ["title", "company"],
  education: ["institution", "degree"],
  recommendation: ["name", "role"],
  language: ["language", "proficiency"],
};

/**
 * The headline shown on a collapsed row. Falls back to the id, so an item
 * whose text is still blank is a labelled row rather than an empty one.
 */
function headline(kind: LibraryItemKind, source: Raw, id: string): string {
  const names = HEADLINE_FIELDS[kind] ?? [ITEM_FIELDS[kind][0]?.name ?? "text"];
  const joined = names
    .map((name) => readField(source, name))
    .filter((part) => part.length > 0)
    .join(" — ");
  return joined.length > 0 ? joined : id;
}

function toItem(
  kind: LibraryItemKind,
  source: Raw,
  parentId: string | null = null,
  children: LibraryItem[] = [],
): LibraryItem {
  const id = String(source.id ?? "");
  return {
    kind,
    id,
    parentId,
    title: headline(kind, source, id),
    fields: ITEM_FIELDS[kind].map((spec) => ({ ...spec, value: readField(source, spec.name) })),
    tags: readTags(source),
    children,
  };
}

/** An entry plus its bullets, which are library items of their own (§6.2). */
function withBullets(kind: LibraryItemKind, source: Raw): LibraryItem {
  const bullets = Array.isArray(source.bullets) ? (source.bullets as Raw[]) : [];
  const id = String(source.id ?? "");
  return toItem(
    kind,
    source,
    null,
    bullets.map((bullet) => toItem("bullet", bullet, id)),
  );
}

const raw = (value: unknown): Raw => value as Raw;

/**
 * Every group in `content-library.json`, in the order the manager lists them.
 * Empty collections are kept rather than dropped: a group that vanished with
 * its last item would leave nowhere to look for what used to be there.
 */
export function indexLibrary(library: ContentLibrary): LibraryGroup[] {
  return [
    {
      collection: "aboutMe",
      label: "About Me",
      kind: "aboutMe",
      items: library.aboutMe.map((item) => toItem("aboutMe", raw(item))),
    },
    {
      collection: "competencies",
      label: "Core Competencies",
      kind: "competency",
      items: library.competencies.map((item) => toItem("competency", raw(item))),
    },
    {
      collection: "experience",
      label: "Experience",
      kind: "experience",
      items: library.experience.map((item) => withBullets("experience", raw(item))),
    },
    {
      collection: "projects",
      label: "Projects",
      kind: "project",
      items: library.projects.map((item) => withBullets("project", raw(item))),
    },
    {
      collection: "education",
      label: "Education",
      kind: "education",
      items: library.education.map((item) => toItem("education", raw(item))),
    },
    {
      collection: "skillGroups",
      label: "Technical Skills",
      kind: "skillGroup",
      items: library.skillGroups.map((group) =>
        toItem(
          "skillGroup",
          raw(group),
          null,
          group.skills.map((skill) => toItem("skill", raw(skill), group.id)),
        ),
      ),
    },
    {
      collection: "certifications",
      label: "Certifications",
      kind: "certification",
      items: library.certifications.map((item) => toItem("certification", raw(item))),
    },
    {
      collection: "recommendations",
      label: "Recommendations",
      kind: "recommendation",
      items: library.recommendations.map((item) => toItem("recommendation", raw(item))),
    },
    {
      collection: "languages",
      label: "Languages",
      kind: "language",
      items: library.languages.map((item) => toItem("language", raw(item))),
    },
    {
      collection: "customSections",
      label: "Custom Sections",
      kind: "customSection",
      items: library.customSections.map((item) => withBullets("customSection", raw(item))),
    },
  ];
}

/** Every tag in use across the library, sorted — the filter's vocabulary (§6.1). */
export function allTags(groups: LibraryGroup[]): string[] {
  const tags = new Set<string>();
  for (const item of flattenItems(groups)) {
    for (const tag of item.tags) tags.add(tag);
  }
  return [...tags].sort();
}

/**
 * Keeps only the items carrying `tag`, plus any parent holding one.
 *
 * A bullet is only findable through the entry it hangs off, so an entry whose
 * child matched stays — otherwise filtering by a bullet's tag would hide every
 * result. A parent that matched on its own keeps only its matching children,
 * so the filter never shows a row the tag does not apply to.
 */
export function filterByTag(groups: LibraryGroup[], tag: string): LibraryGroup[] {
  const keep = (item: LibraryItem): LibraryItem | null => {
    const children = item.children.map(keep).filter((child) => child !== null);
    if (children.length > 0) return { ...item, children };
    return item.tags.includes(tag) ? { ...item, children: [] } : null;
  };

  return groups.map((group) => ({
    ...group,
    items: group.items.map(keep).filter((item) => item !== null),
  }));
}

/** Flattens the tree, parents before their children — one row per item. */
export function flattenItems(groups: LibraryGroup[]): LibraryItem[] {
  const out: LibraryItem[] = [];
  const walk = (items: LibraryItem[]) => {
    for (const item of items) {
      out.push(item);
      walk(item.children);
    }
  };
  for (const group of groups) walk(group.items);
  return out;
}
