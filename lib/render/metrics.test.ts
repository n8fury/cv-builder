import { describe, expect, it } from "vitest";

import {
  ASCENT_RATIO,
  BODY_FONT_SIZE_PT,
  BODY_LEADING_PT,
  CONTENT_LEFT_PT,
  DESCENT_RATIO,
  CONTENT_RIGHT_PT,
  HEADING_FONT_SIZE_PT,
  RIGHT_BLOCK_LIFT_PT,
  SPACE_BEFORE_PT,
  TITLE_TO_SUBTITLE_PT,
  WIDE_LEADING_PT,
  baselineGap,
  boxTopToBaseline,
  leadingFor,
} from "./metrics";

describe("page geometry", () => {
  it("derives the §4.1 content box from width and margin", () => {
    expect(CONTENT_LEFT_PT).toBe(55);
    expect(CONTENT_RIGHT_PT).toBe(557);
  });
});

describe("leadingFor", () => {
  it("returns 13pt for the three §4.5 exception sections", () => {
    for (const section of ["skills", "certifications", "languages"] as const) {
      expect(leadingFor(section)).toBe(WIDE_LEADING_PT);
    }
  });

  it("returns 12pt everywhere else", () => {
    for (const section of ["aboutMe", "experience", "projects"] as const) {
      expect(leadingFor(section)).toBe(BODY_LEADING_PT);
    }
  });
});

describe("boxTopToBaseline", () => {
  it("places the baseline an ascent below the box top when leading matches "
    + "the content area", () => {
    const face = "charter";
    const contentHeight =
      (ASCENT_RATIO[face] + DESCENT_RATIO[face]) * BODY_FONT_SIZE_PT;
    expect(boxTopToBaseline(BODY_FONT_SIZE_PT, contentHeight)).toBeCloseTo(
      ASCENT_RATIO[face] * BODY_FONT_SIZE_PT,
      6,
    );
  });

  it("absorbs a tighter line height into a negative half-leading", () => {
    const tight = boxTopToBaseline(HEADING_FONT_SIZE_PT, HEADING_FONT_SIZE_PT);
    expect(tight).toBeLessThan(ASCENT_RATIO.charter * HEADING_FONT_SIZE_PT);
    expect(tight).toBeCloseTo(10.362, 3);
  });
});

describe("baselineGap", () => {
  it("needs no margin for §4.4's 12.00pt title → company gap at 10pt/12pt", () => {
    expect(
      baselineGap(TITLE_TO_SUBTITLE_PT, BODY_FONT_SIZE_PT, BODY_LEADING_PT),
    ).toBeCloseTo(0, 10);
  });

  it("turns §4.2's 27.44pt Experience space-before into a positive margin", () => {
    const margin = baselineGap(
      SPACE_BEFORE_PT.experience,
      BODY_FONT_SIZE_PT,
      BODY_LEADING_PT,
    );
    expect(margin).toBeGreaterThan(0);
    expect(margin).toBeCloseTo(SPACE_BEFORE_PT.experience - BODY_LEADING_PT, 10);
    expect(margin).toBeCloseTo(15.44, 10);
  });

  it("collapses to target − leading whenever both blocks share metrics", () => {
    for (const target of [12, 19.29, 22.19, 27.44, 28.17]) {
      expect(baselineGap(target, BODY_FONT_SIZE_PT, WIDE_LEADING_PT)).toBeCloseTo(
        target - WIDE_LEADING_PT,
        10,
      );
    }
  });

  it("accounts for ascent when the two blocks differ", () => {
    const intoHeading = baselineGap(
      SPACE_BEFORE_PT.experience,
      HEADING_FONT_SIZE_PT,
      HEADING_FONT_SIZE_PT,
      { previous: { fontSizePt: BODY_FONT_SIZE_PT, lineHeightPt: BODY_LEADING_PT } },
    );
    // Differs from the same-metrics answer, so the ascent has not cancelled.
    expect(intoHeading).not.toBeCloseTo(
      SPACE_BEFORE_PT.experience - BODY_LEADING_PT,
      3,
    );
    expect(intoHeading).toBeCloseTo(14.713, 3);
  });

  it("expresses the 2.31pt right-block lift as a negative margin", () => {
    expect(
      baselineGap(-RIGHT_BLOCK_LIFT_PT, BODY_FONT_SIZE_PT, BODY_LEADING_PT),
    ).toBeCloseTo(-RIGHT_BLOCK_LIFT_PT - BODY_LEADING_PT, 10);
  });
});
