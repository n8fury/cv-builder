"use client";

/**
 * The link between the form and the preview (SPEC §7, §11.1).
 *
 * Two directions, one vocabulary (`components/resume/link-targets.ts`):
 * pointing at a control highlights the block it writes, and clicking a block
 * scrolls to its control and focuses it. Neither direction sends anything
 * through the store or through React state — both are direct DOM work, and
 * that is the whole design decision here.
 *
 * The reason is `PagedDocument`: it re-measures the flow on every render, and
 * a hover that re-rendered the resume would re-measure the whole document,
 * line boxes included, on every pointer move across a long form. So the
 * highlight is a class toggled on the preview's own nodes. React never re-runs
 * for it, and it survives re-renders — React only writes `className` when its
 * own value for it changes, and its value never mentions this class.
 *
 * The controller is created once per editor and handed out through context, so
 * the form's rows reach the preview without either knowing the other exists.
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { EDITABLE_ATTRIBUTE } from "@/components/resume/editable";
import {
  attributeSelector,
  FOCUS_CLASS,
  LINKED_CLASS,
  linkSelector,
  linkTargetsAt,
  type LinkKind,
  type LinkTarget,
} from "@/components/resume/link-targets";

/**
 * How long the control a click landed on stays marked, in milliseconds.
 *
 * Focus alone is too quiet to find: a focus ring on a textarea in a column of
 * textareas is exactly the "found by eye" problem this task exists to remove.
 * The mark fades on its own rather than on the next interaction, so it never
 * competes with the focus ring it hands over to.
 */
const FLASH_MS = 1400;

/** Tailwind classes for that mark. Editor chrome, so Tailwind is in scope (§7). */
const FLASH_CLASSES = ["ring-2", "ring-amber-400", "rounded"];

/**
 * The form's control for each kind, best first.
 *
 * A bullet's control is the field its wording is typed in, and its include
 * checkbox where the wording is not editable — a skill or a competency is
 * curated, not written, so `data-bullet` never appears for one. An entry has
 * no field of its own at all: what it has is the checkbox that puts it in the
 * variant, with the row itself as a last resort.
 *
 * Order matters more than it looks: an ordinary bullet has *both* spellings in
 * one row, and a selector list would hand back whichever came first in the
 * document — which is the checkbox, not the field the click asked for.
 */
const CONTROL_ATTRIBUTES: Record<LinkKind, readonly string[]> = {
  bullet: ["data-bullet", "data-bullet-toggle"],
  entry: ["data-entry-toggle", "data-entry"],
};

/** What can take focus once the row is found. */
const FOCUSABLE = "input, textarea, select, button";

export type PreviewLink = {
  /** Takes over the preview's document, or lets go of it. Returns a cleanup. */
  attach(body: HTMLElement | null): () => void;
  /** Marks every copy of `target` in the preview; `null` clears the mark. */
  highlight(target: LinkTarget | null): void;
  /** Called with what a click in the preview landed on, innermost first. */
  onPick(handler: (targets: LinkTarget[]) => void): () => void;
};

export function createPreviewLink(): PreviewLink {
  let body: HTMLElement | null = null;
  let marked: Element[] = [];
  let pick: ((targets: LinkTarget[]) => void) | null = null;

  const onClick = (event: Event) => {
    const element = event.target as Element | null;
    // The document's own links are real (§18.1) and would take the iframe to
    // GitHub, leaving the editor with no preview at all. In here a click means
    // "show me this", so the href is suppressed rather than followed.
    if (element?.closest("a")) event.preventDefault();
    // Except in text that is edited where it prints (`editable`): there a
    // click means "put the caret here", and jumping to the field would focus
    // the form and take the caret straight back out again. The blocks that
    // cannot be typed into — an entry's head, a skill, Education's
    // description — keep the jump, so nothing loses an affordance it had.
    if (element?.closest(`[${EDITABLE_ATTRIBUTE}]`)) return;
    const targets = linkTargetsAt(element);
    if (targets.length > 0) pick?.(targets);
  };

  return {
    attach(next) {
      body = next;
      if (!next) return () => {};
      const root = next.ownerDocument.documentElement;
      root.classList.add(LINKED_CLASS);
      next.addEventListener("click", onClick);
      return () => {
        next.removeEventListener("click", onClick);
        root.classList.remove(LINKED_CLASS);
        if (body === next) body = null;
      };
    },

    highlight(target) {
      for (const element of marked) element.classList.remove(FOCUS_CLASS);
      marked = [];
      if (!target || !body) return;
      // Every copy: the preview renders the whole document into each sheet and
      // clips it, so the block being pointed at exists once per sheet and only
      // the copy on its own page is visible.
      marked = [...body.querySelectorAll(linkSelector(target))];
      for (const element of marked) element.classList.add(FOCUS_CLASS);
    },

    onPick(handler) {
      pick = handler;
      return () => {
        if (pick === handler) pick = null;
      };
    },
  };
}

/** The control that writes `target`, if the form has one. */
function controlFor(target: LinkTarget, root: ParentNode): HTMLElement | null {
  for (const attribute of CONTROL_ATTRIBUTES[target.kind]) {
    const found = root.querySelector<HTMLElement>(attributeSelector(attribute, target.id));
    if (!found) continue;
    if (found.matches(FOCUSABLE)) return found;
    // A row rather than a control: its own first control stands in for it.
    const inner = found.querySelector<HTMLElement>(FOCUSABLE);
    if (inner) return inner;
    return found;
  }
  return null;
}

/**
 * Scrolls to the control a click in the preview asked for, and focuses it.
 *
 * Walks the targets innermost-first and stops at the first one the form can
 * actually show. Education's description is the case that needs it: it renders
 * as a bullet (§16.4) but is a field of its entry, so the bullet has no control
 * and the entry gets the click instead of the click being lost.
 */
export function revealTarget(targets: readonly LinkTarget[], root: ParentNode): boolean {
  for (const target of targets) {
    const control = controlFor(target, root);
    if (!control) continue;
    control.scrollIntoView({ block: "center", behavior: "smooth" });
    // The scroll is already running and animating; letting focus scroll too
    // would fight it and land somewhere neither asked for.
    control.focus({ preventScroll: true });
    const row = control.closest("div") ?? control;
    row.classList.add(...FLASH_CLASSES);
    setTimeout(() => row.classList.remove(...FLASH_CLASSES), FLASH_MS);
    return true;
  }
  return false;
}

const PreviewLinkContext = createContext<PreviewLink | null>(null);

export function PreviewLinkProvider({ children }: { children: ReactNode }) {
  // Created once and never replaced: the preview attaches to it in an effect,
  // and a new object each render would tear that down and build it again.
  const [link] = useState(createPreviewLink);

  useEffect(() => link.onPick((targets) => revealTarget(targets, document)), [link]);

  return <PreviewLinkContext.Provider value={link}>{children}</PreviewLinkContext.Provider>;
}

/**
 * The link, or a no-op stand-in outside the editor.
 *
 * The resume components are shared with `/render`, and so are the hooks a form
 * row uses in the library manager, which has no preview at all. Neither should
 * have to know whether a preview is listening.
 */
const INERT: PreviewLink = {
  attach: () => () => {},
  highlight: () => {},
  onPick: () => () => {},
};

export function usePreviewLink(): PreviewLink {
  return useContext(PreviewLinkContext) ?? INERT;
}

/**
 * Handlers that point the preview at what this row writes.
 *
 * Focus as well as hover, so the link is there for a keyboard: tabbing down
 * the column highlights each block in turn, which is the same affordance the
 * pointer gets rather than a lesser one.
 */
export function useLinkHover(kind: LinkKind, id: string) {
  const link = usePreviewLink();
  // Cleared on unmount as well as on leave: a row removed while the pointer is
  // on it — an entry unticked, a bullet deleted — never fires its own leave.
  // The link is created once per editor, so this cleanup runs on unmount only.
  useEffect(() => () => link.highlight(null), [link]);

  return useMemo(
    () => ({
      onMouseEnter: () => link.highlight({ kind, id }),
      onMouseLeave: () => link.highlight(null),
      onFocus: () => link.highlight({ kind, id }),
      onBlur: () => link.highlight(null),
    }),
    [link, kind, id],
  );
}
