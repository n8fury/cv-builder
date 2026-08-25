import { describe, expect, it } from "vitest";

import {
  ABOUT_ME_MIN_SPACE_BEFORE_PT,
  ABOUT_ME_SPACE_BEFORE_PT,
  ASCENT_RATIO,
  BODY_FONT_SIZE_PT,
  BODY_LEADING_PT,
  CONTENT_LEFT_PT,
  DESCENT_RATIO,
  CONTACT_LINE_GAP_PT,
  CONTENT_RIGHT_PT,
  HEADER_SLOTS,
  HEADING_FONT_SIZE_PT,
  NAME_BASELINE_TO_ABOUT_ME_PT,
  NAME_TO_CONTACT_PT,
  TITLE_FONT_SIZE_PT,
  TITLE_LEADING_PT,
  headerSlot,
  RIGHT_BLOCK_OFFSET_PT,
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
    const lift = RIGHT_BLOCK_OFFSET_PT.twoLine;
    expect(baselineGap(lift, BODY_FONT_SIZE_PT, BODY_LEADING_PT)).toBeCloseTo(
      lift - BODY_LEADING_PT,
      10,
    );
  });

  it("offsets a one-line right block the opposite way from a two-line one", () => {
    expect(RIGHT_BLOCK_OFFSET_PT.twoLine).toBeLessThan(0);
    expect(RIGHT_BLOCK_OFFSET_PT.oneLine).toBeGreaterThan(0);
  });
});

describe("header slots (§5.1, §16.6)", () => {
  it("names all four mode/title combinations", () => {
    expect([...HEADER_SLOTS]).toEqual(["minimal", "full", "minimal-title", "full-title"]);
    expect(headerSlot("minimal", false)).toBe("minimal");
    expect(headerSlot("minimal", true)).toBe("minimal-title");
    expect(headerSlot("full", false)).toBe("full");
    expect(headerSlot("full", true)).toBe("full-title");
  });

  it("sets the title at the contact line's size and leading", () => {
    // Neither source PDF contains a title, so a size of its own would be an
    // unmeasured number; the contact line's is the one §4.1 validates.
    expect(TITLE_FONT_SIZE_PT).toBe(BODY_FONT_SIZE_PT);
    expect(TITLE_LEADING_PT).toBe(BODY_LEADING_PT);
  });

  it("leaves the two measured slots exactly where they were", () => {
    // The regression that matters: golden.json renders `minimal`, and this
    // whole change must not move it by so much as a hundredth of a point.
    expect(ABOUT_ME_SPACE_BEFORE_PT.minimal).toBeCloseTo(
      NAME_BASELINE_TO_ABOUT_ME_PT - NAME_TO_CONTACT_PT.minimal,
      10,
    );
    expect(ABOUT_ME_SPACE_BEFORE_PT.full).toBeCloseTo(
      NAME_BASELINE_TO_ABOUT_ME_PT - NAME_TO_CONTACT_PT.full - CONTACT_LINE_GAP_PT,
      10,
    );
  });

  it("pays for a title out of the fixed slot when the slot can cover it", () => {
    // A minimal header draws one contact line, so the title lands in dead
    // space: About Me stays on the same baseline and nothing below it moves.
    expect(ABOUT_ME_SPACE_BEFORE_PT["minimal-title"]).toBeCloseTo(
      NAME_BASELINE_TO_ABOUT_ME_PT - NAME_TO_CONTACT_PT.minimal - CONTACT_LINE_GAP_PT,
      10,
    );
    expect(ABOUT_ME_SPACE_BEFORE_PT["minimal-title"]).toBeGreaterThan(
      ABOUT_ME_MIN_SPACE_BEFORE_PT,
    );
  });

  it("holds the floor for a full header with a title, which the slot cannot cover", () => {
    // Three lines below the name leave 3.25pt — less than the 12pt heading's
    // 11.77pt ascent, so About Me would print through the last contact line.
    const unclamped =
      NAME_BASELINE_TO_ABOUT_ME_PT -
      NAME_TO_CONTACT_PT.full -
      2 * CONTACT_LINE_GAP_PT;

    expect(unclamped).toBeLessThan(HEADING_FONT_SIZE_PT);
    expect(ABOUT_ME_SPACE_BEFORE_PT["full-title"]).toBe(ABOUT_ME_MIN_SPACE_BEFORE_PT);
  });

  it("never lets About Me come closer than the tightest measured gap", () => {
    for (const slot of HEADER_SLOTS) {
      expect(ABOUT_ME_SPACE_BEFORE_PT[slot]).toBeGreaterThanOrEqual(
        ABOUT_ME_MIN_SPACE_BEFORE_PT,
      );
    }
  });
});
