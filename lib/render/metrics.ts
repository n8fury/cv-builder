/**
 * Every measured value from SPEC §4, in one place.
 *
 * These numbers were extracted from the canonical detailed PDF
 * (`data/reference/resume-reference-detailed.pdf`) via pdfjs. They are
 * exact, not design choices — do not round, average, or "improve" them.
 *
 * All spacing is **baseline-to-baseline in points**, per §4. Where §11.3's
 * box-edge model disagrees, §4 wins. Converting a baseline delta into a CSS
 * margin is `baselineGap()`'s job, not the caller's.
 *
 * This module is the single source of these values: `resume.css` derives its
 * custom properties from here rather than restating them, so a measurement
 * changes in exactly one place.
 */
import type { SectionType } from "@/lib/schema/variant";

/* ── Page setup (§2, §4.1) ─────────────────────────────────────────── */

/** US Letter, in points. */
export const PAGE_WIDTH_PT = 612;
export const PAGE_HEIGHT_PT = 792;

/** Uniform on all four sides; applied as padding on the wrapper, never as a
 *  Puppeteer PDF margin (§8). */
export const PAGE_MARGIN_PT = 55;

/** Content box: x 55 → 557 (§4.1). Derived so the two can never drift. */
export const CONTENT_LEFT_PT = PAGE_MARGIN_PT;
export const CONTENT_RIGHT_PT = PAGE_WIDTH_PT - PAGE_MARGIN_PT;
export const CONTENT_WIDTH_PT = CONTENT_RIGHT_PT - CONTENT_LEFT_PT;

/** Top margin edge (§4.1). */
export const CONTENT_TOP_Y_PT = PAGE_HEIGHT_PT - PAGE_MARGIN_PT;

/**
 * Top margin → first heading baseline on a continuation page (§4.1).
 * Equals the 12pt heading's ascent: its box top lands exactly on the margin.
 */
export const TOP_MARGIN_TO_HEADING_BASELINE_PT = 11.77;

/* ── Type sizes (§3) ───────────────────────────────────────────────── */

export const NAME_FONT_SIZE_PT = 24.9;
export const HEADING_FONT_SIZE_PT = 12;
export const BODY_FONT_SIZE_PT = 10;

/* ── Header (§4.1, §5.1) ───────────────────────────────────────────── */

/** Name baseline on page 1 — its box top overshoots the top margin by ~3.4pt. */
export const NAME_BASELINE_Y_PT = 716.37;

/** Name baseline → first contact line, per header mode (§5.1). */
export const NAME_TO_CONTACT_PT: Record<"full" | "minimal", number> = {
  minimal: 23.45,
  full: 23.58,
};

/** Contact line 1 → contact line 2 (full header only). */
export const CONTACT_LINE_GAP_PT = 17.07;

/* ── Leading (§4.5) ────────────────────────────────────────────────── */

/** Body and bullets: 10pt × 1.2, confirmed exact (§3). */
export const BODY_LEADING_PT = 12.0;

/**
 * Technical Skills, Certifications, and Languages run at 13pt, not 12pt —
 * §3's "1.2 ratio everywhere" is wrong for these three (§4.5).
 */
export const WIDE_LEADING_PT = 13.0;

const WIDE_LEADING_SECTIONS: ReadonlySet<SectionType> = new Set([
  "skills",
  "certifications",
  "languages",
]);

/** Line leading for a section, in points. */
export function leadingFor(section: SectionType): number {
  return WIDE_LEADING_SECTIONS.has(section) ? WIDE_LEADING_PT : BODY_LEADING_PT;
}

/* ── Per-section space-before (§4.2, §16.1) ────────────────────────── */

/**
 * §4.2's interpolated stand-in, used where the detailed PDF offers no
 * measurable gap — Projects falls after a page break there, and the other
 * four section types do not appear in it at all. Every use of it is replaced
 * with a real measurement in Phase 3 (plan Task 3.4).
 */
const PROVISIONAL_SPACE_BEFORE_PT = 27.2;

/**
 * Previous section's last baseline → this heading's baseline.
 *
 * Encoded per section type and deliberately **not** averaged into one
 * constant (§16.1): a shared value fails §11.2's ±2pt harness against
 * sections that were never sampled.
 */
export const SPACE_BEFORE_PT: Record<SectionType, number> = {
  // The header opens the page; its position comes from §4.1, not a gap.
  header: 0,
  aboutMe: PROVISIONAL_SPACE_BEFORE_PT,
  competencies: 25.03,
  experience: 27.44,
  projects: PROVISIONAL_SPACE_BEFORE_PT,
  education: 26.97,
  skills: 27.24,
  certifications: 27.14,
  languages: PROVISIONAL_SPACE_BEFORE_PT,
  recommendations: PROVISIONAL_SPACE_BEFORE_PT,
  custom: PROVISIONAL_SPACE_BEFORE_PT,
};

/** Section types whose space-before is still the interpolated stand-in. */
export const PROVISIONAL_SPACE_BEFORE: ReadonlySet<SectionType> = new Set([
  "aboutMe",
  "projects",
  "languages",
  "recommendations",
  "custom",
]);

/* ── Per-section heading → first content baseline (§4.3) ───────────── */

/**
 * Also varies by section type; the old single "6.3pt underline → content"
 * figure reproduces none of these (§4.3).
 */
export const HEADING_TO_CONTENT_PT: Record<SectionType, number> = {
  // No heading is drawn above the header block.
  header: 0,
  aboutMe: 17.28,
  competencies: 20.1,
  experience: 18.17,
  projects: 15.28,
  education: 18.17,
  skills: 16.93,
  certifications: 16.92,
  // Unsampled in §4.3 — stand in with the measured value for the section
  // each one is shaped like, pending Phase 3 (plan Task 3.4).
  languages: 16.93, // label/value lines at 13pt leading, like Technical Skills
  recommendations: 18.17, // stacked entries, like Experience
  custom: 18.17, // paragraph and/or bullets, like Experience
};

/** Section types whose heading → content gap is still a stand-in. */
export const PROVISIONAL_HEADING_TO_CONTENT: ReadonlySet<SectionType> = new Set(
  ["languages", "recommendations", "custom"],
);

/* ── Within and between entries (§4.4) ─────────────────────────────── */

/** Entry title → company (Experience/Education) or subtitle (Projects). */
export const TITLE_TO_SUBTITLE_PT = 12.0;

/** Company → first bullet (Experience, Education). */
export const COMPANY_TO_FIRST_BULLET_PT = 19.29;

/** Subtitle → first bullet (Projects). */
export const SUBTITLE_TO_FIRST_BULLET_PT = 22.19;

/** Last baseline of one entry → title baseline of the next. */
export const ENTRY_TO_NEXT_ENTRY_PT: Record<"experience" | "projects", number> =
  {
    experience: 28.17,
    projects: 25.41,
  };

/* ── Bullets and rules (§4.4, §4.5) ────────────────────────────────── */

/**
 * Bullet marker x, relative to the 55pt margin. Body text itself sits at
 * +1.18 side bearing, so the marker is +10.0 relative to body text (§4.5).
 */
export const BULLET_MARKER_OFFSET_PT = 11.18;

/**
 * Wrapped bullet lines hang +20.0 from body text x. Omitted from every
 * earlier draft of the spec and essential to reproducing the source (§4.5).
 */
export const HANGING_INDENT_PT = 20.0;

/** Section heading underline: 0.4pt, spanning the full content width (§4.5). */
export const HEADING_RULE_WEIGHT_PT = 0.4;

/**
 * The dates/location block does **not** share a baseline with the
 * title/company block — it sits consistently 2.31pt higher, in both source
 * documents. That exceeds §11.2's ±2pt tolerance, so it is implemented
 * rather than ignored. Applies to Experience, Projects, and Education (§4.4).
 */
export const RIGHT_BLOCK_LIFT_PT = 2.31;

/**
 * Bullets are consecutive leading-height lines with no extra gap between
 * them (432.09 → 420.09 → 408.09), so this is 0 by measurement, not by
 * omission (§4.5).
 */
export const BULLET_TO_BULLET_EXTRA_PT = 0;
