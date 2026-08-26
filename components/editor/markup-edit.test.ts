/**
 * Ctrl+I over a bullet (SPEC §16.3).
 *
 * The claim is that the shortcut writes markup the renderer actually parses,
 * and that it is a toggle rather than a one-way trip. So every wrap below is
 * read back through `parseInlineMarkup` — the same function the PDF is built
 * with — instead of being compared to a string that only looks right, and
 * every case is pressed twice to confirm it lands where it started.
 */
import { describe, expect, it } from "vitest";

import { isItalicShortcut, toggleItalic } from "./markup-edit";

import { parseInlineMarkup } from "@/lib/render/markup";

/** What the renderer would set in italic, given this text. */
const italics = (text: string): string[] =>
  parseInlineMarkup(text)
    .filter((segment) => segment.italic)
    .map((segment) => segment.text);

/** `toggleItalic` applied to the selection a pair of markers describe. */
const press = (text: string, start: number, end: number) => toggleItalic(text, start, end);

describe("toggleItalic", () => {
  it("wraps the selection in the markup the renderer parses", () => {
    const text = "Delivered a website for BrightPath last year";
    const start = text.indexOf("BrightPath");
    const result = press(text, start, start + "BrightPath".length);

    expect(result.text).toBe("Delivered a website for *BrightPath* last year");
    expect(italics(result.text)).toEqual(["BrightPath"]);
    expect(result.text.slice(result.start, result.end)).toBe("BrightPath");
  });

  it("takes it off again when pressed on the phrase inside the markers", () => {
    const text = "Delivered a website for *BrightPath* last year";
    const start = text.indexOf("BrightPath");
    const result = press(text, start, start + "BrightPath".length);

    expect(result.text).toBe("Delivered a website for BrightPath last year");
    expect(italics(result.text)).toEqual([]);
  });

  it("takes it off when the selection swept the markers up too", () => {
    const text = "for *BrightPath* last";
    const start = text.indexOf("*");
    const result = press(text, start, text.lastIndexOf("*") + 1);

    expect(result.text).toBe("for BrightPath last");
    expect(result.text.slice(result.start, result.end)).toBe("BrightPath");
  });

  it("returns to where it started when pressed twice", () => {
    const text = "Built the payments API";
    const start = text.indexOf("payments");
    const once = press(text, start, start + "payments".length);
    const twice = press(once.text, once.start, once.end);

    expect(twice.text).toBe(text);
    expect(twice.text.slice(twice.start, twice.end)).toBe("payments");
  });

  it("leaves the caret between an empty pair when nothing is selected", () => {
    const result = press("Built ", 6, 6);

    expect(result.text).toBe("Built **");
    expect(result.start).toBe(7);
    expect(result.end).toBe(7);
    // §16.3: an empty pair emphasizes nothing, so it prints as it stands
    // until the phrase is typed between the asterisks.
    expect(italics(result.text)).toEqual([]);
  });

  it("leaves the space a double-click swept up outside the markers", () => {
    const text = "Built the payments API";
    const start = text.indexOf("payments");
    const result = press(text, start, start + "payments ".length);

    expect(result.text).toBe("Built the *payments* API");
    expect(italics(result.text)).toEqual(["payments"]);
  });

  it("escapes a literal asterisk it is wrapping, rather than closing on it", () => {
    const text = "Shipped 3*4 boards";
    const start = text.indexOf("3*4");
    const result = press(text, start, start + "3*4".length);

    expect(result.text).toBe("Shipped *3\\*4* boards");
    // The pair spans the whole phrase — the inner asterisk prints as itself.
    expect(italics(result.text)).toEqual(["3*4"]);

    const back = press(result.text, result.start, result.end);
    expect(back.text).toBe(text);
  });

  it("treats a selection of nothing but spaces as no selection", () => {
    const result = press("a   b", 1, 4);

    expect(result.text).toBe("a**   b");
    expect(result.start).toBe(2);
  });

  it("survives a selection given backwards, or off the end of the text", () => {
    const text = "payments";

    expect(press(text, 8, 0).text).toBe("*payments*");
    expect(press(text, 0, 99).text).toBe("*payments*");
    expect(press(text, 99, 99).text).toBe("payments**");
  });
});

describe("isItalicShortcut", () => {
  const event = (over: Partial<Parameters<typeof isItalicShortcut>[0]>) =>
    isItalicShortcut({ key: "i", ctrlKey: false, metaKey: false, altKey: false, ...over });

  it("is Ctrl+I, and Cmd+I on a Mac", () => {
    expect(event({ ctrlKey: true })).toBe(true);
    expect(event({ metaKey: true })).toBe(true);
    expect(event({ ctrlKey: true, key: "I" })).toBe(true);
  });

  it("is not a bare letter, another letter, or an Alt combination", () => {
    expect(event({})).toBe(false);
    expect(event({ ctrlKey: true, key: "b" })).toBe(false);
    expect(event({ ctrlKey: true, altKey: true })).toBe(false);
  });
});
