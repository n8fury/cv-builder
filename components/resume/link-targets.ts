/**
 * What the document and the form call the same thing (SPEC §7, §11.1).
 *
 * The editor's left column and the preview are one React tree fed from one
 * draft, so every block on the page already has a counterpart control a few
 * hundred pixels to its left — but nothing connected them, and the column is
 * long enough that a control is found by eye. This module is the connection:
 * one attribute vocabulary, carried by both trees, so a hover on either side
 * can find the other by selector alone.
 *
 * The names are the form's, not new ones. `data-entry` and `data-bullet` are
 * what `EntryCuration` has always put on its rows and fields; the document now
 * carries the same two, with the same library ids in them. Nothing here
 * invents an identifier — an entry id and a bullet id are already the identity
 * of the thing in the content library (§6.1), which is why the plan called
 * these "the ids that already exist on both sides".
 *
 * The attributes are inert. They do not render, they do not affect layout, and
 * Puppeteer prints a document that carries them exactly as it printed one that
 * did not (§8) — which is what allows the shared components to carry editor
 * affordances without the print route becoming a second rendering path.
 */

/** The two levels of the document that have a control of their own. */
export type LinkKind = "entry" | "bullet";

export type LinkTarget = { kind: LinkKind; id: string };

/**
 * The attribute each kind is written as, on both sides.
 *
 * Innermost kind first: `linkTargetsAt` walks this order, so a bullet inside
 * an entry is offered before the entry that holds it.
 */
export const LINK_ATTRIBUTE: Record<LinkKind, string> = {
  bullet: "data-bullet",
  entry: "data-entry",
};

const KINDS = Object.keys(LINK_ATTRIBUTE) as LinkKind[];

/**
 * Set on the document's root element by the editor, and only by the editor.
 *
 * `/render` is screen media too — it is a page in a browser before it is a
 * print target — so a bare `@media screen` rule would give the export route's
 * document the preview's cursors as well. Gating on a class the editor sets
 * imperatively keeps every affordance here inside the editor's own iframe.
 */
export const LINKED_CLASS = "resume-linked";

/** On the block the form is currently pointing at. Screen-only, in resume.css. */
export const FOCUS_CLASS = "resume-focus";

/** The attributes to spread onto the element that stands for `id`. */
export function linkTarget(kind: LinkKind, id: string): Record<string, string> {
  return { [LINK_ATTRIBUTE[kind]]: id };
}

/**
 * A selector matching every copy of a target.
 *
 * Every copy, deliberately: the preview renders the whole document into each
 * sheet and windows it (see `PagedDocument`), so a bullet on page two exists
 * in page one's flow as well, clipped out of sight. Highlighting all of them
 * is what makes the highlight appear on whichever sheet is actually showing it.
 *
 * `JSON.stringify` quotes and escapes the id, which is all an attribute
 * selector needs — and unlike `CSS.escape` it exists outside a browser, so the
 * same helper is usable from a test.
 */
export function linkSelector({ kind, id }: LinkTarget): string {
  return attributeSelector(LINK_ATTRIBUTE[kind], id);
}

/**
 * `[attribute="id"]`, with the id quoted.
 *
 * Exported because the form carries one attribute the document has no use for:
 * a bullet whose wording is not editable is a checkbox spelled
 * `data-bullet-toggle`, and looking one up needs the same escaping.
 */
export function attributeSelector(attribute: string, id: string): string {
  return `[${attribute}=${JSON.stringify(id)}]`;
}

/**
 * What was clicked, innermost first.
 *
 * A list rather than one answer, because the two sides are not obliged to
 * offer the same granularity: Education's description renders as a bullet
 * (§16.4) but is a field of its entry, so the form has no control for it. The
 * caller walks the list and takes the first target it can actually reveal,
 * which turns that mismatch into a jump to the entry instead of a dead click.
 */
export function linkTargetsAt(element: Element | null): LinkTarget[] {
  const targets: LinkTarget[] = [];
  for (const kind of KINDS) {
    const match = element?.closest(`[${LINK_ATTRIBUTE[kind]}]`);
    const id = match?.getAttribute(LINK_ATTRIBUTE[kind]);
    if (id) targets.push({ kind, id });
  }
  return targets;
}
