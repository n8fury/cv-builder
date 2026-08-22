/**
 * Inline bullet markup (SPEC §16.3).
 *
 * Bullet text stays a plain string — far easier to edit in a textarea than a
 * segment array — and carries one piece of markup: `*text*` renders as a
 * CharterBT-Italic span inside an otherwise-regular bullet. A literal asterisk
 * is written `\*`.
 *
 * Nothing here throws. An unpaired asterisk renders as itself, so a stray one
 * can never silently swallow the rest of a bullet.
 */

/** A run of bullet text in a single face. */
export interface MarkupSegment {
  text: string;
  italic: boolean;
}

const ESCAPE = "\\";
const MARKER = "*";

/** Index of the next unescaped `*` at or after `from`, or -1. */
function findCloser(input: string, from: number): number {
  for (let i = from; i < input.length; i++) {
    if (input[i] === ESCAPE && input[i + 1] === MARKER) {
      i++;
      continue;
    }
    if (input[i] === MARKER) return i;
  }
  return -1;
}

/** Resolves `\*` to `*`; every other backslash is literal text. */
function unescape(input: string): string {
  return input.replace(/\\\*/g, MARKER);
}

/**
 * Splits bullet text into italic and roman runs. Adjacent runs in the same
 * face are merged, so the renderer emits one span per visible style change.
 */
export function parseInlineMarkup(input: string): MarkupSegment[] {
  const segments: MarkupSegment[] = [];

  const push = (text: string, italic: boolean): void => {
    if (text === "") return;
    const last = segments[segments.length - 1];
    if (last && last.italic === italic) {
      last.text += text;
      return;
    }
    segments.push({ text, italic });
  };

  let plain = "";
  let i = 0;

  while (i < input.length) {
    const char = input[i]!;

    if (char === ESCAPE && input[i + 1] === MARKER) {
      plain += MARKER;
      i += 2;
      continue;
    }

    if (char === MARKER) {
      const close = findCloser(input, i + 1);
      // Unpaired opener, or an empty `**` pair: nothing to emphasize, so the
      // asterisks stay visible rather than disappearing from the bullet.
      if (close === -1 || close === i + 1) {
        plain += char;
        i++;
        continue;
      }
      push(plain, false);
      plain = "";
      push(unescape(input.slice(i + 1, close)), true);
      i = close + 1;
      continue;
    }

    plain += char;
    i++;
  }

  push(plain, false);
  return segments;
}
