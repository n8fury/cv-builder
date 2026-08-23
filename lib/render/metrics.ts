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
import type { HeaderMode, SectionType } from "@/lib/schema/variant";

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
 * §4.2's stand-in, used where neither source PDF offers a measurable gap —
 * these three section types do not appear in the detailed document at all.
 */
const PROVISIONAL_SPACE_BEFORE_PT = 27.2;

/**
 * Projects' space-before.
 *
 * Not measured, and — unlike the other stand-ins — not measurable from
 * either source. In the canonical detailed PDF the Projects heading opens
 * page 2 (`harness/golden.json`: y=725.23, the continuation-page position of
 * §4.1), so there is no preceding baseline to measure from. The basic PDF
 * (`harness/golden-basic.json`) does place it mid-page, at 34.72 below the
 * last Experience bullet — but that document's space-befores are not
 * interchangeable with the canonical one's:
 *
 *   Experience       27.44 / 27.44   identical
 *   Technical Skills 27.24 / 26.76   −0.48
 *   Core Competencies 25.03 / 29.02  +3.99
 *   Certifications   27.14 / 40.15   +13.01 — one 13pt line, an emptied
 *                                     Technical Skills group left in place
 *
 * A source that varies by ~4pt from the canonical on a gap both documents
 * measure cannot settle one only it measures, and 34.72 is 7.5pt clear of
 * every gap the canonical does give — outside §11.2's ±2pt either way.
 *
 * So the value stays at the stand-in, but it is now a *bounded* one rather
 * than an interpolation: Projects always follows a bullet list, and the two
 * canonical gaps that also follow a bullet list are Education's 26.97 and
 * Technical Skills' 27.24. 27.2 sits within 0.24 of both, so any value the
 * canonical document would have shown is inside tolerance of it.
 */
const PROJECTS_SPACE_BEFORE_PT = 27.2;

/**
 * Name baseline → About Me heading baseline, measured — the gap §4.2 leaves
 * out entirely.
 *
 * Measured to the *name*, not to the last contact line, because that is what
 * holds across both sources: the header block occupies a fixed slot and the
 * contact lines fill it, rather than pushing About Me down.
 *
 *   detailed (minimal, one contact line)   716.37 → 655.40 = 60.97
 *   basic    (full, two contact lines)     715.63 → 654.89 = 60.74
 *
 * The canonical figure is taken; the second document agrees to 0.23pt.
 */
export const NAME_BASELINE_TO_ABOUT_ME_PT = 60.97;

/**
 * About Me's space-before, derived per header mode from the measurement
 * above by subtracting the contact lines the mode draws (§5.1).
 *
 *   minimal  60.97 − 23.45          = 37.52  (exactly golden.json's 692.92 → 655.40)
 *   full     60.97 − 23.58 − 17.07  = 20.32  (golden-basic.json reads 20.09)
 *
 * Deriving rather than tabulating is what makes the two agree: a single
 * §4.2-style figure would be right for one mode and ~17pt wrong for the
 * other, since it is the header slot that is fixed, not the gap below it.
 */
export const ABOUT_ME_SPACE_BEFORE_PT: Record<HeaderMode, number> = {
  minimal: NAME_BASELINE_TO_ABOUT_ME_PT - NAME_TO_CONTACT_PT.minimal,
  full: NAME_BASELINE_TO_ABOUT_ME_PT - NAME_TO_CONTACT_PT.full - CONTACT_LINE_GAP_PT,
};

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
  // The minimal header is what the canonical document uses; a full header
  // overrides this in resume.css, off ABOUT_ME_SPACE_BEFORE_MARGIN_PT.full.
  aboutMe: ABOUT_ME_SPACE_BEFORE_PT.minimal,
  competencies: 25.03,
  experience: 27.44,
  projects: PROJECTS_SPACE_BEFORE_PT,
  education: 26.97,
  skills: 27.24,
  certifications: 27.14,
  languages: PROVISIONAL_SPACE_BEFORE_PT,
  recommendations: PROVISIONAL_SPACE_BEFORE_PT,
  custom: PROVISIONAL_SPACE_BEFORE_PT,
};

/**
 * Section types whose space-before is not a measurement.
 *
 * Projects stays listed: it is bounded by two canonical gaps rather than
 * interpolated between them, but neither source document measures it (see
 * PROJECTS_SPACE_BEFORE_PT).
 */
export const PROVISIONAL_SPACE_BEFORE: ReadonlySet<SectionType> = new Set([
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

/** The three section types built from title/subtitle/dates entries (§5.4-§5.6). */
export type EntryKind = "experience" | "projects" | "education";

/**
 * Last baseline of one entry → title baseline of the next.
 *
 * §4.4 measures Experience and Projects only: the source has a single
 * Education entry, so it offers no Education gap to read. Experience's value
 * stands in — the two are the same shape, title over subtitle over one
 * bullet — until Phase 3 has a second entry to measure (plan Task 3.4).
 */
export const ENTRY_TO_NEXT_ENTRY_PT: Record<EntryKind, number> = {
  experience: 28.17,
  projects: 25.41,
  education: 28.17,
};

/** Entry kinds whose entry-to-entry gap is still a stand-in. */
export const PROVISIONAL_ENTRY_GAP: ReadonlySet<EntryKind> = new Set(["education"]);

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
 * Heading baseline → its underline. Measured across all seven headings in the
 * source: 5.152, 5.153, 5.153, 5.153, 5.164, 5.153 — and one outlier, Core
 * Competencies at 6.076. The rule is not a text item, so §11.2's harness never
 * sees it; one constant at the consistent value beats reproducing a 0.9pt
 * hand-nudge in a single section.
 */
export const HEADING_BASELINE_TO_RULE_PT = 5.15;

/**
 * The dates/location block does **not** share a baseline with the
 * title/company block. §4.4 records the two-line case: it sits consistently
 * 2.31pt higher, in both source documents, which exceeds §11.2's ±2pt
 * tolerance and so is implemented rather than ignored.
 *
 * A one-line right block is offset the other way — measured in Phase 3, where
 * the two-line value alone left every Projects and Education date ~9.8pt high:
 *
 *   Experience (dates over location, two lines)  −2.31, −2.31
 *   Projects   (dates alone, one line)           +7.47, +7.47
 *   Education  (dates alone, one line)           +7.48
 *
 * Keyed on the right block's own line count rather than on section type: what
 * moves the block is how tall it is against the two-line left column, so a
 * Projects entry carrying repo/demo links (§5.5) belongs with Experience.
 * Positive is below the title's baseline, negative above.
 */
export const RIGHT_BLOCK_OFFSET_PT = {
  oneLine: 7.47,
  twoLine: -2.31,
} as const;

/**
 * Bullets are consecutive leading-height lines with no extra gap between
 * them (432.09 → 420.09 → 408.09), so this is 0 by measurement, not by
 * omission (§4.5).
 */
export const BULLET_TO_BULLET_EXTRA_PT = 0;

/* ── Baseline → CSS margin conversion ──────────────────────────────── */

/**
 * Ascent as a fraction of the em, read from each TTF's `hhea` table — the
 * metrics Chrome uses for line-box layout on Windows (each face's
 * `usWinAscent` is identical, and only Charis SIL sets USE_TYPO_METRICS,
 * where its typo and hhea values agree anyway).
 *
 * Charter's roman and bold faces share an ascent, so a bold heading and
 * roman body text sit identically within their line boxes.
 */
export const ASCENT_RATIO = {
  charter: 1972 / 2048,
  charterItalic: 2007 / 2048,
  charisItalic: 2450 / 2048,
} as const;

/** Descent (positive, below the baseline) as a fraction of the em. */
export const DESCENT_RATIO = {
  charter: 483 / 2048,
  charterItalic: 483 / 2048,
  charisItalic: 900 / 2048,
} as const;

/** Which face a piece of text is set in, for line-box purposes. */
export type Face = keyof typeof ASCENT_RATIO;

/**
 * Distance from a block's top border edge down to its first baseline.
 *
 * CSS centers the font's content area (ascent + descent) inside the line
 * box, so the leftover leading is split evenly above and below — a
 * line-height *tighter* than the content area yields a negative half, which
 * is exactly the case here (Charter's content area is 1.199em against our
 * 1.2 ratio at 10pt, and tighter still for the 12pt headings).
 */
export function boxTopToBaseline(
  fontSizePt: number,
  lineHeightPt: number,
  face: Face = "charter",
): number {
  const contentHeight =
    (ASCENT_RATIO[face] + DESCENT_RATIO[face]) * fontSizePt;
  const halfLeading = (lineHeightPt - contentHeight) / 2;
  return halfLeading + ASCENT_RATIO[face] * fontSizePt;
}

/** Line-box metrics of a block of text. */
export type BlockMetrics = {
  fontSizePt: number;
  lineHeightPt: number;
  face?: Face;
};

/**
 * Convert a §4 baseline-to-baseline target into the CSS top margin that
 * produces it.
 *
 * Every §4 measurement is baseline-to-baseline, but CSS margins run
 * border-edge to border-edge. The two differ by how far each block's
 * baseline sits from its own edge:
 *
 *     margin = target
 *            − (previous block's last baseline → its bottom edge)
 *            − (this block's top edge → its first baseline)
 *
 * When both blocks share a font size and leading those two terms sum to
 * exactly one line height and the ascent cancels out — so a 12.00pt target
 * between 12pt-leaded blocks needs no margin at all, which is why §4.4's
 * entry title → company gap is invisible in the stylesheet. Pass `previous`
 * when the blocks differ (body text into a 12pt heading, say); there the
 * ascent does not cancel and must be accounted for.
 *
 * A negative result is meaningful, not an error: it is how §4.4's 2.31pt
 * right-block lift and any tighter-than-one-line target get expressed.
 */
export function baselineGap(
  targetPt: number,
  fontSizePt: number,
  lineHeightPt: number,
  options: { face?: Face; previous?: BlockMetrics } = {},
): number {
  const face = options.face ?? "charter";
  const previous = options.previous ?? { fontSizePt, lineHeightPt, face };

  const previousBaselineToBottom =
    previous.lineHeightPt -
    boxTopToBaseline(
      previous.fontSizePt,
      previous.lineHeightPt,
      previous.face ?? "charter",
    );
  const topToThisBaseline = boxTopToBaseline(fontSizePt, lineHeightPt, face);

  return targetPt - previousBaselineToBottom - topToThisBaseline;
}

/* ── Header geometry (§4.1, §5.1), derived ─────────────────────────── */

/** Content top edge → name baseline on page 1. */
export const CONTENT_TOP_TO_NAME_BASELINE_PT =
  CONTENT_TOP_Y_PT - NAME_BASELINE_Y_PT;

/** The line height that puts a block's first baseline at `targetPt` below its
 *  top edge — the inverse of `boxTopToBaseline()`. */
export function lineHeightForBaseline(
  fontSizePt: number,
  targetPt: number,
  face: Face = "charter",
): number {
  const contentHeight = (ASCENT_RATIO[face] + DESCENT_RATIO[face]) * fontSizePt;
  return contentHeight + 2 * (targetPt - ASCENT_RATIO[face] * fontSizePt);
}

/**
 * The name's line height is not a measured value — no second line of 24.9pt
 * text exists to measure one from. It is solved for: the name block sits flush
 * against the top padding edge, so its line height is whatever puts its
 * baseline at y=716.37 (§4.1's "box top overshoots the top margin by ~3.4pt").
 */
export const NAME_LINE_HEIGHT_PT = lineHeightForBaseline(
  NAME_FONT_SIZE_PT,
  CONTENT_TOP_TO_NAME_BASELINE_PT,
);

/** Name baseline → first contact baseline, as a CSS margin, per header mode. */
export const NAME_TO_CONTACT_MARGIN_PT: Record<"full" | "minimal", number> = {
  minimal: baselineGap(
    NAME_TO_CONTACT_PT.minimal,
    BODY_FONT_SIZE_PT,
    BODY_LEADING_PT,
    { previous: { fontSizePt: NAME_FONT_SIZE_PT, lineHeightPt: NAME_LINE_HEIGHT_PT } },
  ),
  full: baselineGap(
    NAME_TO_CONTACT_PT.full,
    BODY_FONT_SIZE_PT,
    BODY_LEADING_PT,
    { previous: { fontSizePt: NAME_FONT_SIZE_PT, lineHeightPt: NAME_LINE_HEIGHT_PT } },
  ),
};

/* ── Section heading geometry (§4.2, §4.5), derived ────────────────── */

/**
 * The heading's line height, solved rather than chosen — the same technique
 * the name block uses, and for the same reason.
 *
 * Everywhere on a page, a heading is placed by a baseline target and its own
 * box height cancels out. At a page break it does not: §4.1 measures the
 * continuation page's first heading with "its box top lands exactly on the
 * 55pt margin" and its baseline 11.77 below. Chromium puts that baseline
 * 9.75pt down for a 12pt heading at one body leading — it rounds font ascent
 * and descent to whole pixels — which stranded page two 2.02pt high, past
 * §11.2's tolerance. Solving the line height for the measured 11.77 fixes the
 * continuation page and leaves page one untouched, since every gap there is
 * derived from this value rather than assuming it.
 */
export const HEADING_LINE_HEIGHT_PT = lineHeightForBaseline(
  HEADING_FONT_SIZE_PT,
  TOP_MARGIN_TO_HEADING_BASELINE_PT,
);

/**
 * Padding under the heading text that carries its border down to the measured
 * rule offset. The line box alone only reaches 1.64pt past the baseline.
 */
export const HEADING_RULE_PADDING_PT =
  HEADING_BASELINE_TO_RULE_PT -
  (HEADING_LINE_HEIGHT_PT -
    boxTopToBaseline(HEADING_FONT_SIZE_PT, HEADING_LINE_HEIGHT_PT));

/**
 * §4.2's space-before targets, as CSS top margins on the section wrapper.
 *
 * The gap always runs from a body line (10pt at 12pt leading — every section
 * ends in body text, as does the header's contact line) down to a 12pt
 * heading, so one conversion serves every section type.
 */
export const SPACE_BEFORE_MARGIN_PT: Record<SectionType, number> =
  Object.fromEntries(
    Object.entries(SPACE_BEFORE_PT).map(([section, target]) => [
      section,
      // The header draws no heading and opens the page flush against the top
      // padding — it has no gap above it to convert.
      section === "header"
        ? 0
        : baselineGap(target, HEADING_FONT_SIZE_PT, HEADING_LINE_HEIGHT_PT, {
            previous: { fontSizePt: BODY_FONT_SIZE_PT, lineHeightPt: BODY_LEADING_PT },
          }),
    ]),
  ) as Record<SectionType, number>;

/**
 * About Me's space-before as a CSS top margin, per header mode.
 *
 * `SPACE_BEFORE_MARGIN_PT.aboutMe` carries the minimal-header case, since
 * that is what the canonical document sets and what §11.2 gates on; this is
 * the pair, so the stylesheet can override it when the header ahead of About
 * Me is in full mode and draws a second contact line.
 */
export const ABOUT_ME_SPACE_BEFORE_MARGIN_PT: Record<HeaderMode, number> =
  Object.fromEntries(
    Object.entries(ABOUT_ME_SPACE_BEFORE_PT).map(([mode, target]) => [
      mode,
      baselineGap(target, HEADING_FONT_SIZE_PT, HEADING_LINE_HEIGHT_PT, {
        previous: { fontSizePt: BODY_FONT_SIZE_PT, lineHeightPt: BODY_LEADING_PT },
      }),
    ]),
  ) as Record<HeaderMode, number>;

/**
 * A heading's baseline → the bottom edge of its box, rule included. What
 * follows a heading is positioned from here, not from the baseline.
 */
export const HEADING_BASELINE_TO_BOX_BOTTOM_PT =
  HEADING_LINE_HEIGHT_PT -
  boxTopToBaseline(HEADING_FONT_SIZE_PT, HEADING_LINE_HEIGHT_PT) +
  HEADING_RULE_PADDING_PT +
  HEADING_RULE_WEIGHT_PT;

/**
 * §4.3's heading → first content baseline targets, as CSS top margins on the
 * section body. The leading below varies (§4.5's 13pt sections), so each
 * section converts against its own.
 */
export const HEADING_TO_CONTENT_MARGIN_PT: Record<SectionType, number> =
  Object.fromEntries(
    Object.entries(HEADING_TO_CONTENT_PT).map(([section, target]) => [
      section,
      section === "header"
        ? 0
        : target -
          HEADING_BASELINE_TO_BOX_BOTTOM_PT -
          boxTopToBaseline(
            BODY_FONT_SIZE_PT,
            leadingFor(section as SectionType),
          ),
    ]),
  ) as Record<SectionType, number>;

/* ── Entry geometry (§4.4), derived ────────────────────────────────── */

/**
 * Title → company as a CSS margin. The two lines are set in different faces
 * (Charter bold, then Charis SIL Italic), and Charis sits deeper in its line
 * box, so the ascent does not quite cancel the way it does within one face.
 */
export const TITLE_TO_SUBTITLE_MARGIN_PT = baselineGap(
  TITLE_TO_SUBTITLE_PT,
  BODY_FONT_SIZE_PT,
  BODY_LEADING_PT,
  {
    face: "charisItalic",
    previous: { fontSizePt: BODY_FONT_SIZE_PT, lineHeightPt: BODY_LEADING_PT },
  },
);

/**
 * Company (Charis) → first bullet (Charter), as a CSS margin. Education
 * shares Experience's measured 19.29 — §4.4 gives the two one row.
 */
export const SUBTITLE_TO_BULLETS_MARGIN_PT: Record<EntryKind, number> = {
  experience: baselineGap(
    COMPANY_TO_FIRST_BULLET_PT,
    BODY_FONT_SIZE_PT,
    BODY_LEADING_PT,
    { previous: { fontSizePt: BODY_FONT_SIZE_PT, lineHeightPt: BODY_LEADING_PT, face: "charisItalic" } },
  ),
  projects: baselineGap(
    SUBTITLE_TO_FIRST_BULLET_PT,
    BODY_FONT_SIZE_PT,
    BODY_LEADING_PT,
    { previous: { fontSizePt: BODY_FONT_SIZE_PT, lineHeightPt: BODY_LEADING_PT, face: "charisItalic" } },
  ),
  education: baselineGap(
    COMPANY_TO_FIRST_BULLET_PT,
    BODY_FONT_SIZE_PT,
    BODY_LEADING_PT,
    { previous: { fontSizePt: BODY_FONT_SIZE_PT, lineHeightPt: BODY_LEADING_PT, face: "charisItalic" } },
  ),
};

/** Entry → next entry, as a CSS margin. Both ends are body-face bullets. */
export const ENTRY_GAP_MARGIN_PT: Record<EntryKind, number> = Object.fromEntries(
  Object.entries(ENTRY_TO_NEXT_ENTRY_PT).map(([kind, target]) => [
    kind,
    baselineGap(target, BODY_FONT_SIZE_PT, BODY_LEADING_PT),
  ]),
) as Record<EntryKind, number>;

/**
 * Recommendation entry → next entry, as a CSS margin.
 *
 * Not a measurement and never will be: neither source document has a
 * Recommendations section, so Phase 3 has nothing to read it from either. It
 * borrows Experience's gap — the closest stacked-entry shape in the document
 * — rather than introducing a number of its own (§5.9).
 */
export const RECOMMENDATION_GAP_MARGIN_PT = ENTRY_GAP_MARGIN_PT.experience;

/**
 * Charter's left side bearing on body text: the ink starts 1.18pt right of
 * the box (§4.5). The bullet marker's box is placed so its own ink lands on
 * the measured marker x.
 */
export const BODY_SIDE_BEARING_PT = 1.18;

/** Box x for the bullet marker, relative to the content box left edge. */
export const BULLET_MARKER_BOX_X_PT =
  BULLET_MARKER_OFFSET_PT - BODY_SIDE_BEARING_PT;
