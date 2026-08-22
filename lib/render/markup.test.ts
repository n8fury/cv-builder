import { describe, expect, it } from "vitest";

import { parseInlineMarkup, type MarkupSegment } from "./markup";

const roman = (text: string): MarkupSegment => ({ text, italic: false });
const italic = (text: string): MarkupSegment => ({ text, italic: true });

describe("paired asterisks", () => {
  it("turns a paired run into an italic segment", () => {
    expect(parseInlineMarkup("Delivered production website for *BrightPath*, a retailer")).toEqual(
      [
        roman("Delivered production website for "),
        italic("BrightPath"),
        roman(", a retailer"),
      ],
    );
  });

  it("handles a bullet that is entirely italic", () => {
    expect(parseInlineMarkup("*Atlas Traders*")).toEqual([italic("Atlas Traders")]);
  });

  it("handles more than one italic run", () => {
    expect(parseInlineMarkup("*a* and *b*")).toEqual([
      italic("a"),
      roman(" and "),
      italic("b"),
    ]);
  });

  it("returns plain text as a single roman segment", () => {
    expect(parseInlineMarkup("No markup here")).toEqual([roman("No markup here")]);
  });

  it("returns nothing for an empty string", () => {
    expect(parseInlineMarkup("")).toEqual([]);
  });
});

describe("escaping", () => {
  it("renders an escaped asterisk as a literal asterisk", () => {
    expect(parseInlineMarkup("5 \\* 3 = 15")).toEqual([roman("5 * 3 = 15")]);
  });

  it("does not let an escaped asterisk open or close a run", () => {
    expect(parseInlineMarkup("\\*not italic\\*")).toEqual([roman("*not italic*")]);
  });

  it("keeps an escaped asterisk inside an italic run", () => {
    expect(parseInlineMarkup("*a \\* b*")).toEqual([italic("a * b")]);
  });

  it("leaves a backslash before anything else alone", () => {
    expect(parseInlineMarkup("path\\to\\file")).toEqual([roman("path\\to\\file")]);
  });
});

describe("unpaired asterisks", () => {
  it("renders an unpaired asterisk literally without throwing", () => {
    expect(() => parseInlineMarkup("2 * 3 and *dangling")).not.toThrow();
    expect(parseInlineMarkup("*dangling")).toEqual([roman("*dangling")]);
  });

  it("does not swallow the rest of the bullet after a stray asterisk", () => {
    expect(parseInlineMarkup("a * b c")).toEqual([roman("a * b c")]);
  });

  it("pairs the first two asterisks and leaves the third literal", () => {
    expect(parseInlineMarkup("*a* b * c")).toEqual([italic("a"), roman(" b * c")]);
  });

  it("keeps an empty pair visible rather than dropping it", () => {
    expect(parseInlineMarkup("a ** b")).toEqual([roman("a ** b")]);
  });
});
