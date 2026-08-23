import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { REQUIRED_FONT_FACES, faceLabel, faceShorthand } from "./fonts";

const css = readFileSync(join(process.cwd(), "components", "resume", "fonts.css"), "utf8");

/** Every `@font-face` block in the stylesheet, as a descriptor map. */
function declaredFaces(): Record<string, string>[] {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) =>
    Object.fromEntries(
      [...body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [
        name,
        value.trim(),
      ]),
    ),
  );
}

describe("required font faces", () => {
  it("lists exactly the faces fonts.css declares", () => {
    const declared = declaredFaces().map((face) => ({
      family: face["font-family"].replace(/^"|"$/g, ""),
      style: face["font-style"],
      weight: Number(face["font-weight"]),
      src: face.src.match(/url\("([^"]+)"\)/)?.[1],
    }));

    expect(declared).toEqual([...REQUIRED_FONT_FACES]);
  });

  it("declares font-display: block on every face, so no fallback paints (§8)", () => {
    const declared = declaredFaces();
    expect(declared).toHaveLength(REQUIRED_FONT_FACES.length);
    for (const face of declared) expect(face["font-display"]).toBe("block");
  });

  it("names a face the way an error message needs to", () => {
    expect(faceLabel(REQUIRED_FONT_FACES[2])).toBe("CV Charter italic 400");
    expect(faceShorthand(REQUIRED_FONT_FACES[2])).toBe('italic 400 10pt "CV Charter"');
  });
});
