import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FALLBACK_FONTS_CLASS, requiredFaceDescriptors } from "./font-check";
import { REQUIRED_FONT_FACES } from "./fonts";

const css = readFileSync(join(process.cwd(), "components/resume/resume.css"), "utf8")
  // Comments quote selectors and family names; only the rules count here.
  .replace(/\/\*[\s\S]*?\*\//g, "");

/** Every rule in the stylesheet, as `[selector, body]`. */
function rules(): [string, string][] {
  return [...css.matchAll(/([^{};]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [
    selector.trim(),
    body,
  ]);
}

describe("font fallback", () => {
  it("overrides every rule that names an embedded family", () => {
    // §13's fallback only reaches what the cascade would otherwise pin to a
    // face that is not there. A new rule naming "CV Charter" or "CV Charis"
    // and no matching override would keep painting nothing in the preview.
    const pinned = rules()
      .filter(([, body]) => /font-family:[^;]*"CV /.test(body))
      .map(([selector]) => selector);
    expect(pinned.length).toBeGreaterThan(0);

    const overridden = rules()
      .filter(([, body]) => /font-family:\s*serif\s*;/.test(body))
      .flatMap(([selector]) => selector.split(","))
      .map((part) => part.trim().replace(`.${FALLBACK_FONTS_CLASS} `, ""));

    for (const selector of pinned) {
      expect(overridden, `no fallback rule for ${selector}`).toContain(selector);
    }
  });

  it("describes exactly the required faces", () => {
    expect(requiredFaceDescriptors().map((face) => face.family)).toEqual(
      REQUIRED_FONT_FACES.map((face) => face.family),
    );
    expect(requiredFaceDescriptors()[0].shorthand).toBe('normal 400 10pt "CV Charter"');
  });

  it("keeps the in-document check self-contained, so Puppeteer can serialise it", () => {
    // The export ships this function's *source* into the page. A reference to
    // anything in module scope compiles fine and fails only at runtime,
    // inside Chromium, as an opaque ReferenceError.
    const source = readFileSync(join(process.cwd(), "lib/render/font-check.ts"), "utf8");
    const body = source.slice(source.indexOf("export async function findFontProblems"));
    for (const forbidden of ["REQUIRED_FONT_FACES", "faceLabel", "faceShorthand"]) {
      expect(body, `findFontProblems must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});
