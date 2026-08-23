import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PAGE_HEIGHT_PT, PAGE_WIDTH_PT } from "./metrics";
import { EXPECTED_MEDIA_BOX_PT, PDF_PAGE_OPTIONS } from "./pdf-options";

describe("page.pdf() options", () => {
  it("passes exactly what §15.10 pins", () => {
    expect(PDF_PAGE_OPTIONS).toEqual({
      format: "Letter",
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });

  it("agrees with the stylesheet's @page size — the other half of §15.10", () => {
    const css = readFileSync(join(process.cwd(), "components", "resume", "resume.css"), "utf8");
    expect(css).toContain(`size: ${PAGE_WIDTH_PT}pt ${PAGE_HEIGHT_PT}pt;`);
    // Letter is 8.5in x 11in; the CSS states the same page in points.
    expect(EXPECTED_MEDIA_BOX_PT).toEqual({ width: 8.5 * 72, height: 11 * 72 });
  });
});
