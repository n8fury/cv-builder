/**
 * Whole-document text identity, for the §11.2 harness.
 *
 * The harness pairs some lines by position rather than by text, because a
 * justified paragraph that breaks one word early has lines with no shared
 * opening at all. That pairing is only sound if something else guarantees the
 * two documents actually say the same thing — this is that something.
 */

/**
 * Every character in the document, in reading order, with whitespace and
 * hyphens removed.
 *
 * Whitespace goes because a gap can be a space glyph on one side and pure
 * kerning on the other. Hyphens go because a line break can introduce one:
 * the source's Core Competencies line ends `"Agile -"` where Chromium keeps
 * `Agile Development` together, and that hyphen is Illustrator's, not the
 * content's. What survives is the copy itself, which must match exactly.
 */
export function documentKey(items) {
  return items
    .map((item) => item.text)
    .join("")
    .replace(/[\s-]+/g, "")
    .toLowerCase();
}

/**
 * The same key, split by the face each character is set in.
 *
 * Per-line font checks only ever see a line's leading item, so a face
 * substitution part-way along a line — an italic project subtitle falling
 * back to roman, say — would pass unnoticed. Keying the copy by face catches
 * it wherever it happens, and is immune to reflow: which face a word is set
 * in does not depend on where the line breaks.
 */
export function documentKeyByFace(items) {
  const byFace = new Map();
  for (const item of items) {
    byFace.set(item.fontName, (byFace.get(item.fontName) ?? "") + item.text);
  }
  return new Map(
    [...byFace].map(([face, text]) => [face, text.replace(/[\s-]+/g, "").toLowerCase()]),
  );
}

/**
 * Every face must carry exactly the copy it carries in the golden — no face
 * missing, none added, none holding text that belongs to another (SPEC §8:
 * a fallback serif is a hard failure, never a silent degradation).
 *
 * Returns a list of descriptions, empty when the two agree.
 */
export function assertSameFaces(goldenItems, actualItems) {
  const expected = documentKeyByFace(goldenItems);
  const actual = documentKeyByFace(actualItems);
  const problems = [];

  for (const [face, text] of expected) {
    if (!actual.has(face)) {
      problems.push(`face ${face} is absent from the generated PDF — substituted or failed to load`);
    } else if (actual.get(face) !== text) {
      problems.push(
        `face ${face} sets different text (${text.length} golden chars, ` +
          `${actual.get(face).length} generated)`,
      );
    }
  }
  for (const face of actual.keys()) {
    if (!expected.has(face)) problems.push(`face ${face} is not used in the golden`);
  }
  return problems;
}

/**
 * Compare two documents' copy. Returns a description of the first divergence,
 * or null when they agree.
 */
export function assertSameText(goldenItems, actualItems) {
  const expected = documentKey(goldenItems);
  const actual = documentKey(actualItems);
  if (expected === actual) return null;

  let i = 0;
  while (i < Math.min(expected.length, actual.length) && expected[i] === actual[i]) i += 1;
  const window = (text) => text.slice(Math.max(0, i - 30), i + 30);
  return (
    `document text differs at character ${i} ` +
    `(${expected.length} golden chars, ${actual.length} generated)\n` +
    `    golden:    …${window(expected)}…\n` +
    `    generated: …${window(actual)}…`
  );
}
