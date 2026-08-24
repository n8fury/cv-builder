/**
 * Whether the required faces actually loaded (SPEC §8, §13, §15.14).
 *
 * §13 splits the *response* to a missing face by path — the preview falls
 * back to `serif` and carries on, the export refuses to produce a PDF — but
 * not the *question*. Both paths ask exactly this, from one implementation,
 * so the warning above the preview and the 500 from `/api/generate-pdf` can
 * never disagree about which faces are usable.
 *
 * `document.fonts.ready` is not the question: it settles once loading has
 * finished, successfully or not, so a missing woff2 resolves it just the same
 * and the page quietly paints in `serif`.
 *
 * `findFontProblems` runs *inside* the document being judged — the printed
 * page under Puppeteer, or the preview iframe. Puppeteer ships it across by
 * serialising its source, so it must stay self-contained: no imports, no
 * module-scope references, everything it needs passed in as an argument.
 */
import { REQUIRED_FONT_FACES, faceLabel, faceShorthand } from "./fonts";

/**
 * Set on the preview document's root when a face is unusable (§13, §15.14).
 *
 * `font-display: block` is right for a document whose fidelity is the point —
 * a fallback face must never paint on the export path — but it costs the
 * preview a three-second blank while a face that is never coming fails to
 * arrive. Once the check has confirmed the faces are dead, this class ends
 * that wait and drops the preview onto `serif` immediately, which is what
 * §13 means by a non-blocking fallback.
 *
 * Only the editor ever sets it; nothing on the print route can.
 */
export const FALLBACK_FONTS_CLASS = "resume-fallback-fonts";

/** A required face, flattened to what the in-document check compares. */
export type FaceDescriptor = {
  label: string;
  family: string;
  style: string;
  /** `FontFace.weight` is a string, so this is compared as one. */
  weight: string;
  shorthand: string;
};

export function requiredFaceDescriptors(): FaceDescriptor[] {
  return REQUIRED_FONT_FACES.map((face) => ({
    label: faceLabel(face),
    family: face.family,
    style: face.style,
    weight: String(face.weight),
    shorthand: faceShorthand(face),
  }));
}

/**
 * One message per unusable face; empty when every face is good.
 *
 * Self-contained by contract — see the module note. `doc` defaults to the
 * ambient `document` so Puppeteer can call it with the faces alone.
 */
export async function findFontProblems(
  faces: FaceDescriptor[],
  doc: Document = document,
): Promise<string[]> {
  const declared: FontFace[] = [];
  doc.fonts.forEach((face) => declared.push(face));

  const problems: string[] = [];
  for (const wanted of faces) {
    const face = declared.find(
      (candidate) =>
        candidate.family.replace(/^["']|["']$/g, "") === wanted.family &&
        candidate.style === wanted.style &&
        candidate.weight === wanted.weight,
    );
    if (!face) {
      problems.push(`${wanted.label} is not declared in the document`);
      continue;
    }
    // A face this variant never uses is still required to exist: whether the
    // resume happens to render italics must not decide whether the export is
    // trustworthy, or whether the preview is showing the real thing.
    if (face.status === "unloaded") {
      await face.load().catch(() => undefined);
    }
    if (face.status !== "loaded") {
      problems.push(`${wanted.label} failed to load (status: ${face.status})`);
    } else if (!doc.fonts.check(wanted.shorthand)) {
      problems.push(`${wanted.label} loaded but document.fonts.check() rejects it`);
    }
  }
  return problems;
}
