import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SECTION_TYPES } from "../schema/variant";
import {
  GENERATED_END,
  GENERATED_START,
  resumeRootBlock,
  withGeneratedBlock,
} from "./css-variables";
import { SPACE_BEFORE_PT } from "./metrics";

const STYLESHEET = join(process.cwd(), "components", "resume", "resume.css");
const css = readFileSync(STYLESHEET, "utf8");

describe("resume.css generated block", () => {
  it("matches what metrics.ts produces — re-run npm run build:resume-css", () => {
    const start = css.indexOf(GENERATED_START);
    const end = css.indexOf(GENERATED_END);
    expect(start, "generated start marker missing").toBeGreaterThan(-1);
    expect(end, "generated end marker missing").toBeGreaterThan(start);

    const committed = css.slice(start, end + GENERATED_END.length);
    expect(committed).toBe(resumeRootBlock());
  });

  it("emits a space-before and heading-to-content var per section type", () => {
    for (const section of SECTION_TYPES) {
      const name = section.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      expect(css).toContain(`--space-before-${name}:`);
      expect(css).toContain(`--heading-to-content-${name}:`);
    }
  });

  it("maps every section type onto its own spacing rule", () => {
    const handWritten = css.slice(css.indexOf(GENERATED_END));
    for (const section of SECTION_TYPES) {
      const name = section.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      expect(handWritten, `no rule for ${section}`).toContain(
        `.resume-section[data-section="${name}"]`,
      );
      expect(handWritten).toContain(`var(--space-before-margin-${name})`);
    }
  });

  it("carries each measured value through to the stylesheet", () => {
    expect(css).toContain(`--space-before-experience: ${SPACE_BEFORE_PT.experience}pt;`);
  });

  it("is consumed by the hand-written rules, not restated", () => {
    const handWritten = css.slice(css.indexOf(GENERATED_END));
    expect(handWritten).toContain("var(--space-before-margin-experience)");
    expect(handWritten).toContain("var(--leading-body)");
    expect(handWritten).not.toMatch(/\d+\.\d+pt/);
  });

  it("rewrites only the generated block, leaving hand-written rules alone", () => {
    const stale = css.replace(
      "--space-before-experience: 27.44pt;",
      "--space-before-experience: 99pt;",
    );
    expect(stale).not.toBe(css);
    expect(withGeneratedBlock(stale)).toBe(css);
  });

  it("refuses to rewrite a stylesheet with no markers", () => {
    expect(() => withGeneratedBlock(".resume-page { color: #000 }")).toThrow(
      /missing its generated markers/,
    );
  });
});
