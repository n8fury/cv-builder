import { describe, expect, it } from "vitest";

import { contentDisposition, exportPath, pdfFilename, renderPath } from "./routes";

describe("routes", () => {
  it("points View at the render route", () => {
    expect(renderPath("jordan-rivera", "detailed")).toBe("/render/jordan-rivera/detailed");
  });

  it("points Download at the export endpoint with both ids", () => {
    expect(exportPath("jordan-rivera", "detailed")).toBe(
      "/api/generate-pdf?profileId=jordan-rivera&variantId=detailed",
    );
    expect(exportPath("jordan-rivera", "detailed", { download: true })).toBe(
      "/api/generate-pdf?profileId=jordan-rivera&variantId=detailed&download=1",
    );
  });

  it("names the file after the variant id", () => {
    expect(pdfFilename("jordan-rivera", "detailed")).toBe("jordan-rivera-detailed.pdf");
  });

  it("serves inline by default and as an attachment when downloading", () => {
    expect(contentDisposition("jordan-rivera", "detailed")).toBe(
      'inline; filename="jordan-rivera-detailed.pdf"',
    );
    expect(contentDisposition("jordan-rivera", "detailed", { download: true })).toBe(
      'attachment; filename="jordan-rivera-detailed.pdf"',
    );
  });
});
