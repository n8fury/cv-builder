import { describe, expect, it } from "vitest";

import { contentLibrarySchema, headerSchema, type ContentLibrary } from "../schema/library";
import {
  EXCLUDED_HEADER_FIELDS,
  HEADER_FIELDS,
  generateLinkId,
  headerFieldValues,
  normalizeLinkUrl,
  setHeaderLinks,
  updateHeaderFields,
} from "./header-edit";

const library: ContentLibrary = contentLibrarySchema.parse({
  schemaVersion: 1,
  header: {
    name: "Jordan A. Rivera",
    title: "Aspiring Backend Engineer",
    location: "Northside, Springfield, SP-1010",
    email: "jordan.rivera@example.com",
    phone: "+1-555-0142",
    linkedin: "linkedin.com/in/jordan-rivera",
    github: "github.com/jordan-rivera-demo",
    links: [{ id: "link-aaaaaa", text: "portfolio.example.com" }],
  },
  competencies: [{ id: "comp-1", text: "Keep me" }],
});

describe("HEADER_FIELDS", () => {
  it("offers every header field the schema carries, minus the list ones", () => {
    // The same guard library-index.test.ts puts on ITEM_FIELDS: a field added
    // to the header but not here would be stored, rendered on every CV, and
    // impossible to change from the one screen meant to edit it.
    const expected = Object.keys(headerSchema.shape)
      .filter(
        (name) => !EXCLUDED_HEADER_FIELDS.includes(name as (typeof EXCLUDED_HEADER_FIELDS)[number]),
      )
      .sort();

    expect(HEADER_FIELDS.map((field) => field.name).sort()).toEqual(expected);
  });

  it("reads the current values in the order the form shows them", () => {
    expect(headerFieldValues(library).map((field) => [field.name, field.value])).toEqual([
      ["name", "Jordan A. Rivera"],
      ["title", "Aspiring Backend Engineer"],
      ["location", "Northside, Springfield, SP-1010"],
      ["email", "jordan.rivera@example.com"],
      ["phone", "+1-555-0142"],
      ["linkedin", "linkedin.com/in/jordan-rivera"],
      ["github", "github.com/jordan-rivera-demo"],
    ]);
  });
});

describe("updateHeaderFields", () => {
  it("rewrites only the fields it was given", () => {
    const next = updateHeaderFields(library, { title: "Software Engineer" });

    expect(next.header.title).toBe("Software Engineer");
    expect(next.header.name).toBe("Jordan A. Rivera");
    expect(next.header.email).toBe("jordan.rivera@example.com");
  });

  it("leaves an absent field alone rather than blanking it", () => {
    // What lets the links form post without carrying every text box with it.
    expect(updateHeaderFields(library, {}).header).toEqual(library.header);
  });

  it("trims, because a stray space shifts a centered line on the page", () => {
    expect(updateHeaderFields(library, { title: "  Backend Engineer  " }).header.title).toBe(
      "Backend Engineer",
    );
  });

  it("clears a field when the value is genuinely empty", () => {
    expect(updateHeaderFields(library, { phone: "" }).header.phone).toBe("");
  });

  it("ignores a key the field list does not declare", () => {
    const next = updateHeaderFields(library, {
      name: "New Name",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({ nonsense: "x" } as any),
    });

    expect(next.header.name).toBe("New Name");
    expect("nonsense" in next.header).toBe(false);
  });

  it("leaves the rest of the library untouched", () => {
    expect(updateHeaderFields(library, { name: "X" }).competencies).toEqual(library.competencies);
  });
});

describe("setHeaderLinks", () => {
  it("replaces the list, in the order given", () => {
    const next = setHeaderLinks(library, [
      { id: "link-aaaaaa", text: "portfolio.example.com" },
      { id: "link-bbbbbb", text: "x.com/jordan-rivera-demo" },
    ]);

    expect(next.header.links).toEqual([
      { id: "link-aaaaaa", text: "portfolio.example.com", url: null },
      { id: "link-bbbbbb", text: "x.com/jordan-rivera-demo", url: null },
    ]);
  });

  it("keeps an existing link's id across an edit to its text", () => {
    const next = setHeaderLinks(library, [{ id: "link-aaaaaa", text: "new.example.com" }]);
    expect(next.header.links).toEqual([
      { id: "link-aaaaaa", text: "new.example.com", url: null },
    ]);
  });

  it("mints an id for a row that arrives without one", () => {
    const next = setHeaderLinks(library, [{ text: "dev.to/jordan-rivera-demo" }]);

    expect(next.header.links).toHaveLength(1);
    expect(next.header.links[0].id).toMatch(/^link-[a-z0-9]{6}$/);
    expect(next.header.links[0].text).toBe("dev.to/jordan-rivera-demo");
  });

  it("drops a blank row, which is how the form deletes one", () => {
    // A blank renders nothing — the contact line filters empty fields out —
    // so storing it would leave a row that cannot appear on any CV.
    const next = setHeaderLinks(library, [
      { id: "link-aaaaaa", text: "  " },
      { text: "x.com/jordan-rivera-demo" },
    ]);

    expect(next.header.links.map((link) => link.text)).toEqual(["x.com/jordan-rivera-demo"]);
  });

  it("clears the list when every row is blank", () => {
    expect(setHeaderLinks(library, [{ id: "link-aaaaaa", text: "" }]).header.links).toEqual([]);
  });

  it("trims a link's text", () => {
    expect(setHeaderLinks(library, [{ text: " x.com/jordan-rivera-demo " }]).header.links[0].text).toBe(
      "x.com/jordan-rivera-demo",
    );
  });

  it("leaves the header's own fields alone", () => {
    const next = setHeaderLinks(library, []);
    expect(next.header.name).toBe("Jordan A. Rivera");
    expect(next.header.title).toBe("Aspiring Backend Engineer");
  });

  it("stores a row's url and normalizes a missing scheme (§18.1)", () => {
    const next = setHeaderLinks(library, [
      { id: "link-aaaaaa", text: "portfolio.example.com", url: "portfolio.example.com" },
      { id: "link-bbbbbb", text: "Dev.to", url: "https://dev.to/jordan-rivera-demo" },
      { id: "link-cccccc", text: "X", url: "  " },
    ]);

    expect(next.header.links.map((link) => link.url)).toEqual([
      "https://portfolio.example.com",
      "https://dev.to/jordan-rivera-demo",
      null,
    ]);
  });

  it("keeps a row whose url is blank — text with no target still prints", () => {
    const next = setHeaderLinks(library, [{ id: "link-aaaaaa", text: "x.com/jordan-rivera-demo" }]);
    expect(next.header.links).toEqual([
      { id: "link-aaaaaa", text: "x.com/jordan-rivera-demo", url: null },
    ]);
  });

  it("refuses a url the schema cannot store rather than dropping it silently", () => {
    // Passed through unchanged so `z.url()` rejects it and the form reports
    // it: quietly discarding a URL someone typed is the worse outcome.
    expect(() =>
      setHeaderLinks(library, [{ id: "link-aaaaaa", text: "X", url: "https://" }]),
    ).toThrow();
  });
});

describe("normalizeLinkUrl", () => {
  it("returns null for nothing at all", () => {
    expect(normalizeLinkUrl("")).toBeNull();
    expect(normalizeLinkUrl("   ")).toBeNull();
    expect(normalizeLinkUrl(null)).toBeNull();
    expect(normalizeLinkUrl(undefined)).toBeNull();
  });

  it("adds https:// only when there is no scheme", () => {
    expect(normalizeLinkUrl("example.com")).toBe("https://example.com");
    expect(normalizeLinkUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeLinkUrl("mailto:me@example.com")).toBe("mailto:me@example.com");
  });
});

describe("generateLinkId", () => {
  it("does not hand back an id already in use", () => {
    const taken = new Set(["link-aaaaaa"]);
    expect(generateLinkId(taken)).not.toBe("link-aaaaaa");
    expect(generateLinkId(taken)).toMatch(/^link-[a-z0-9]{6}$/);
  });
});
