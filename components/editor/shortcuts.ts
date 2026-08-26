"use client";

/**
 * The editor's keyboard shortcuts (SPEC §7).
 *
 * Two kinds of key live here, and they answer the focus question in opposite
 * directions.
 *
 * Ctrl+S and Ctrl+Shift+S are *chords*: they type nothing, so taking them
 * from a focused field swallows no keystroke. They are taken everywhere, and
 * deliberately — the browser's own Ctrl+S offers to write the editor's HTML
 * to disk, which is never what someone hitting Save in a CV editor meant.
 *
 * `/` is a *character* before it is a command. Inside a text field it is being
 * typed — a URL, a date range, `and/or` — and jumping focus to the filter box
 * would both lose the slash and move the cursor out of the sentence. So it
 * fires only when the keystroke landed outside anything editable, which is the
 * one guard `isTextEntry` exists for.
 *
 * The matcher is a pure function over the parts of a `KeyboardEvent` that
 * decide the question, so every rule above is settled in a test rather than in
 * a browser.
 */
import { useEffect, useRef } from "react";

export type EditorShortcut = "save" | "saveAs" | "focusFilter";

/** The read-only face of a `KeyboardEvent` a shortcut is decided from. */
export interface ShortcutEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly isComposing: boolean;
  readonly target: EventTarget | null;
}

/**
 * Whether the keystroke landed somewhere a character would have been typed.
 *
 * Duck-typed rather than `instanceof HTMLInputElement`: the check has to hold
 * for a plain object in a node test, and the two properties it reads are the
 * whole of what the question turns on.
 */
export function isTextEntry(target: EventTarget | null): boolean {
  if (target === null || typeof target !== "object") return false;
  const node = target as { tagName?: unknown; isContentEditable?: unknown };
  if (node.isContentEditable === true) return true;
  const tag = typeof node.tagName === "string" ? node.tagName.toUpperCase() : "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** The shortcut a keystroke means, or `null` if it means nothing here. */
export function matchShortcut(event: ShortcutEvent): EditorShortcut | null {
  // Mid-composition an IME owns the keyboard; every key is a candidate-list
  // key until it commits.
  if (event.isComposing) return null;
  // AltGr arrives as Ctrl+Alt on Windows, and is how several layouts type a
  // slash in the first place. Nothing here wants Alt.
  if (event.altKey) return null;

  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (mod) return key === "s" ? (event.shiftKey ? "saveAs" : "save") : null;

  // Shift is allowed: layouts that put `/` on a shifted key still report the
  // character as `/`, and Shift+`/` on a US layout reports `?`, not this.
  if (key === "/" && !isTextEntry(event.target)) return "focusFilter";
  return null;
}

/**
 * Run `handler` whenever `action`'s keystroke arrives anywhere in the window.
 *
 * The handler is held in a ref so an inline closure — which every caller
 * passes — does not rebind the listener on each keystroke of the draft.
 */
export function useShortcut(action: EditorShortcut, handler: () => void): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (matchShortcut(event) !== action) return;
      // Before the handler, and whether or not the handler does anything: a
      // Ctrl+S the editor declines to act on must still not open Save Page.
      event.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [action]);
}
