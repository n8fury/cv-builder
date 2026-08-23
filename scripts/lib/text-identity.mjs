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
