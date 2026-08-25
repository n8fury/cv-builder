/**
 * Variant schema (SPEC §6.2, §12.2, §12.5).
 *
 * A variant is pure curation: it references content-library IDs and never
 * carries raw text (§6.2). Three levels — section, entry, bullet — all use
 * the same pattern: an item is in the list or it isn't, so no `visible` flag
 * exists below the section level. Ordering is array position only; there is
 * deliberately no `order` field (§15.3).
 *
 * Objects are strict: variants are also written by the n8n integration (§10),
 * and a mistyped key there must fail loudly rather than be silently dropped.
 */
import { z } from "zod";

import { idSchema } from "./library";

/** Reference to a library item by ID. */
const itemIds = z.array(idSchema).default([]);

/** An entry curated as a whole, with no bullets of its own (§5.6, §5.8, §5.9). */
const entryRefSchema = z.strictObject({
  id: idSchema,
});

/** An entry plus the subset of its bullets this variant includes (§6.2). */
const entryWithBulletsSchema = z.strictObject({
  id: idSchema,
  bullets: itemIds,
});

/** Sections with nothing to configure still carry `options: {}` (§12.2). */
const noOptions = z.strictObject({}).default({});

/** Header display mode — `mode`, never `variant` (§5.1, §15.4). */
export const headerModeSchema = z.enum(["full", "minimal"]);

/** Recommendations display mode (§5.9). */
export const recommendationsModeSchema = z.enum(["collapsed", "expanded"]);

/**
 * `showTitle` defaults rather than being required: every variant already on
 * disk was written without it, and a strict object would reject them all. The
 * default is `false`, so an untouched variant renders exactly as before —
 * adding the title is a decision, never something that happens to a CV (§16.6).
 */
export const headerSectionSchema = z.strictObject({
  type: z.literal("header"),
  visible: z.boolean(),
  options: z.strictObject({
    mode: headerModeSchema,
    showTitle: z.boolean().default(false),
  }),
});

/** References one of the library's About Me versions by ID (§5.2, §15.2). */
export const aboutMeSectionSchema = z.strictObject({
  type: z.literal("aboutMe"),
  visible: z.boolean(),
  options: z.strictObject({ aboutMeId: idSchema }),
});

/** Competencies are curated per phrase, like bullets (§12.3). */
export const competenciesSectionSchema = z.strictObject({
  type: z.literal("competencies"),
  visible: z.boolean(),
  options: noOptions,
  items: itemIds,
});

/**
 * Whether a long entry may be cut across a page break (§11.5, §18.2).
 *
 * Defaults rather than being required, for `showTitle`'s reason: every variant
 * on disk was written without it, and a strict object would reject them all.
 * The default is `false` — the §11.5 atom, unchanged — so an untouched variant
 * paginates exactly as before, which is also what keeps the §11.2 goldens
 * valid without re-baselining.
 *
 * Offered on Experience and Projects only: they are the two sections whose
 * entries carry enough bullets to be worth splitting. Education is a head and
 * one description bullet, and Recommendations has its own atom.
 */
const splitEntries = z
  .strictObject({ splitEntries: z.boolean().default(false) })
  .default({ splitEntries: false });

export const experienceSectionSchema = z.strictObject({
  type: z.literal("experience"),
  visible: z.boolean(),
  options: splitEntries,
  entries: z.array(entryWithBulletsSchema).default([]),
});

export const projectsSectionSchema = z.strictObject({
  type: z.literal("projects"),
  visible: z.boolean(),
  options: splitEntries,
  entries: z.array(entryWithBulletsSchema).default([]),
});

/** Entry-level curation only — Education entries have no bullet array (§5.6). */
export const educationSectionSchema = z.strictObject({
  type: z.literal("education"),
  visible: z.boolean(),
  options: noOptions,
  entries: z.array(entryRefSchema).default([]),
});

/** Two-level curation: which groups, and which skills within each (§12.3). */
export const skillsSectionSchema = z.strictObject({
  type: z.literal("skills"),
  visible: z.boolean(),
  options: noOptions,
  groups: z
    .array(
      z.strictObject({
        id: idSchema,
        skills: itemIds,
      }),
    )
    .default([]),
});

export const certificationsSectionSchema = z.strictObject({
  type: z.literal("certifications"),
  visible: z.boolean(),
  options: noOptions,
  entries: z.array(entryRefSchema).default([]),
});

/** Not individually curated — whole-section `visible` only (§12.3, §15.6). */
export const languagesSectionSchema = z.strictObject({
  type: z.literal("languages"),
  visible: z.boolean(),
  options: noOptions,
});

/** In expanded mode, individual entries are curated by ID (§5.9, §15.5). */
export const recommendationsSectionSchema = z.strictObject({
  type: z.literal("recommendations"),
  visible: z.boolean(),
  options: z.strictObject({ mode: recommendationsModeSchema }),
  entries: z.array(entryRefSchema).default([]),
});

/**
 * Points at a custom-section library item. Multiple instances per variant are
 * just multiple entries of this type, ordered by array position (§12.4).
 */
export const customSectionRefSchema = z.strictObject({
  type: z.literal("custom"),
  visible: z.boolean(),
  options: z.strictObject({ customSectionId: idSchema }),
});

export const sectionSchema = z.discriminatedUnion("type", [
  headerSectionSchema,
  aboutMeSectionSchema,
  competenciesSectionSchema,
  experienceSectionSchema,
  projectsSectionSchema,
  educationSectionSchema,
  skillsSectionSchema,
  certificationsSectionSchema,
  languagesSectionSchema,
  recommendationsSectionSchema,
  customSectionRefSchema,
]);

/**
 * Every section type, in the union's declaration order. Derived from the
 * schema so a new section type cannot be added here and forgotten there
 * (or vice versa) — the render metrics iterate this list.
 */
export const SECTION_TYPES = sectionSchema.options.map(
  (option) => option.shape.type.value,
);

/** Current on-disk schema version for variant files (§15.13). */
export const VARIANT_SCHEMA_VERSION = 1;

/**
 * The variant file itself. The filename slug doubles as the record's id, so
 * there is no `id` field (§12.5).
 */
export const variantSchema = z.strictObject({
  schemaVersion: z.literal(VARIANT_SCHEMA_VERSION),
  tag: z.string().min(1),
  label: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  sections: z.array(sectionSchema).default([]),
});

export type HeaderMode = z.infer<typeof headerModeSchema>;
export type RecommendationsMode = z.infer<typeof recommendationsModeSchema>;
export type VariantSection = z.infer<typeof sectionSchema>;
export type SectionType = VariantSection["type"];
export type Variant = z.infer<typeof variantSchema>;
