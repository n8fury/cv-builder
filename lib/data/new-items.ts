/**
 * What "new content" means per section (SPEC §6.3, §12.3).
 *
 * §6.3 has one rule and no exceptions: anything typed in the editor is written
 * to the content library first, with a generated ID, and only then referenced
 * by the open variant. There is no unsaved, variant-local text.
 *
 * The fields a new item needs and the item those fields build are declared
 * here together, so the form cannot offer a field the builder ignores. A test
 * pins that by filling every declared field with a marker and requiring it to
 * surface in the built item.
 */
import type {
  AboutMe,
  Bullet,
  Certification,
  Competency,
  CustomSection,
  Education,
  Experience,
  Language,
  Project,
  Recommendation,
  Skill,
  SkillGroup,
} from "../schema/library";
import type { SectionType } from "../schema/variant";

export interface NewItemField {
  name: string;
  label: string;
  /** A textarea rather than an input — paragraphs and bullet text. */
  multiline?: boolean;
  /** Blank is allowed; the form only blocks on the rest. */
  optional?: boolean;
}

export interface NewItemSpec {
  /** What the button offers to add: "Add a job", "Add a bullet". */
  noun: string;
  fields: NewItemField[];
}

const text = (name: string, label: string, extra: Partial<NewItemField> = {}): NewItemField => ({
  name,
  label,
  ...extra,
});

/**
 * Entry-level additions, keyed by section type. Header is absent because it is
 * a single record on the library, not a list (§5.1) — there is nothing to add.
 */
export const NEW_ENTRY = {
  aboutMe: {
    noun: "About Me version",
    fields: [text("key", "Key"), text("text", "Paragraph", { multiline: true })],
  },
  competencies: {
    noun: "competency",
    fields: [text("text", "Phrase")],
  },
  experience: {
    noun: "job",
    fields: [
      text("title", "Title"),
      text("company", "Company"),
      text("location", "Location", { optional: true }),
      text("dates", "Dates", { optional: true }),
    ],
  },
  projects: {
    noun: "project",
    fields: [
      text("title", "Title"),
      text("subtitle", "Subtitle", { optional: true }),
      text("dates", "Dates", { optional: true }),
    ],
  },
  education: {
    noun: "education entry",
    fields: [
      text("institution", "Institution"),
      text("degree", "Degree"),
      text("dates", "Dates", { optional: true }),
      text("description", "Description", { multiline: true, optional: true }),
    ],
  },
  skills: {
    noun: "skill group",
    fields: [text("label", "Group label")],
  },
  certifications: {
    noun: "certification",
    fields: [text("text", "Certification"), text("dates", "Dates", { optional: true })],
  },
  languages: {
    noun: "language",
    fields: [text("language", "Language"), text("proficiency", "Proficiency", { optional: true })],
  },
  recommendations: {
    noun: "reference",
    fields: [
      text("name", "Name"),
      text("role", "Role", { optional: true }),
      text("location", "Location", { optional: true }),
      text("email", "Email", { optional: true }),
    ],
  },
  custom: {
    noun: "custom section",
    fields: [
      text("title", "Title"),
      text("paragraph", "Paragraph", { multiline: true, optional: true }),
    ],
  },
  // `satisfies`, not an annotation: the keys are still checked against
  // `SectionType`, but each entry stays concrete, so a call site that names one
  // does not have to handle an `undefined` that cannot occur.
} satisfies Partial<Record<SectionType, NewItemSpec>>;

/** The nested level: a bullet under an entry, a skill inside a group (§12.3). */
export const NEW_BULLET: NewItemSpec = {
  noun: "bullet",
  fields: [text("text", "Bullet", { multiline: true })],
};

export const NEW_SKILL: NewItemSpec = { noun: "skill", fields: [text("text", "Skill")] };

/** Typed field values straight off the form. */
export type NewItemValues = Record<string, string>;

const read = (values: NewItemValues, name: string): string => values[name]?.trim() ?? "";

/** A blank optional paragraph is `null`, which is what the schema stores. */
const readNullable = (values: NewItemValues, name: string): string | null => {
  const found = read(values, name);
  return found.length > 0 ? found : null;
};

export const build = {
  aboutMe: (id: string, v: NewItemValues): AboutMe => ({
    id,
    key: read(v, "key"),
    text: read(v, "text"),
    tags: [],
  }),
  competency: (id: string, v: NewItemValues): Competency => ({
    id,
    text: read(v, "text"),
    tags: [],
  }),
  experience: (id: string, v: NewItemValues): Experience => ({
    id,
    title: read(v, "title"),
    company: read(v, "company"),
    location: read(v, "location"),
    dates: read(v, "dates"),
    bullets: [],
    tags: [],
  }),
  project: (id: string, v: NewItemValues): Project => ({
    id,
    title: read(v, "title"),
    subtitle: read(v, "subtitle"),
    dates: read(v, "dates"),
    // Links are added later, from the library manager — §6.4 has no
    // per-variant toggle for them, so there is nothing to decide here.
    repoUrl: null,
    demoUrl: null,
    bullets: [],
    tags: [],
  }),
  education: (id: string, v: NewItemValues): Education => ({
    id,
    institution: read(v, "institution"),
    degree: read(v, "degree"),
    dates: read(v, "dates"),
    description: read(v, "description"),
    tags: [],
  }),
  skillGroup: (id: string, v: NewItemValues): SkillGroup => ({
    id,
    label: read(v, "label"),
    skills: [],
    tags: [],
  }),
  certification: (id: string, v: NewItemValues): Certification => ({
    id,
    text: read(v, "text"),
    dates: read(v, "dates"),
    credentialUrl: null,
    tags: [],
  }),
  language: (id: string, v: NewItemValues): Language => ({
    id,
    language: read(v, "language"),
    proficiency: read(v, "proficiency"),
    tags: [],
  }),
  recommendation: (id: string, v: NewItemValues): Recommendation => ({
    id,
    name: read(v, "name"),
    role: read(v, "role"),
    location: read(v, "location"),
    email: read(v, "email"),
    tags: [],
  }),
  customSection: (id: string, v: NewItemValues): CustomSection => ({
    id,
    title: read(v, "title"),
    paragraph: readNullable(v, "paragraph"),
    bullets: [],
    tags: [],
  }),
  bullet: (id: string, v: NewItemValues): Bullet => ({ id, text: read(v, "text"), tags: [] }),
  skill: (id: string, v: NewItemValues): Skill => ({ id, text: read(v, "text"), tags: [] }),
};

/** Whether a form's values satisfy every field the spec marks required. */
export function isComplete(spec: NewItemSpec, values: NewItemValues): boolean {
  return spec.fields.every((field) => field.optional || read(values, field.name).length > 0);
}
