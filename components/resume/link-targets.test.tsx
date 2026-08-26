import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ResumeSection } from "./ResumeSection";
import { ResumeSectionBody } from "./ResumeSectionBody";
import { FOCUS_CLASS, LINKED_CLASS, linkSelector, linkTarget } from "./link-targets";

import type { ResolvedSection } from "@/lib/data/resolve";
import { SECTION_TITLE } from "@/lib/render/section-titles";

const css = readFileSync(join(process.cwd(), "components/resume/resume.css"), "utf8");

function markup(section: Exclude<ResolvedSection, { type: "header" }>): string {
  const title = section.type === "custom" ? section.section.title : SECTION_TITLE[section.type];
  return renderToStaticMarkup(
    <ResumeSection type={section.type} title={title}>
      <ResumeSectionBody section={section} />
    </ResumeSection>,
  );
}

describe("link target attributes", () => {
  it("names an experience entry and every bullet under it", () => {
    const html = markup({
      type: "experience",
      splitEntries: false,
      entries: [
        {
          id: "exp-acme",
          title: "Senior Engineer",
          company: "Acme",
          dates: "2020 — now",
          location: "Springfield",
          bullets: [
            { id: "exp-acme-b1", text: "Shipped it." },
            { id: "exp-acme-b2", text: "Shipped it again." },
          ],
        },
      ],
    });

    expect(html).toContain('data-entry="exp-acme"');
    expect(html).toContain('data-bullet="exp-acme-b1"');
    expect(html).toContain('data-bullet="exp-acme-b2"');
  });

  it("keeps the entry kind on its own attribute", () => {
    // It used to be `data-entry`, which is now the entry's id — and resume.css
    // selects the per-section bullet indents through it, so a rename that
    // missed the stylesheet would silently change §4.4's measured geometry.
    const html = markup({ type: "projects", splitEntries: false, entries: [project()] });

    expect(html).toContain('data-entry-kind="projects"');
    expect(css).toContain('.resume-entry[data-entry-kind="projects"]');
    expect(css).not.toContain('.resume-entry[data-entry="');
  });

  it("names a competency, which the form curates one row at a time", () => {
    const html = markup({
      type: "competencies",
      items: [{ id: "comp-api", text: "API design" }],
    });

    expect(html).toContain('data-entry="comp-api"');
    // The separator is a sibling of the span, not inside it: a highlight has
    // to cover the competency without the pipe that precedes it.
    expect(markup({
      type: "competencies",
      items: [
        { id: "comp-a", text: "A" },
        { id: "comp-b", text: "B" },
      ],
    })).toContain(' | <span data-entry="comp-b">');
  });

  it("names a skill group and each skill in it", () => {
    const html = markup({
      type: "skills",
      groups: [
        {
          id: "grp-backend",
          label: "Backend",
          skills: [{ id: "skill-node", text: "Node.js" }],
        },
      ],
    });

    expect(html).toContain('data-entry="grp-backend"');
    expect(html).toContain('data-bullet="skill-node"');
  });

  it("names a certification and a recommendation by their library ids", () => {
    expect(
      markup({
        type: "certifications",
        entries: [
          { id: "cert-js", text: "JavaScript", dates: "2021", credentialUrl: null, tags: [] },
        ],
      }),
    ).toContain('data-entry="cert-js"');

    expect(
      markup({
        type: "recommendations",
        mode: "expanded",
        entries: [
          { id: "rec-lee", name: "Lee", role: "Manager", location: "", email: "", tags: [] },
        ],
      }),
    ).toContain('data-entry="rec-lee"');
  });

  it("renders education's description as a bullet the form has no field for", () => {
    // Which is why `linkTargetsAt` answers with a list: the click falls
    // through to the entry rather than going nowhere.
    const html = markup({
      type: "education",
      entries: [
        {
          id: "edu-uni",
          institution: "University",
          degree: "BSc",
          dates: "2019",
          description: "Graduated.",
        },
      ],
    });

    expect(html).toContain('data-entry="edu-uni"');
    expect(html).toContain('data-bullet="edu-uni-description"');
  });
});

describe("link selectors", () => {
  it("quotes the id, so a selector cannot be broken by one", () => {
    expect(linkSelector({ kind: "bullet", id: "b1" })).toBe('[data-bullet="b1"]');
    expect(linkSelector({ kind: "entry", id: 'a"b' })).toBe('[data-entry="a\\"b"]');
  });

  it("spells an attribute the same way the selector reads it", () => {
    expect(linkTarget("entry", "exp-acme")).toEqual({ "data-entry": "exp-acme" });
  });
});

describe("the classes the editor toggles", () => {
  it("are the ones the stylesheet actually styles", () => {
    // Set from TypeScript, styled in CSS: nothing but this test holds the two
    // spellings together.
    expect(css).toContain(`.${LINKED_CLASS} .${FOCUS_CLASS}`);
    expect(css).toContain(`.${LINKED_CLASS} [data-entry]`);
  });

  it("styles them for screen only, so no export can carry them", () => {
    // The last at-rule opened above the rule is the one it sits in.
    const above = css.slice(0, css.indexOf(`.${LINKED_CLASS} [data-entry]`));
    expect(above.lastIndexOf("@media screen")).toBeGreaterThan(above.lastIndexOf("@media print"));
  });
});

function project() {
  return {
    id: "prj-one",
    title: "One",
    subtitle: "A project",
    dates: "2024",
    repoUrl: null,
    demoUrl: null,
    bullets: [],
  };
}
