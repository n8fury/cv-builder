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

/**
 * The bits of a DOM node this module reads (SPEC §16.3).
 *
 * Structural rather than `Node`, for `linkSelector`'s reason one module over:
 * the serializer is the half of §16.3 that has to be *checked*, and a shape a
 * test can build by hand is checkable without a browser in the room.
 */
export interface MarkupNode {
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  childNodes: ArrayLike<MarkupNode>;
}

const TEXT_NODE = 3;

/**
 * The tags that mean italic when text comes back out of a contentEditable
 * block. `EM` is what the renderer emits; `I` is what a browser's own italic
 * command inserts, and refusing to read it back would silently drop emphasis
 * the person applied with the key they have always used for it.
 */
const ITALIC_TAGS = new Set(["EM", "I"]);

/** Adjacent runs in the same face are one run — `parseInlineMarkup`'s rule. */
function pushSegment(segments: MarkupSegment[], text: string, italic: boolean): void {
  if (text === "") return;
  const last = segments[segments.length - 1];
  if (last && last.italic === italic) {
    last.text += text;
    return;
  }
  segments.push({ text, italic });
}

/**
 * A non-breaking space is a space.
 *
 * Typing two spaces in a row in a contentEditable block gets one of them
 * written to the DOM as U+00A0, because that is how a browser stops HTML from
 * collapsing it. The document renders identically either way, so storing
 * the character would put an invisible difference into the library that the
 * same words typed into the form's field would not have.
 */
function plainText(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

/** Reads a rendered block back into runs, ignoring anything that is not text. */
function readSegments(node: MarkupNode, italic: boolean, segments: MarkupSegment[]): void {
  if (node.nodeType === TEXT_NODE) {
    pushSegment(segments, plainText(node.nodeValue ?? ""), italic);
    return;
  }
  const inside = italic || ITALIC_TAGS.has(node.nodeName.toUpperCase());
  for (let i = 0; i < node.childNodes.length; i++) {
    readSegments(node.childNodes[i]!, inside, segments);
  }
}

const escapeMarkers = (text: string): string => text.replaceAll(MARKER, ESCAPE + MARKER);

function sameSegments(a: readonly MarkupSegment[], b: readonly MarkupSegment[]): boolean {
  return (
    a.length === b.length &&
    a.every((segment, index) => segment.text === b[index].text && segment.italic === b[index].italic)
  );
}

/**
 * Runs back into `*inline italic*` markup — the inverse of the parser above.
 *
 * Escaping is applied only where it is needed, and "needed" is *measured*
 * rather than guessed: the plain spelling is written first and parsed back,
 * and the escaped one is used only when the two disagree. A bullet mentioning
 * a single `*` therefore comes out of the preview spelled exactly as it went
 * into the form's field, and one whose asterisks would re-pair into emphasis
 * nobody applied comes out escaped. Either way what round-trips is the
 * rendered result, which is the only thing §16.3 promises.
 */
export function writeInlineMarkup(segments: readonly MarkupSegment[]): string {
  const wrap = (escape: boolean) =>
    segments
      .map(({ text, italic }) => {
        const body = escape ? escapeMarkers(text) : text;
        return italic ? `${MARKER}${body}${MARKER}` : body;
      })
      .join("");

  const plain = wrap(false);
  return sameSegments(parseInlineMarkup(plain), segments) ? plain : wrap(true);
}

/**
 * The text a rendered block would be typed as (§16.3).
 *
 * What comes back is bullet text in the same spelling the form's field holds,
 * so a block edited in the preview writes the library the field writes.
 */
export function serializeInlineMarkup(root: MarkupNode): string {
  const segments: MarkupSegment[] = [];
  readSegments(root, false, segments);
  return writeInlineMarkup(segments);
}
