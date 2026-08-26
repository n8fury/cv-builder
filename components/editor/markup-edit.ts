/**
 * The `*inline italic*` helper behind Ctrl+I (SPEC §16.3).
 *
 * §16.3 keeps bullet text a plain string with one piece of markup in it,
 * chosen precisely because it is easy to type in a textarea. Easy to type is
 * not the same as easy to *reach*, though — it is two asterisks either side of
 * a phrase already written — so the field offers the shortcut every editor has
 * for emphasis and writes the markup the renderer parses.
 *
 * A pure string function, deliberately: what a shortcut does to a bullet is
 * decided here and asserted directly, and the field is left with nothing but
 * reading a selection and writing one back.
 *
 * It toggles. Pressing it on text that is already emphasized takes the
 * emphasis off, whether the asterisks are inside the selection (a
 * double-click that swept them up) or just outside it (the phrase selected
 * without them) — anything else would make the shortcut a one-way trip that
 * has to be undone by hand.
 */

const MARKER = "*";
const ESCAPE = "\\";

export interface TextSelection {
  text: string;
  start: number;
  end: number;
}

/** Is the `*` at `index` markup, or a literal asterisk written `\*` (§16.3)? */
function isMarker(text: string, index: number): boolean {
  if (text[index] !== MARKER) return false;
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === ESCAPE; i--) backslashes++;
  return backslashes % 2 === 0;
}

/**
 * A literal asterisk inside a phrase being emphasized has to be escaped, or
 * the pair being written would close on it instead — §16.3's own rule, applied
 * where the asterisks come from a keystroke rather than from typing.
 */
function escapeMarkers(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    if (isMarker(text, i)) out += ESCAPE;
    out += text[i];
  }
  return out;
}

/** And the reverse, for text coming back out of a pair. */
function unescapeMarkers(text: string): string {
  return text.replace(/\\\*/g, MARKER);
}

/**
 * Ctrl+I over `[start, end)` of `text`.
 *
 * With nothing selected it writes an empty pair and leaves the caret between
 * the asterisks, which is what a shortcut pressed before typing the phrase
 * should do. With a selection it wraps or unwraps it, and hands back the
 * range covering the phrase itself either way, so the shortcut can be pressed
 * twice and land exactly where it started.
 *
 * Whitespace at the edges of a selection is left outside the pair. A word
 * selected by double-click often arrives with the space after it, and
 * `* word *` would print the spaces in italic and read as a wider gap.
 */
export function toggleItalic(text: string, start: number, end: number): TextSelection {
  const from = Math.max(0, Math.min(start, end, text.length));
  const to = Math.max(0, Math.min(Math.max(start, end), text.length));

  if (from === to) {
    return {
      text: `${text.slice(0, from)}${MARKER}${MARKER}${text.slice(from)}`,
      start: from + 1,
      end: from + 1,
    };
  }

  const selected = text.slice(from, to);
  const lead = selected.length - selected.trimStart().length;
  const trail = selected.length - selected.trimEnd().length;
  const inner = { from: from + lead, to: to - trail };
  // A selection of nothing but whitespace has no phrase to emphasize; treat
  // it as the empty case rather than wrapping the spaces.
  if (inner.from >= inner.to) return toggleItalic(text, from, from);

  const phrase = text.slice(inner.from, inner.to);

  // Already a pair inside the selection: `*phrase*` swept up whole.
  if (
    phrase.length >= 2 &&
    isMarker(text, inner.from) &&
    isMarker(text, inner.to - 1) &&
    inner.to - 1 > inner.from
  ) {
    const bare = unescapeMarkers(phrase.slice(1, -1));
    return {
      text: text.slice(0, inner.from) + bare + text.slice(inner.to),
      start: inner.from,
      end: inner.from + bare.length,
    };
  }

  // Already a pair around the selection: the phrase picked without its markers.
  if (isMarker(text, inner.from - 1) && isMarker(text, inner.to)) {
    const bare = unescapeMarkers(phrase);
    return {
      text: text.slice(0, inner.from - 1) + bare + text.slice(inner.to + 1),
      start: inner.from - 1,
      end: inner.from - 1 + bare.length,
    };
  }

  const wrapped = escapeMarkers(phrase);
  return {
    text: `${text.slice(0, inner.from)}${MARKER}${wrapped}${MARKER}${text.slice(inner.to)}`,
    start: inner.from + 1,
    end: inner.from + 1 + wrapped.length,
  };
}

/** Whether a keyboard event is the italic shortcut, on either platform. */
export function isItalicShortcut(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): boolean {
  if (event.altKey) return false;
  if (!event.ctrlKey && !event.metaKey) return false;
  return event.key.toLowerCase() === "i";
}
