/**
 * The faces the resume template requires (SPEC §3, §8).
 *
 * One list, consumed by the export path's pre-flight check. `fonts.test.ts`
 * asserts `components/resume/fonts.css` declares exactly these and no others,
 * so adding a face to the stylesheet without adding it here — which would let
 * the export ship a silently substituted face — fails `npm test`.
 *
 * The family names are the template's own (`CV Charter`, `CV Charis`), not
 * the fonts' real ones: see the note at the top of `fonts.css` for why.
 */
export interface ResumeFontFace {
  /** CSS `font-family`, as declared in `fonts.css`. */
  family: string;
  style: "normal" | "italic";
  weight: number;
  /** Path under `public/`, produced by `npm run build:fonts`. */
  src: string;
}

export const REQUIRED_FONT_FACES: readonly ResumeFontFace[] = [
  { family: "CV Charter", style: "normal", weight: 400, src: "/fonts/charter-roman.woff2" },
  { family: "CV Charter", style: "normal", weight: 700, src: "/fonts/charter-bold.woff2" },
  { family: "CV Charter", style: "italic", weight: 400, src: "/fonts/charter-italic.woff2" },
  { family: "CV Charis", style: "italic", weight: 400, src: "/fonts/charis-italic.woff2" },
];

/** How a face is named in an error message, e.g. `CV Charter italic 400`. */
export function faceLabel(face: ResumeFontFace): string {
  return `${face.family} ${face.style} ${face.weight}`;
}

/** A `font` shorthand `document.fonts.check()` accepts for this face. */
export function faceShorthand(face: ResumeFontFace): string {
  return `${face.style} ${face.weight} 10pt "${face.family}"`;
}
