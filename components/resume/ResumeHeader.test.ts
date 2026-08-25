import { describe, expect, it } from "vitest";

import { contactLines, titleLine } from "./ResumeHeader";

const header = {
  name: "Jordan A. Rivera",
  title: "Aspiring Backend Engineer",
  location: "Northside, Springfield, SP-1010",
  email: "jordan.rivera@example.com",
  phone: "+1-555-0142",
  linkedin: "linkedin.com/in/jordan-rivera",
  github: "github.com/jordan-rivera-demo",
  links: [],
};

describe("contactLines", () => {
  it("puts email, linkedin and github on one line in minimal mode (§5.1)", () => {
    expect(contactLines(header, "minimal")).toEqual([
      "jordan.rivera@example.com | linkedin.com/in/jordan-rivera | github.com/jordan-rivera-demo",
    ]);
  });

  it("splits location/email/phone from linkedin/github in full mode (§5.1)", () => {
    expect(contactLines(header, "full")).toEqual([
      "Northside, Springfield, SP-1010 | jordan.rivera@example.com | +1-555-0142",
      "linkedin.com/in/jordan-rivera | github.com/jordan-rivera-demo",
    ]);
  });

  it("drops an empty field instead of leaving a stranded separator", () => {
    expect(contactLines({ ...header, phone: "" }, "full")[0]).toBe(
      "Northside, Springfield, SP-1010 | jordan.rivera@example.com",
    );
  });

  it("emits no line at all when every field on it is empty", () => {
    expect(contactLines({ ...header, linkedin: "", github: "" }, "full")).toHaveLength(1);
  });

  it("appends extra links after github, in library order (§16.6)", () => {
    const withLinks = {
      ...header,
      links: [
        { id: "link-a", text: "portfolio.example.com" },
        { id: "link-b", text: "x.com/jordan-rivera-demo" },
      ],
    };

    expect(contactLines(withLinks, "full")[1]).toBe(
      "linkedin.com/in/jordan-rivera | github.com/jordan-rivera-demo | portfolio.example.com | x.com/jordan-rivera-demo",
    );
    expect(contactLines(withLinks, "minimal")[0]).toBe(
      "jordan.rivera@example.com | linkedin.com/in/jordan-rivera | github.com/jordan-rivera-demo | portfolio.example.com | x.com/jordan-rivera-demo",
    );
  });

  it("keeps a link line rather than stranding a separator on a blank link", () => {
    const withBlank = { ...header, links: [{ id: "link-a", text: "  " }] };
    expect(contactLines(withBlank, "full")[1]).toBe(
      "linkedin.com/in/jordan-rivera | github.com/jordan-rivera-demo",
    );
  });
});

describe("titleLine", () => {
  it("prints the title only when the variant asks for it (§16.6)", () => {
    expect(titleLine(header, true)).toBe("Aspiring Backend Engineer");
    expect(titleLine(header, false)).toBeNull();
  });

  it("prints nothing when the library has no title to show", () => {
    // A blank line would still occupy 12pt and shift About Me, so "asked for
    // but empty" has to render as absent, not as an empty div.
    expect(titleLine({ ...header, title: "" }, true)).toBeNull();
    expect(titleLine({ ...header, title: "   " }, true)).toBeNull();
  });
});
