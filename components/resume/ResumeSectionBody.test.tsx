import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ResumeSection } from "./ResumeSection";
import { ResumeSectionBody } from "./ResumeSectionBody";
import { COLLAPSED_TEXT } from "./ResumeRecommendations";

import type { ResolvedSection } from "@/lib/data/resolve";
import { SECTION_TITLE } from "@/lib/render/section-titles";

/** One section rendered exactly as the render route assembles it. */
function markup(section: Exclude<ResolvedSection, { type: "header" }>): string {
  const title = section.type === "custom" ? section.section.title : SECTION_TITLE[section.type];
  return renderToStaticMarkup(
    <ResumeSection type={section.type} title={title}>
      <ResumeSectionBody section={section} />
    </ResumeSection>,
  );
}

/** Every non-header section type, curated down to nothing (§13). */
const empty: Exclude<ResolvedSection, { type: "header" }>[] = [
  { type: "aboutMe", id: "about-empty", text: "" },
  { type: "competencies", items: [] },
  { type: "experience", entries: [] },
  { type: "projects", entries: [] },
  { type: "education", entries: [] },
  { type: "skills", groups: [] },
  { type: "certifications", entries: [] },
  { type: "languages", entries: [] },
  { type: "recommendations", mode: "expanded", entries: [] },
  {
    type: "custom",
    section: { id: "custom-empty", title: "Volunteering", paragraph: null, bullets: [] },
  },
];

describe("a visible section with nothing resolved under it (§13)", () => {
  it.each(empty.map((section) => [section.type, section] as const))(
    "renders %s as a heading with no body",
    (_type, section) => {
      const html = markup(section);

      expect(html).toContain("resume-section-heading");
      expect(html).not.toContain("resume-body");
      expect(html).not.toContain("resume-entry");
      expect(html).not.toContain("resume-bullet");
    },
  );

  it("keeps the heading text, so the section is still visible on the page", () => {
    expect(markup({ type: "competencies", items: [] })).toContain("Core Competencies");
    expect(
      markup({
        type: "custom",
        section: { id: "custom-empty", title: "Volunteering", paragraph: null, bullets: [] },
      }),
    ).toContain("Volunteering");
  });

  it("still renders collapsed Recommendations, whose line is fixed text (§5.9)", () => {
    expect(markup({ type: "recommendations", mode: "collapsed", entries: [] })).toContain(
      COLLAPSED_TEXT,
    );
  });

  it("renders a body as soon as one item is curated in", () => {
    const html = markup({ type: "competencies", items: [{ id: "comp-1", text: "REST APIs" }] });

    expect(html).toContain("resume-body");
    expect(html).toContain("REST APIs");
  });
});
