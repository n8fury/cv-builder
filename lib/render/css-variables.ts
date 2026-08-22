/**
 * Generates the resume stylesheet's `:root` block from `metrics.ts`.
 *
 * The measurements live in exactly one place (SPEC §4, encoded in
 * `metrics.ts`); this projects them into CSS custom properties so
 * `resume.css` never restates a number. `npm run build:resume-css` writes
 * the result into the stylesheet between the generated markers, and
 * `css-variables.test.ts` fails if the committed file drifts from what this
 * module would produce.
 */
import { SECTION_TYPES, type SectionType } from "../schema/variant";

import {
  BODY_FONT_SIZE_PT,
  BODY_LEADING_PT,
  BULLET_MARKER_OFFSET_PT,
  BULLET_TO_BULLET_EXTRA_PT,
  COMPANY_TO_FIRST_BULLET_PT,
  CONTACT_LINE_GAP_PT,
  CONTENT_WIDTH_PT,
  ENTRY_TO_NEXT_ENTRY_PT,
  HANGING_INDENT_PT,
  HEADING_FONT_SIZE_PT,
  HEADING_RULE_WEIGHT_PT,
  HEADING_TO_CONTENT_PT,
  NAME_FONT_SIZE_PT,
  NAME_LINE_HEIGHT_PT,
  NAME_TO_CONTACT_MARGIN_PT,
  NAME_TO_CONTACT_PT,
  PAGE_HEIGHT_PT,
  PAGE_MARGIN_PT,
  PAGE_WIDTH_PT,
  RIGHT_BLOCK_LIFT_PT,
  SPACE_BEFORE_PT,
  SUBTITLE_TO_FIRST_BULLET_PT,
  TITLE_TO_SUBTITLE_PT,
  TOP_MARGIN_TO_HEADING_BASELINE_PT,
  WIDE_LEADING_PT,
} from "./metrics";

export const GENERATED_START = "/* generated from lib/render/metrics.ts — do not edit by hand */";
export const GENERATED_END = "/* end generated */";

/** `aboutMe` → `about-me`, so custom properties read as CSS, not TypeScript. */
function kebab(sectionType: SectionType): string {
  return sectionType.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * Points, with no trailing zeros; a bare `0` needs no unit in CSS. Derived
 * values (the baseline→margin conversions) carry float noise well below a
 * thousandth of a point, so they are rounded there — measured values from §4
 * never have that many places and pass through untouched.
 */
function pt(value: number): string {
  return value === 0 ? "0" : `${Number(value.toFixed(3))}pt`;
}

function declarations(): string[] {
  const lines: string[] = [];
  const add = (name: string, value: number) =>
    lines.push(`  --${name}: ${pt(value)};`);
  const group = (label: string) => lines.push("", `  /* ${label} */`);

  lines.push("  /* Page setup (§2, §4.1) */");
  add("page-width", PAGE_WIDTH_PT);
  add("page-height", PAGE_HEIGHT_PT);
  add("page-margin", PAGE_MARGIN_PT);
  add("content-width", CONTENT_WIDTH_PT);

  group("Type sizes (§3)");
  add("font-size-name", NAME_FONT_SIZE_PT);
  add("font-size-heading", HEADING_FONT_SIZE_PT);
  add("font-size-body", BODY_FONT_SIZE_PT);

  group("Leading (§4.5) — 13pt for skills, certifications, languages");
  add("leading-body", BODY_LEADING_PT);
  add("leading-wide", WIDE_LEADING_PT);

  group("Header (§4.1, §5.1)");
  add("top-margin-to-heading-baseline", TOP_MARGIN_TO_HEADING_BASELINE_PT);
  add("name-line-height", NAME_LINE_HEIGHT_PT);
  add("name-to-contact-minimal", NAME_TO_CONTACT_PT.minimal);
  add("name-to-contact-full", NAME_TO_CONTACT_PT.full);
  add("name-to-contact-margin-minimal", NAME_TO_CONTACT_MARGIN_PT.minimal);
  add("name-to-contact-margin-full", NAME_TO_CONTACT_MARGIN_PT.full);
  add("contact-line-gap", CONTACT_LINE_GAP_PT);

  group("Per-section space-before (§4.2, §16.1)");
  for (const section of SECTION_TYPES) {
    add(`space-before-${kebab(section)}`, SPACE_BEFORE_PT[section]);
  }

  group("Per-section heading → first content baseline (§4.3)");
  for (const section of SECTION_TYPES) {
    add(`heading-to-content-${kebab(section)}`, HEADING_TO_CONTENT_PT[section]);
  }

  group("Within and between entries (§4.4)");
  add("title-to-subtitle", TITLE_TO_SUBTITLE_PT);
  add("company-to-first-bullet", COMPANY_TO_FIRST_BULLET_PT);
  add("subtitle-to-first-bullet", SUBTITLE_TO_FIRST_BULLET_PT);
  add("entry-gap-experience", ENTRY_TO_NEXT_ENTRY_PT.experience);
  add("entry-gap-projects", ENTRY_TO_NEXT_ENTRY_PT.projects);
  add("right-block-lift", RIGHT_BLOCK_LIFT_PT);

  group("Bullets and rules (§4.4, §4.5)");
  add("bullet-marker-offset", BULLET_MARKER_OFFSET_PT);
  add("hanging-indent", HANGING_INDENT_PT);
  add("bullet-extra-gap", BULLET_TO_BULLET_EXTRA_PT);
  add("heading-rule-weight", HEADING_RULE_WEIGHT_PT);

  return lines;
}

/** The full `:root { … }` block, framed by the generated markers. */
export function resumeRootBlock(): string {
  return [GENERATED_START, ":root {", ...declarations(), "}", GENERATED_END].join(
    "\n",
  );
}

/** Replace the generated block in a stylesheet, leaving hand-written rules alone. */
export function withGeneratedBlock(stylesheet: string): string {
  const start = stylesheet.indexOf(GENERATED_START);
  const end = stylesheet.indexOf(GENERATED_END);
  if (start === -1 || end === -1) {
    throw new Error(
      `resume.css is missing its generated markers (${GENERATED_START} … ${GENERATED_END})`,
    );
  }
  return (
    stylesheet.slice(0, start) +
    resumeRootBlock() +
    stylesheet.slice(end + GENERATED_END.length)
  );
}
