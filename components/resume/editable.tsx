"use client";

/**
 * Text edited where it prints (SPEC §7, §16.3).
 *
 * Everything else in the editor is a form driving a document: the wording of a
 * bullet is typed in a box on the left and appears on the right. This is the
 * other way round — the bullet on the page is the box. It writes the same
 * store action the field writes (`setBulletText`), so a word typed here and
 * the same word typed there produce the same library draft, the same undo
 * step and the same rendered line.
 *
 * **React does not own the text.** The block renders empty and its contents
 * are written imperatively, because a contentEditable node whose children
 * React reconciles is a caret that jumps on every keystroke: the store update
 * that a keystroke causes comes back as a re-render, and React rewriting the
 * text node under the caret moves it. So the DOM is written only when what it
 * already says differs from the draft — which is never true of a keystroke
 * that produced that draft, and always true of an undo, a form edit or a
 * revert. The caret survives the first and follows the second.
 *
 * That also settles the desync a controlled contentEditable is famous for.
 * React never holds a virtual copy of nodes the browser created while typing,
 * so it can never be surprised by them; the block is rebuilt from the draft
 * whole, or left entirely alone.
 *
 * Nothing here is on the print route. The writer arrives through context and
 * defaults to absent, so `/render` renders `InlineText` exactly as it always
 * has — the same arrangement `pagination-context` uses for the page count.
 */
import { createContext, useCallback, useContext, useLayoutEffect, useRef } from "react";

import { parseInlineMarkup, serializeInlineMarkup } from "@/lib/render/markup";
import type { BulletOwner } from "@/lib/schema/library";

import { InlineText } from "./InlineText";

/** Which library bullet a block of text on the page writes to (§6.1). */
export interface EditableBullet {
  owner: BulletOwner;
  entryId: string;
  bulletId: string;
}

/** Where a bullet's editable text sits — supplied by whoever renders the list. */
export type BulletSource = Pick<EditableBullet, "owner" | "entryId">;

export type TextWriter = (target: EditableBullet, text: string) => void;

const TextEditContext = createContext<TextWriter | null>(null);

/** Set by the editor around its preview; absent everywhere else. */
export const TextEditProvider = TextEditContext.Provider;

export function useTextWriter(): TextWriter | null {
  return useContext(TextEditContext);
}

/** Marks the blocks a click means "put the caret here" rather than "show me". */
export const EDITABLE_ATTRIBUTE = "data-editable";

/**
 * The rendered form of `text`, as DOM nodes.
 *
 * Deliberately the same elements `InlineText` produces — a span per roman run,
 * an `em.resume-italic` per italic one — because the same block is built by
 * both paths depending on whether it is being typed in, and a block that
 * measured differently after an edit would make the preview disagree with the
 * PDF over nothing.
 */
function markupNodes(text: string, doc: Document): Node[] {
  return parseInlineMarkup(text).map((segment) => {
    const element = doc.createElement(segment.italic ? "em" : "span");
    if (segment.italic) element.className = "resume-italic";
    element.textContent = segment.text;
    return element;
  });
}

/**
 * One editable run of bullet text.
 *
 * The host is a span carrying no styling of its own: `InlineText` already
 * emits a span per run, so wrapping the runs in one more cannot move a line —
 * which matters here more than anywhere, since this block is inside the
 * document whose fidelity is the point.
 */
function Editable({
  text,
  target,
  write,
}: {
  text: string;
  target: EditableBullet;
  write: TextWriter;
}) {
  const host = useRef<HTMLSpanElement>(null);

  // Before paint, so a freshly mounted block is never measured empty: the
  // pagination pass runs in an effect, which is after every layout effect.
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    // Already saying it — this is the keystroke that produced it coming back
    // round. Rewriting would move the caret to the end of the bullet.
    if (serializeInlineMarkup(node) === text) return;
    node.replaceChildren(...markupNodes(text, node.ownerDocument));
  }, [text]);

  const onInput = useCallback(() => {
    const node = host.current;
    if (node) write(target, serializeInlineMarkup(node));
  }, [write, target]);

  return (
    <span
      {...{ [EDITABLE_ATTRIBUTE]: target.bulletId }}
      contentEditable
      suppressContentEditableWarning
      ref={host}
      role="textbox"
      // Off here, on in the field beside it. A spelling marker costs no
      // layout, but it paints — and this surface's whole claim is that what
      // is on it is what prints. The squiggle belongs on the left, where the
      // browser has always put it, not across the page it is checking.
      spellCheck={false}
      onInput={onInput}
      onKeyDown={(event) => {
        // A bullet is one run of prose. Enter would insert a block into the
        // middle of it that the stored string has no way to spell, so the key
        // does nothing rather than something unstorable.
        if (event.key === "Enter") event.preventDefault();
      }}
      onPaste={(event) => {
        // Pasted HTML would arrive as faces and colours the document does not
        // have and the library cannot store. The words are what was wanted.
        event.preventDefault();
        const plain = event.clipboardData.getData("text/plain").replace(/\s+/g, " ");
        event.currentTarget.ownerDocument.execCommand("insertText", false, plain);
      }}
    />
  );
}

/**
 * A bullet's text: editable in the editor's preview, plain everywhere else.
 *
 * `source` is absent wherever the text on the page is not a library bullet —
 * Education's description renders as a bullet (§16.4) but is a field of its
 * entry, and a skill is curated rather than written — so those blocks stay
 * exactly what they were.
 */
export function BulletText({
  id,
  text,
  source,
}: {
  id: string;
  text: string;
  source?: BulletSource;
}) {
  const write = useTextWriter();
  if (!write || !source) return <InlineText text={text} />;
  return <Editable text={text} target={{ ...source, bulletId: id }} write={write} />;
}
