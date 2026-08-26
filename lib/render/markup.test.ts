import { describe, expect, it } from "vitest";

import {
  parseInlineMarkup,
  serializeInlineMarkup,
  writeInlineMarkup,
  type MarkupNode,
  type MarkupSegment,
} from "./markup";

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

/**
 * A block as the renderer draws it — a span per roman run, an `em` per italic
 * one — built by hand so the serializer can be read without a browser.
 * `InlineText` and `editable`'s `markupNodes` both produce exactly this shape.
 */
function text(value: string): MarkupNode {
  return { nodeType: 3, nodeName: "#text", nodeValue: value, childNodes: [] };
}

function element(name: string, children: MarkupNode[]): MarkupNode {
  return { nodeType: 1, nodeName: name, nodeValue: null, childNodes: children };
}

/** What the document holds for `markup`, as a node the serializer can read. */
function rendered(markup: string): MarkupNode {
  return element(
    "SPAN",
    parseInlineMarkup(markup).map((segment) =>
      element(segment.italic ? "EM" : "SPAN", [text(segment.text)]),
    ),
  );
}

describe("serializing a rendered block", () => {
  it("reads plain text back as itself", () => {
    expect(serializeInlineMarkup(rendered("No markup here"))).toBe("No markup here");
  });

  it("reads an italic run back as the markup that made it", () => {
    const markup = "Delivered production website for *BrightPath*, a retailer";
    expect(serializeInlineMarkup(rendered(markup))).toBe(markup);
  });

  // A browser's own italic command inserts `<i>`, not `<em>`. Dropping it
  // would silently lose emphasis applied with the key everyone uses for it.
  it("reads a browser's own italic element as emphasis too", () => {
    const block = element("SPAN", [text("a "), element("I", [text("b")])]);
    expect(serializeInlineMarkup(block)).toBe("a *b*");
  });

  it("reads nested markup by the outermost face it sits in", () => {
    const block = element("SPAN", [element("EM", [element("SPAN", [text("deep")])])]);
    expect(serializeInlineMarkup(block)).toBe("*deep*");
  });

  it("joins runs that ended up split across nodes", () => {
    const block = element("SPAN", [text("one "), element("SPAN", [text("two")])]);
    expect(serializeInlineMarkup(block)).toBe("one two");
  });

  // Typing two spaces in a contentEditable block writes one of them as U+00A0.
  it("stores a non-breaking space as an ordinary one", () => {
    expect(serializeInlineMarkup(element("SPAN", [text("a  b")]))).toBe("a  b");
  });

  it("ignores what the document has no way to store", () => {
    const block = element("SPAN", [text("a"), element("BR", []), text("b")]);
    expect(serializeInlineMarkup(block)).toBe("ab");
  });

  it("reads an emptied block as an empty bullet", () => {
    expect(serializeInlineMarkup(element("SPAN", []))).toBe("");
  });
});

describe("writing markup back", () => {
  it("leaves a lone asterisk spelled the way the field would spell it", () => {
    expect(writeInlineMarkup([roman("2 * 3")])).toBe("2 * 3");
    expect(writeInlineMarkup([roman("*dangling")])).toBe("*dangling");
  });

  it("escapes only where the plain spelling would re-pair", () => {
    expect(writeInlineMarkup([roman("2 * 3 and 4 * 5")])).toBe("2 \\* 3 and 4 \\* 5");
    expect(writeInlineMarkup([italic("2 * 3")])).toBe("*2 \\* 3*");
  });

  // The promise §16.3 makes is about the rendered result, not the spelling.
  it("round-trips every bullet shape through the document and back", () => {
    const bullets = [
      "",
      "No markup here",
      "*Atlas Traders*",
      "*a* and *b*",
      "Delivered production website for *BrightPath*, a retailer",
      "2 * 3",
      "*dangling",
      "a * b c",
      "*a* b * c",
      "a ** b",
      "a \\* b",
      "*2 \\* 3*",
      "a  b",
    ];

    for (const bullet of bullets) {
      const back = serializeInlineMarkup(rendered(bullet));
      expect(parseInlineMarkup(back), bullet).toEqual(parseInlineMarkup(bullet));
    }
  });
});
