/**
 * What two variants of one profile differ by (SPEC §7, §11.4, §12.5).
 *
 * Everything here goes through the real path — a library, two variants, both
 * resolved and then compared — so the labels being asserted are the labels the
 * CV prints, not a fixture invented for the test.
 */
import { describe, expect, it } from "vitest";

import { resolveVariant } from "@/lib/data/resolve";
import { contentLibrarySchema, type ContentLibrary } from "@/lib/schema/library";
import { variantSchema, type Variant, type VariantSection } from "@/lib/schema/variant";

import { diffVariants, onlyDifferences, type DiffRow } from "./diff";

const library: ContentLibrary = contentLibrarySchema.parse({
  schemaVersion: 1,
  header: { name: "Jane Doe", title: "Engineer", email: "jane@example.com" },
  aboutMe: [
    { id: "about-long", key: "long", text: "The long paragraph." },
    { id: "about-short", key: "short", text: "The short one." },
  ],
  competencies: [
    { id: "comp-api", text: "API design" },
    { id: "comp-iot", text: "IoT" },
  ],
  experience: [
    {
      id: "exp-acme",
      title: "Backend Engineer",
      company: "Acme",
      location: "Springfield",
      dates: "2023—",
      bullets: [
        { id: "exp-acme-b1", text: "Built the tracking platform." },
        { id: "exp-acme-b2", text: "Cut latency in half." },
        { id: "exp-acme-b3", text: "Wrote the deployment runbook." },
      ],
    },
    {
      id: "exp-globex",
      title: "Intern",
      company: "Globex",
      location: "Remote",
      dates: "2022",
      bullets: [{ id: "exp-globex-b1", text: "Shipped the admin panel." }],
    },
  ],
  projects: [
    { id: "proj-fleet", title: "Fleet", subtitle: "GPS tracking", dates: "2024" },
  ],
  education: [
    { id: "edu-buet", institution: "BUET", degree: "BSc", dates: "2022", description: "" },
  ],
  skillGroups: [
    {
      id: "skg-backend",
      label: "Backend",
      skills: [
        { id: "sk-node", text: "Node.js" },
        { id: "sk-go", text: "Go" },
      ],
    },
  ],
  certifications: [{ id: "cert-aws", text: "AWS Certified", dates: "2024" }],
  recommendations: [
    { id: "rec-lee", name: "Lee", role: "CTO", location: "Springfield", email: "lee@example.com" },
    { id: "rec-sam", name: "Sam", role: "Lead", location: "Springfield", email: "sam@example.com" },
  ],
  languages: [{ id: "lang-en", language: "English", proficiency: "Fluent" }],
  customSections: [
    { id: "cus-awards", title: "Awards", paragraph: "Two of them." },
    { id: "cus-talks", title: "Talks", paragraph: "One of those." },
  ],
});

function variant(sections: VariantSection[]): Variant {
  return variantSchema.parse({
    schemaVersion: 1,
    tag: "test",
    label: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sections,
  });
}

/** Both sides resolved against the one library, as the panel does it. */
function compare(a: VariantSection[], b: VariantSection[]) {
  return diffVariants(
    resolveVariant(library, variant(a)),
    resolveVariant(library, variant(b)),
  );
}

const experience = (
  entries: { id: string; bullets: string[] }[],
  options: { visible?: boolean; splitEntries?: boolean } = {},
): VariantSection => ({
  type: "experience",
  visible: options.visible ?? true,
  options: { splitEntries: options.splitEntries ?? false },
  entries,
});

const header = (over: { mode?: "full" | "minimal"; showTitle?: boolean } = {}): VariantSection => ({
  type: "header",
  visible: true,
  options: { mode: over.mode ?? "full", showTitle: over.showTitle ?? false },
});

const aboutMe = (id: string): VariantSection => ({
  type: "aboutMe",
  visible: true,
  options: { aboutMeId: id },
});

/** Every row in the tree, parents before their children. */
function flatten(rows: readonly DiffRow[]): DiffRow[] {
  return rows.flatMap((row) => [row, ...flatten(row.children)]);
}

function labels(rows: readonly DiffRow[], side: "a" | "b"): string[] {
  return flatten(rows)
    .filter((row) => row.side === side)
    .map((row) => row.label);
}

/** The section row for a type, from the top level of the tree. */
function section(rows: readonly DiffRow[], id: string): DiffRow {
  const found = rows.find((row) => row.id === id);
  if (!found) throw new Error(`no ${id} row`);
  return found;
}

const ACME = [
  { id: "exp-acme", bullets: ["exp-acme-b1", "exp-acme-b2"] },
];

describe("diffVariants", () => {
  it("reports nothing for two variants curated the same way", () => {
    const diff = compare([header(), experience(ACME)], [header(), experience(ACME)]);

    expect(diff.identical).toBe(true);
    expect(diff.summary.onlyA).toBe(0);
    expect(diff.summary.onlyB).toBe(0);
    expect(diff.summary.shared).toBeGreaterThan(0);
  });

  it("names the entry each side has and the other does not", () => {
    const diff = compare(
      [experience([{ id: "exp-acme", bullets: [] }])],
      [experience([{ id: "exp-globex", bullets: [] }])],
    );

    expect(labels(diff.rows, "a")).toEqual(["Backend Engineer — Acme"]);
    expect(labels(diff.rows, "b")).toEqual(["Intern — Globex"]);
    expect(diff.identical).toBe(false);
  });

  it("names the bullets one side kept inside a shared entry", () => {
    const diff = compare(
      [experience([{ id: "exp-acme", bullets: ["exp-acme-b1", "exp-acme-b2"] }])],
      [experience([{ id: "exp-acme", bullets: ["exp-acme-b1", "exp-acme-b3"] }])],
    );

    const entry = section(diff.rows, "experience").children[0];
    expect(entry.side).toBe("both");
    expect(labels(diff.rows, "a")).toEqual(["Cut latency in half."]);
    expect(labels(diff.rows, "b")).toEqual(["Wrote the deployment runbook."]);
  });

  // The variant carries IDs, so the two sides can only differ by curation —
  // this is what keeps a library edit from reading as one side dropping a
  // bullet and the other adding one (§11.4).
  it("matches by id, so rewritten text is not a difference", () => {
    const rewritten = contentLibrarySchema.parse({
      ...library,
      experience: library.experience.map((entry) => ({
        ...entry,
        bullets: entry.bullets.map((bullet) => ({ ...bullet, text: `${bullet.text} (edited)` })),
      })),
    });
    const sections = [experience(ACME)];

    const diff = diffVariants(
      resolveVariant(rewritten, variant(sections)),
      resolveVariant(library, variant(sections)),
    );

    expect(diff.identical).toBe(true);
  });

  it("treats a section switched off as that side not having it, contents and all", () => {
    const diff = compare(
      [experience(ACME)],
      [experience(ACME, { visible: false })],
    );

    const row = section(diff.rows, "experience");
    expect(row.side).toBe("a");
    // The entry and both its bullets come with it, all on the same side.
    expect(flatten([row]).every((child) => child.side === "a")).toBe(true);
    expect(labels(diff.rows, "a")).toEqual([
      "Experience",
      "Backend Engineer — Acme",
      "Built the tracking platform.",
      "Cut latency in half.",
    ]);
  });

  it("reports a shared list held in a different order without moving the rows", () => {
    const diff = compare(
      [experience([{ id: "exp-acme", bullets: [] }, { id: "exp-globex", bullets: [] }])],
      [experience([{ id: "exp-globex", bullets: [] }, { id: "exp-acme", bullets: [] }])],
    );

    const row = section(diff.rows, "experience");
    expect(row.reordered).toBe(true);
    expect(row.children.map((child) => child.id)).toEqual(["exp-acme", "exp-globex"]);
    expect(row.children.every((child) => child.side === "both")).toBe(true);
    expect(diff.summary.reordered).toBe(1);
    expect(diff.identical).toBe(false);
  });

  it("reports sections held in a different order separately from their contents", () => {
    const diff = compare([header(), aboutMe("about-long")], [aboutMe("about-long"), header()]);

    expect(diff.sectionsReordered).toBe(true);
    expect(diff.rows.map((row) => row.id)).toEqual(["header", "aboutMe"]);
    expect(diff.identical).toBe(false);
  });

  it("slots an item only the other side has after the one it follows there", () => {
    const diff = compare(
      [experience([{ id: "exp-acme", bullets: ["exp-acme-b1", "exp-acme-b3"] }])],
      [experience([{ id: "exp-acme", bullets: ["exp-acme-b1", "exp-acme-b2", "exp-acme-b3"] }])],
    );

    const bullets = section(diff.rows, "experience").children[0].children;
    expect(bullets.map((row) => [row.id, row.side])).toEqual([
      ["exp-acme-b1", "both"],
      ["exp-acme-b2", "b"],
      ["exp-acme-b3", "both"],
    ]);
    expect(section(diff.rows, "experience").children[0].reordered).toBe(false);
  });

  it("puts an item the other side leads with above the whole list", () => {
    const diff = compare(
      [experience([{ id: "exp-acme", bullets: ["exp-acme-b2"] }])],
      [experience([{ id: "exp-acme", bullets: ["exp-acme-b1", "exp-acme-b2"] }])],
    );

    const bullets = section(diff.rows, "experience").children[0].children;
    expect(bullets.map((row) => row.id)).toEqual(["exp-acme-b1", "exp-acme-b2"]);
  });

  it("reports a different About Me version as one paragraph each", () => {
    const diff = compare([aboutMe("about-long")], [aboutMe("about-short")]);

    expect(labels(diff.rows, "a")).toEqual(["The long paragraph."]);
    expect(labels(diff.rows, "b")).toEqual(["The short one."]);
  });

  it("names the settings both sides carry and disagree about", () => {
    const diff = compare(
      [header({ mode: "full", showTitle: true }), experience(ACME, { splitEntries: true })],
      [header({ mode: "minimal", showTitle: true }), experience(ACME)],
    );

    expect(section(diff.rows, "header").options).toEqual([
      { label: "Style", a: "Full", b: "Minimal" },
    ]);
    expect(section(diff.rows, "experience").options).toEqual([
      { label: "Split across pages", a: "Allowed", b: "Never" },
    ]);
    expect(diff.summary.options).toBe(2);
    expect(diff.identical).toBe(false);
  });

  it("says how much detail Recommendations prints, alongside which are curated", () => {
    const recommendations = (mode: "collapsed" | "expanded", ids: string[]): VariantSection => ({
      type: "recommendations",
      visible: true,
      options: { mode },
      entries: ids.map((id) => ({ id })),
    });

    const diff = compare(
      [recommendations("expanded", ["rec-lee", "rec-sam"])],
      [recommendations("collapsed", ["rec-lee"])],
    );

    expect(section(diff.rows, "recommendations").options).toEqual([
      { label: "Detail", a: "Entries listed", b: "One line" },
    ]);
    expect(labels(diff.rows, "a")).toEqual(["Sam — Lead"]);
  });

  // Neither is curated item by item, so the only thing a variant decides
  // about them is whether the section prints at all (§12.3, §12.4).
  it("compares Languages and a custom section by their presence alone", () => {
    const languages: VariantSection = { type: "languages", visible: true, options: {} };
    const awards: VariantSection = {
      type: "custom",
      visible: true,
      options: { customSectionId: "cus-awards" },
    };
    const talks: VariantSection = {
      type: "custom",
      visible: true,
      options: { customSectionId: "cus-talks" },
    };

    const diff = compare([languages, awards], [talks]);

    expect(section(diff.rows, "languages").side).toBe("a");
    expect(section(diff.rows, "languages").children).toEqual([]);
    expect(section(diff.rows, "custom:cus-awards").side).toBe("a");
    expect(section(diff.rows, "custom:cus-talks").side).toBe("b");
    expect(labels(diff.rows, "a")).toEqual(["Languages", "Awards"]);
    expect(labels(diff.rows, "b")).toEqual(["Talks"]);
  });

  it("counts every row it drew, at every level", () => {
    const diff = compare(
      [experience([{ id: "exp-acme", bullets: ["exp-acme-b1", "exp-acme-b2"] }])],
      [experience([{ id: "exp-acme", bullets: ["exp-acme-b1"] }, { id: "exp-globex", bullets: ["exp-globex-b1"] }])],
    );

    // Only here: one bullet. Only there: Globex and its bullet.
    expect(diff.summary.onlyA).toBe(1);
    expect(diff.summary.onlyB).toBe(2);
    // The section, the shared entry and the shared bullet.
    expect(diff.summary.shared).toBe(3);
  });
});

describe("onlyDifferences", () => {
  it("drops what both sides agree on and keeps the path to what they do not", () => {
    const diff = compare(
      [header(), experience(ACME), aboutMe("about-long")],
      [header(), experience([{ id: "exp-acme", bullets: ["exp-acme-b1"] }]), aboutMe("about-long")],
    );

    const rows = onlyDifferences(diff.rows);
    expect(rows.map((row) => row.id)).toEqual(["experience"]);
    expect(flatten(rows).map((row) => row.id)).toEqual([
      "experience",
      "exp-acme",
      "exp-acme-b2",
    ]);
  });

  it("keeps a one-sided row whole, including what both would have shared", () => {
    const diff = compare([experience(ACME)], [experience(ACME, { visible: false })]);

    const rows = onlyDifferences(diff.rows);
    expect(flatten(rows)).toHaveLength(4);
  });

  it("keeps a section whose only difference is a setting or an order", () => {
    const settings = compare([header({ mode: "full" })], [header({ mode: "minimal" })]);
    expect(onlyDifferences(settings.rows).map((row) => row.id)).toEqual(["header"]);

    const order = compare(
      [experience([{ id: "exp-acme", bullets: [] }, { id: "exp-globex", bullets: [] }])],
      [experience([{ id: "exp-globex", bullets: [] }, { id: "exp-acme", bullets: [] }])],
    );
    const kept = onlyDifferences(order.rows);
    expect(kept.map((row) => row.id)).toEqual(["experience"]);
    expect(kept[0].children).toEqual([]);
  });

  it("leaves nothing at all for two variants curated the same way", () => {
    const diff = compare([header(), experience(ACME)], [header(), experience(ACME)]);
    expect(onlyDifferences(diff.rows)).toEqual([]);
  });
});
