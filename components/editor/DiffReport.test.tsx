/**
 * The comparison as it is drawn (SPEC §7).
 *
 * `diff.test.ts` settles what the two variants differ by; this settles that
 * the report says which side each row is on, in words as well as in colour,
 * and that it names the other variant rather than calling it "the other one".
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiffReport } from "./DiffReport";
import type { DiffRow, VariantDiff } from "./diff";

const OTHER = "tailored_2026-08-01";

function row(over: Partial<DiffRow> & Pick<DiffRow, "id" | "label" | "side">): DiffRow {
  return {
    key: over.id,
    reordered: false,
    options: [],
    children: [],
    ...over,
  };
}

function report(rows: DiffRow[], over: Partial<VariantDiff> = {}): string {
  const diff: VariantDiff = {
    rows,
    sectionsReordered: false,
    summary: { onlyA: 1, onlyB: 1, shared: 1, options: 0, reordered: 0 },
    identical: false,
    ...over,
  };
  return renderToStaticMarkup(<DiffReport diff={diff} other={OTHER} rows={diff.rows} />);
}

/** The one row element carrying `id`, up to where its own children start. */
function rowMarkup(html: string, id: string): string {
  const at = html.indexOf(`data-diff-id="${id}"`);
  expect(at).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf("<li", at), html.indexOf("</div>", at));
}

describe("DiffReport", () => {
  it("marks each row with the side it is on, and says which in words", () => {
    const html = report([
      row({ id: "exp-acme", label: "Backend Engineer — Acme", side: "a" }),
      row({ id: "exp-globex", label: "Intern — Globex", side: "b" }),
      row({ id: "exp-initech", label: "Dev — Initech", side: "both" }),
    ]);

    expect(rowMarkup(html, "exp-acme")).toContain('data-diff-side="a"');
    expect(rowMarkup(html, "exp-acme")).toContain("Only in this variant");
    expect(rowMarkup(html, "exp-globex")).toContain(`Only in ${OTHER}`);
    expect(rowMarkup(html, "exp-initech")).toContain("In both");
  });

  it("draws entries and their bullets under the section they belong to", () => {
    const html = report([
      row({
        id: "experience",
        label: "Experience",
        side: "both",
        children: [
          row({
            id: "exp-acme",
            label: "Backend Engineer — Acme",
            side: "both",
            children: [row({ id: "exp-acme-b1", label: "Built it.", side: "a" })],
          }),
        ],
      }),
    ]);

    // Section, entry, bullet — each nested inside the last, and each further in.
    expect(html.indexOf("Experience")).toBeLessThan(html.indexOf("Backend Engineer"));
    expect(html.indexOf("Backend Engineer")).toBeLessThan(html.indexOf("Built it."));
    expect(rowMarkup(html, "exp-acme")).toContain("pl-4");
    expect(rowMarkup(html, "exp-acme-b1")).toContain("pl-8");
  });

  it("names both values of a setting the two sides disagree about", () => {
    const html = report([
      row({
        id: "header",
        label: "Header",
        side: "both",
        options: [{ label: "Style", a: "Full", b: "Minimal" }],
      }),
    ]);

    expect(html).toContain("data-diff-option");
    expect(html).toContain("Style");
    expect(html).toContain("Full");
    expect(html).toContain(`Minimal</span> in ${OTHER}`);
  });

  it("flags a list both sides hold in a different order", () => {
    const html = report([row({ id: "experience", label: "Experience", side: "both", reordered: true })]);
    expect(html).toContain("data-diff-reordered");
    expect(html).toContain("different order");
  });

  it("prints the tally, naming the variant the second figure belongs to", () => {
    const html = report([], {
      summary: { onlyA: 3, onlyB: 5, shared: 41, options: 2, reordered: 0 },
    });

    expect(html).toContain("data-diff-summary");
    expect(html).toContain(">3</span> only here");
    expect(html).toContain(">5</span> only in");
    expect(html).toContain("41 in both");
    expect(html).toContain("2 settings differ");
    expect(html).not.toContain("different order");
  });

  it("counts one disagreeing setting in the singular", () => {
    const html = report([], {
      summary: { onlyA: 0, onlyB: 0, shared: 87, options: 1, reordered: 0 },
    });
    expect(html).toContain("1 setting differs");
  });

  it("says so in one line when the two curate the same content", () => {
    const html = report([row({ id: "header", label: "Header", side: "both" })], {
      identical: true,
      summary: { onlyA: 0, onlyB: 0, shared: 1, options: 0, reordered: 0 },
    });

    expect(html).toContain("data-diff-identical");
    expect(html).not.toContain("data-diff-row");
  });
});
