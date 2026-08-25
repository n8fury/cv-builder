import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ResumeHeader, contactFields, contactLines, titleLine } from "./ResumeHeader";

import type { Header } from "@/lib/schema/library";

const header: Header = {
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
        { id: "link-a", text: "portfolio.example.com", url: null },
        { id: "link-b", text: "x.com/jordan-rivera-demo", url: null },
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
    const withBlank = { ...header, links: [{ id: "link-a", text: "  ", url: null }] };
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

/** Every field on every line, flattened — the order they print in. */
const flat = (h: Header, mode: "full" | "minimal") => contactFields(h, mode).flat();

/** The href derived for one named field, with the rest of the header blank. */
const hrefFor = (field: keyof Header, value: string): string | null => {
  const only = { ...header, location: "", email: "", phone: "", linkedin: "", github: "" };
  return flat({ ...only, [field]: value }, "full")[0]?.href ?? null;
};

describe("contactFields hrefs (§18.1)", () => {
  it("derives mailto, tel and both socials from the printed text", () => {
    expect(flat(header, "full").map((entry) => entry.href)).toEqual([
      null, // location is not a link
      "mailto:jordan.rivera@example.com",
      "tel:+15550142",
      "https://linkedin.com/in/jordan-rivera",
      "https://github.com/jordan-rivera-demo",
    ]);
  });

  it("expands a bare handle to the site's profile URL", () => {
    expect(hrefFor("github", "jordan-rivera-demo")).toBe("https://github.com/jordan-rivera-demo");
    expect(hrefFor("linkedin", "jordan-rivera")).toBe("https://linkedin.com/in/jordan-rivera");
  });

  it("keeps a scheme the person already typed rather than doubling it", () => {
    expect(hrefFor("github", "https://github.com/jordan-rivera-demo")).toBe("https://github.com/jordan-rivera-demo");
  });

  it("links nothing it cannot address, rather than guessing", () => {
    // A display form with spaces in it is prose, not an address — LinkedIn's
    // own fallback for a profile with no vanity URL looks like this.
    expect(hrefFor("linkedin", "Jordan Rivera")).toBeNull();
    expect(hrefFor("email", "not an address")).toBeNull();
    expect(hrefFor("email", "no-at-sign.example.com")).toBeNull();
    expect(hrefFor("phone", "ext. 4")).toBeNull();
  });

  it("takes an extra link's target from its stored url, never from its text", () => {
    const links = [
      { id: "link-a", text: "portfolio.example.com", url: "https://portfolio.example.com" },
      { id: "link-b", text: "Dev.to", url: null },
    ];
    expect(flat({ ...header, links }, "minimal").slice(-2)).toEqual([
      { text: "portfolio.example.com", href: "https://portfolio.example.com" },
      { text: "Dev.to", href: null },
    ]);
  });
});

/** The header's rendered text with every tag stripped — what the PDF prints. */
function printedText(h: Header, mode: "full" | "minimal"): string[] {
  const markup = renderToStaticMarkup(<ResumeHeader header={h} mode={mode} showTitle={false} />);
  // A contact line holds only spans and anchors, so the first `</div>` after
  // one is always its own close.
  const lines = markup.matchAll(/<div class="resume-contact"[^>]*>([\s\S]*?)<\/div>/g);
  return [...lines].map((match) => match[1].replace(/<[^>]*>/g, ""));
}

describe("ResumeHeader markup", () => {
  it("prints exactly the same characters with the anchors as without (§18.1)", () => {
    // The whole of §18.1 turns on this: hrefs are an addition to the markup,
    // not a change to the ink, so §4.1's measured lines and §11.2's golden
    // stay valid. Held against contactLines, which is the printed text.
    const linked = {
      ...header,
      links: [{ id: "link-a", text: "portfolio.example.com", url: "https://portfolio.example.com" }],
    };
    expect(printedText(linked, "full")).toEqual(contactLines(linked, "full"));
    expect(printedText(linked, "minimal")).toEqual(contactLines(linked, "minimal"));
  });

  it("puts the separator outside the anchor, so no ' | ' is clickable", () => {
    const markup = renderToStaticMarkup(
      <ResumeHeader header={header} mode="minimal" showTitle={false} />,
    );
    expect(markup).not.toMatch(/<a[^>]*>[^<]*\|/);
    expect(markup).toContain('<a class="resume-contact-link" href="mailto:jordan.rivera@example.com">');
  });

  it("renders an unlinkable field as bare text, not as an empty anchor", () => {
    const markup = renderToStaticMarkup(
      <ResumeHeader header={header} mode="full" showTitle={false} />,
    );
    expect(markup).toContain("Northside, Springfield, SP-1010");
    expect(markup).not.toMatch(/<a[^>]*>Northside/);
  });
});
