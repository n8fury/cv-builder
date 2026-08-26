/**
 * What each keystroke means, and where it is allowed to mean it (SPEC §7).
 *
 * The claim under test is the one the task turns on: Ctrl+S and Ctrl+Shift+S
 * are taken from a focused field, `/` is not — because the first two swallow
 * nothing and the third would swallow a typed character.
 */
import { describe, expect, it } from "vitest";

import { isTextEntry, matchShortcut, type ShortcutEvent } from "./shortcuts";

/** A `KeyboardEvent`'s deciding parts, defaulted to "no modifiers, on body". */
function press(key: string, over: Partial<ShortcutEvent> = {}): ShortcutEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    isComposing: false,
    target: element("BODY"),
    ...over,
  };
}

/** A stand-in for the DOM node a keystroke landed on. */
function element(tagName: string, isContentEditable = false): EventTarget {
  return { tagName, isContentEditable } as unknown as EventTarget;
}

describe("matchShortcut", () => {
  it("reads Ctrl+S as save and Ctrl+Shift+S as save-as", () => {
    expect(matchShortcut(press("s", { ctrlKey: true }))).toBe("save");
    expect(matchShortcut(press("s", { ctrlKey: true, shiftKey: true }))).toBe("saveAs");
  });

  it("takes the Mac spelling of both", () => {
    expect(matchShortcut(press("s", { metaKey: true }))).toBe("save");
    expect(matchShortcut(press("s", { metaKey: true, shiftKey: true }))).toBe("saveAs");
  });

  it("reads a capital S the same way, since Shift is what makes it one", () => {
    expect(matchShortcut(press("S", { ctrlKey: true, shiftKey: true }))).toBe("saveAs");
  });

  it("saves from inside a text field — the chord types nothing to swallow", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(matchShortcut(press("s", { ctrlKey: true, target: element(tag) }))).toBe("save");
      expect(
        matchShortcut(press("s", { ctrlKey: true, shiftKey: true, target: element(tag) })),
      ).toBe("saveAs");
    }
    expect(
      matchShortcut(press("s", { ctrlKey: true, target: element("DIV", true) })),
    ).toBe("save");
  });

  it("focuses the filter on a bare slash outside a field", () => {
    expect(matchShortcut(press("/"))).toBe("focusFilter");
    expect(matchShortcut(press("/", { target: element("BUTTON") }))).toBe("focusFilter");
    // Layouts that put `/` on a shifted key still report the character.
    expect(matchShortcut(press("/", { shiftKey: true }))).toBe("focusFilter");
  });

  it("leaves a slash alone wherever it is being typed", () => {
    for (const target of [
      element("INPUT"),
      element("TEXTAREA"),
      element("SELECT"),
      element("DIV", true),
    ]) {
      expect(matchShortcut(press("/", { target }))).toBeNull();
    }
  });

  it("means nothing on a plain letter, or on Ctrl with another key", () => {
    expect(matchShortcut(press("s"))).toBeNull();
    expect(matchShortcut(press("?"))).toBeNull();
    expect(matchShortcut(press("a", { ctrlKey: true }))).toBeNull();
    expect(matchShortcut(press("z", { ctrlKey: true }))).toBeNull();
  });

  it("declines anything held with Alt, AltGr's Ctrl+Alt included", () => {
    expect(matchShortcut(press("s", { ctrlKey: true, altKey: true }))).toBeNull();
    expect(matchShortcut(press("/", { altKey: true }))).toBeNull();
  });

  it("declines every key mid-composition, which belongs to the IME", () => {
    expect(matchShortcut(press("s", { ctrlKey: true, isComposing: true }))).toBeNull();
    expect(matchShortcut(press("/", { isComposing: true }))).toBeNull();
  });
});

describe("isTextEntry", () => {
  it("is false for nothing at all, and for a target that is not a node", () => {
    expect(isTextEntry(null)).toBe(false);
    expect(isTextEntry("body" as unknown as EventTarget)).toBe(false);
    expect(isTextEntry(element("BODY"))).toBe(false);
  });

  it("reads a lowercased tag name, as XHTML-parsed documents report it", () => {
    expect(isTextEntry(element("input"))).toBe(true);
  });
});
