/**
 * Content-library schema (SPEC §6.1, §12.3, §12.4, §15.2, §15.13).
 *
 * One `content-library.json` per profile holds *every* piece of content the
 * person has ever written; variants reference it by ID and never duplicate
 * text (§6.2). Every item therefore carries a stable `id` plus optional
 * `tags` for filtering and AI drafting (§6.1).
 *
 * Every field is defaulted so a freshly created profile — `{ "schemaVersion":
 * 1 }` and nothing else (§12.7) — parses cleanly.
 */
import { z } from "zod";

/** Stable identifier for a library item. Referenced by variants (§6.2). */
export const idSchema = z.string().min(1);

/** Optional tags for filtering / AI drafting (§6.1). */
const tags = z.array(z.string()).default([]);

/** Optional link fields — always rendered when present, never toggled (§6.4). */
const optionalUrl = z.url().nullable().default(null);

/**
 * A single bullet. `text` is a plain string carrying `*inline italic*`
 * markup (§16.3), parsed at render time rather than stored as segments.
 */
export const bulletSchema = z.object({
  id: idSchema,
  text: z.string(),
  tags,
});

/** About Me paragraph version, referenced via `options.aboutMeId` (§5.2, §15.2). */
export const aboutMeSchema = z.object({
  id: idSchema,
  key: z.string(),
  text: z.string(),
  tags,
});

/** One competency phrase; rendered pipe-separated, curated per item (§5.3, §12.3). */
export const competencySchema = z.object({
  id: idSchema,
  text: z.string(),
  tags,
});

/** Experience entry with individually curated bullets (§5.4). */
export const experienceSchema = z.object({
  id: idSchema,
  title: z.string(),
  company: z.string(),
  location: z.string(),
  dates: z.string(),
  bullets: z.array(bulletSchema).default([]),
  tags,
});

/** Project entry; `repoUrl`/`demoUrl` render whenever present (§5.5, §6.4). */
export const projectSchema = z.object({
  id: idSchema,
  title: z.string(),
  subtitle: z.string(),
  dates: z.string(),
  repoUrl: optionalUrl,
  demoUrl: optionalUrl,
  bullets: z.array(bulletSchema).default([]),
  tags,
});

/**
 * Education entry. Curated at entry level only — there is no bullet array
 * (§5.6); `description` renders as a single bullet, not a paragraph (§16.4).
 */
export const educationSchema = z.object({
  id: idSchema,
  institution: z.string(),
  degree: z.string(),
  dates: z.string(),
  description: z.string(),
  tags,
});

/** One skill inside a group — separately toggleable (§12.3). */
export const skillSchema = z.object({
  id: idSchema,
  text: z.string(),
  tags,
});

/** Skill group; curated at two levels, group and skill (§5.7, §12.3). */
export const skillGroupSchema = z.object({
  id: idSchema,
  label: z.string(),
  skills: z.array(skillSchema).default([]),
  tags,
});

/** Certification; `text` is one combined string rendered fully bold (§5.8). */
export const certificationSchema = z.object({
  id: idSchema,
  text: z.string(),
  dates: z.string(),
  credentialUrl: optionalUrl,
  tags,
});

/** Reference contact, rendered only in expanded mode (§5.9). */
export const recommendationSchema = z.object({
  id: idSchema,
  name: z.string(),
  role: z.string(),
  location: z.string(),
  email: z.string(),
  tags,
});

/** Language; two fields because the source sets them in different faces (§5.10). */
export const languageSchema = z.object({
  id: idSchema,
  language: z.string(),
  proficiency: z.string(),
  tags,
});

/**
 * A custom-section instance. It lives in the library, not inside a single
 * variant, so it is reusable across variants (§5.11, §12.4).
 */
export const customSectionSchema = z.object({
  id: idSchema,
  title: z.string(),
  paragraph: z.string().nullable().default(null),
  bullets: z.array(bulletSchema).default([]),
  tags,
});

/**
 * One extra contact link — a portfolio, X, Dev.to, Scholar (§5.1, §16.6).
 *
 * `text` is what prints, not a URL: the header sets `linkedin` and `github` as
 * display strings ("github.com/jordan-rivera-demo"), and a link that rendered as a full
 * `https://` would sit on the same line looking like a different kind of
 * thing. It carries an `id` so the manager can address one row of a list the
 * person reorders and deletes from — the same reason every library item has
 * one (§6.1), though no variant references it.
 *
 * `url` is where that text points, and it is stored rather than derived
 * (§18.1). The named fields can derive theirs — an email is a `mailto:`, a
 * GitHub handle has one home — but a portfolio or a Dev.to page is not
 * recoverable from "portfolio.example.com", so it needs a real field. `null`
 * prints exactly as before, which is what every link already on disk is.
 */
export const headerLinkSchema = z.object({
  id: idSchema,
  text: z.string(),
  url: optionalUrl,
});

/**
 * Contact block; minimal vs full display is a variant option, not data (§5.1).
 *
 * `linkedin` and `github` stay named fields rather than folding into `links`.
 * §5.1 lists them by name and §4.1's measured contact lines place them, so
 * collapsing them into the array would rewrite every profile on disk to buy
 * uniformity the render layer does not want. `links` is the open-ended tail
 * of that same line (§16.6).
 *
 * `title` is content, but whether it prints is a variant option — the same
 * split §5.1 already makes for full/minimal (see §16.6).
 */
export const headerSchema = z.object({
  name: z.string().default(""),
  title: z.string().default(""),
  location: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  linkedin: z.string().default(""),
  github: z.string().default(""),
  links: z.array(headerLinkSchema).default([]),
});

/** Current on-disk schema version for `content-library.json` (§15.13). */
export const LIBRARY_SCHEMA_VERSION = 1;

export const contentLibrarySchema = z.object({
  schemaVersion: z.literal(LIBRARY_SCHEMA_VERSION),
  // prefault, not default: Zod 4 uses a `default` value as-is, so
  // `.default({})` would skip headerSchema's own per-field defaults.
  header: headerSchema.prefault({}),
  aboutMe: z.array(aboutMeSchema).default([]),
  competencies: z.array(competencySchema).default([]),
  experience: z.array(experienceSchema).default([]),
  projects: z.array(projectSchema).default([]),
  education: z.array(educationSchema).default([]),
  skillGroups: z.array(skillGroupSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
  recommendations: z.array(recommendationSchema).default([]),
  languages: z.array(languageSchema).default([]),
  customSections: z.array(customSectionSchema).default([]),
});

export type Bullet = z.infer<typeof bulletSchema>;
export type AboutMe = z.infer<typeof aboutMeSchema>;
export type Competency = z.infer<typeof competencySchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type Certification = z.infer<typeof certificationSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type Language = z.infer<typeof languageSchema>;
export type CustomSection = z.infer<typeof customSectionSchema>;
export type HeaderLink = z.infer<typeof headerLinkSchema>;
export type Header = z.infer<typeof headerSchema>;
export type ContentLibrary = z.infer<typeof contentLibrarySchema>;
