import { describe, expect, it } from "vitest";

import type { ContentLibrary } from "@/lib/schema/library";
import type { Variant } from "@/lib/schema/variant";

import { libraryIds } from "@/lib/data/ids";

import { createEditorStore, isDirty, type EditorSnapshot } from "./store";

const library = {
  schemaVersion: 1,
  header: {
    name: "A",
    title: "Aspiring Backend Engineer",
    location: "",
    email: "",
    phone: "",
    linkedin: "",
    github: "",
    links: [],
  },
  aboutMe: [
    { id: "about-default", key: "default", text: "Default about.", tags: [] },
    { id: "about-short", key: "short", text: "Short about.", tags: [] },
  ],
  competencies: [],
  experience: [
    {
      id: "exp-1",
      title: "Engineer",
      company: "Acme",
      location: "",
      dates: "",
      tags: [],
      bullets: [
        { id: "b1", text: "first", tags: [] },
        { id: "b2", text: "second", tags: [] },
      ],
    },
    {
      id: "exp-2",
      title: "Other",
      company: "Other",
      location: "",
      dates: "",
      tags: [],
      bullets: [{ id: "b1", text: "same id, other entry", tags: [] }],
    },
  ],
  projects: [],
  education: [],
  skillGroups: [
    {
      id: "skills-backend",
      label: "Backend",
      tags: [],
      skills: [
        { id: "skill-nodejs", text: "Node.js", tags: [] },
        { id: "skill-express", text: "Express.js", tags: [] },
      ],
    },
    {
      id: "skills-frontend",
      label: "Frontend",
      tags: [],
      skills: [{ id: "skill-react", text: "React.js", tags: [] }],
    },
  ],
  certifications: [],
  recommendations: [],
  languages: [],
  customSections: [],
} satisfies ContentLibrary;

const variant = {
  schemaVersion: 1,
  tag: "detailed",
  label: "Detailed",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  sections: [
    { type: "header", visible: true, options: { mode: "full", showTitle: false } },
    { type: "aboutMe", visible: true, options: { aboutMeId: "about-default" } },
    {
      type: "experience",
      visible: true,
      options: {},
      entries: [{ id: "exp-1", bullets: ["b1", "b2"] }],
    },
    {
      type: "skills",
      visible: true,
      options: {},
      groups: [{ id: "skills-backend", skills: ["skill-nodejs", "skill-express"] }],
    },
  ],
} satisfies Variant;

function open(): ReturnType<typeof createEditorStore> {
  return createEditorStore({ profileId: "p", variantId: "v", library, variant } as EditorSnapshot);
}

describe("editor store", () => {
  it("opens clean, with draft and saved holding the same document", () => {
    const store = open();
    expect(isDirty(store.getState())).toBe(false);
    expect(store.getState().draft).toEqual(store.getState().saved);
  });

  it("edits variant metadata on the draft only", () => {
    const store = open();
    store.getState().setLabel("Tailored");
    expect(store.getState().draft.variant.label).toBe("Tailored");
    expect(store.getState().saved.variant.label).toBe("Detailed");
    expect(isDirty(store.getState())).toBe(true);
  });

  it("edits a bullet in the library, addressed by owner and entry", () => {
    const store = open();
    store.getState().setBulletText("experience", "exp-1", "b1", "rewritten");

    const [first, second] = store.getState().draft.library.experience;
    expect(first.bullets.map((bullet) => bullet.text)).toEqual(["rewritten", "second"]);
    // Bullet IDs repeat across entries; only the addressed entry may change.
    expect(second.bullets[0].text).toBe("same id, other entry");
    expect(store.getState().saved.library.experience[0].bullets[0].text).toBe("first");
    expect(isDirty(store.getState())).toBe(true);
  });

  it("is clean again once an edit is typed back by hand", () => {
    const store = open();
    store.getState().setTag("other");
    store.getState().setTag("detailed");
    expect(isDirty(store.getState())).toBe(false);
  });

  it("toggles a section's visibility by array position", () => {
    const store = open();
    store.getState().setSectionVisible(1, false);
    expect(store.getState().draft.variant.sections[1].visible).toBe(false);
    expect(store.getState().draft.variant.sections[0].visible).toBe(true);
    expect(store.getState().saved.variant.sections[1].visible).toBe(true);
  });

  it("writes per-section options", () => {
    const store = open();
    store.getState().setHeaderMode(0, "minimal");
    store.getState().setAboutMeId(1, "about-short");

    const [header, aboutMe] = store.getState().draft.variant.sections;
    expect(header).toMatchObject({ type: "header", options: { mode: "minimal" } });
    expect(aboutMe).toMatchObject({ type: "aboutMe", options: { aboutMeId: "about-short" } });
  });

  it("toggles the header title without disturbing the mode", () => {
    const store = open();
    store.getState().setHeaderShowTitle(0, true);

    expect(store.getState().draft.variant.sections[0]).toMatchObject({
      type: "header",
      options: { mode: "full", showTitle: true },
    });
  });

  it("keeps the title switched on across a mode change (§16.6)", () => {
    // setHeaderMode used to write a fresh options object, which would have
    // switched the title off every time the mode was touched.
    const store = open();
    store.getState().setHeaderShowTitle(0, true);
    store.getState().setHeaderMode(0, "minimal");

    expect(store.getState().draft.variant.sections[0]).toMatchObject({
      type: "header",
      options: { mode: "minimal", showTitle: true },
    });
  });

  it("ignores an option written at an index of the wrong type", () => {
    const store = open();
    // An index left over from a reorder must not put header options on the
    // experience section.
    store.getState().setHeaderMode(2, "minimal");
    expect(isDirty(store.getState())).toBe(false);
    expect(store.getState().draft.variant.sections[2]).toEqual(variant.sections[2]);
  });

  it("removes a bullet from the variant's bullet-ID array", () => {
    const store = open();
    store.getState().setBulletIncluded(2, "exp-1", "b1", false);
    expect(store.getState().draft.variant.sections[2]).toMatchObject({
      entries: [{ id: "exp-1", bullets: ["b2"] }],
    });
  });

  it("puts a re-included bullet back where it was, not at the end", () => {
    const store = open();
    store.getState().setBulletIncluded(2, "exp-1", "b1", false);
    store.getState().setBulletIncluded(2, "exp-1", "b1", true);
    expect(store.getState().draft.variant.sections[2]).toMatchObject({
      entries: [{ id: "exp-1", bullets: ["b1", "b2"] }],
    });
    expect(isDirty(store.getState())).toBe(false);
  });

  it("drops a whole entry and restores its saved bullet curation", () => {
    const store = open();
    store.getState().setBulletIncluded(2, "exp-1", "b2", false);
    store.getState().setEntryIncluded(2, "exp-1", false);
    expect(store.getState().draft.variant.sections[2]).toMatchObject({ entries: [] });

    store.getState().setEntryIncluded(2, "exp-1", true);
    // Both bullets: the entry comes back as the *saved* variant had it, not as
    // it was a moment before being excluded.
    expect(store.getState().draft.variant.sections[2]).toMatchObject({
      entries: [{ id: "exp-1", bullets: ["b1", "b2"] }],
    });
  });

  it("includes an entry the variant never referenced, with all its bullets", () => {
    const store = open();
    store.getState().setEntryIncluded(2, "exp-2", true);
    expect(store.getState().draft.variant.sections[2]).toMatchObject({
      entries: [
        { id: "exp-1", bullets: ["b1", "b2"] },
        { id: "exp-2", bullets: ["b1"] },
      ],
    });
  });

  it("leaves a section alone when the entry is not in its library list", () => {
    const store = open();
    store.getState().setEntryIncluded(2, "no-such-entry", true);
    expect(isDirty(store.getState())).toBe(false);
  });

  it("curates Technical Skills at both levels", () => {
    const store = open();
    // A skill inside an included group.
    store.getState().setBulletIncluded(3, "skills-backend", "skill-express", false);
    expect(store.getState().draft.variant.sections[3]).toMatchObject({
      groups: [{ id: "skills-backend", skills: ["skill-nodejs"] }],
    });

    // And the group wholesale.
    store.getState().setEntryIncluded(3, "skills-backend", false);
    expect(store.getState().draft.variant.sections[3]).toMatchObject({ groups: [] });
  });

  it("restores a re-included group's saved skill selection", () => {
    const store = open();
    store.getState().setBulletIncluded(3, "skills-backend", "skill-nodejs", false);
    store.getState().setEntryIncluded(3, "skills-backend", false);
    store.getState().setEntryIncluded(3, "skills-backend", true);
    expect(store.getState().draft.variant.sections[3]).toMatchObject({
      groups: [{ id: "skills-backend", skills: ["skill-nodejs", "skill-express"] }],
    });
    expect(isDirty(store.getState())).toBe(false);
  });

  it("adds a group the variant never had, with all of its skills", () => {
    const store = open();
    store.getState().setEntryIncluded(3, "skills-frontend", true);
    expect(store.getState().draft.variant.sections[3]).toMatchObject({
      groups: [
        { id: "skills-backend", skills: ["skill-nodejs", "skill-express"] },
        { id: "skills-frontend", skills: ["skill-react"] },
      ],
    });
  });

  it("reorders sections by array position", () => {
    const store = open();
    store.getState().moveSection(3, 1);
    expect(store.getState().draft.variant.sections.map((section) => section.type)).toEqual([
      "header",
      "skills",
      "aboutMe",
      "experience",
    ]);
    // Only the draft moves; disk order is untouched until Save.
    expect(store.getState().saved.variant.sections.map((section) => section.type)).toEqual([
      "header",
      "aboutMe",
      "experience",
      "skills",
    ]);
  });

  it("reorders entries within a section", () => {
    const store = open();
    store.getState().setEntryIncluded(2, "exp-2", true);
    store.getState().moveEntry(2, "exp-2", "exp-1");
    expect(store.getState().draft.variant.sections[2]).toMatchObject({
      entries: [{ id: "exp-2" }, { id: "exp-1" }],
    });
  });

  it("reorders bullets within one entry, leaving its twin alone", () => {
    const store = open();
    store.getState().setEntryIncluded(2, "exp-2", true);
    store.getState().moveBullet(2, "exp-1", "b2", "b1");
    expect(store.getState().draft.variant.sections[2]).toMatchObject({
      entries: [
        { id: "exp-1", bullets: ["b2", "b1"] },
        // exp-2 has a bullet with the same ID; the move must not reach it.
        { id: "exp-2", bullets: ["b1"] },
      ],
    });
  });

  it("reorders skill groups and the skills inside one (§12.3)", () => {
    const store = open();
    store.getState().setEntryIncluded(3, "skills-frontend", true);
    store.getState().moveEntry(3, "skills-frontend", "skills-backend");
    store.getState().moveBullet(3, "skills-backend", "skill-express", "skill-nodejs");
    expect(store.getState().draft.variant.sections[3]).toMatchObject({
      groups: [
        { id: "skills-frontend", skills: ["skill-react"] },
        { id: "skills-backend", skills: ["skill-express", "skill-nodejs"] },
      ],
    });
  });

  it("ignores a move aimed at a section that holds no such list", () => {
    const store = open();
    // Header and About Me are option-only; Languages renders whole (§15.6).
    store.getState().moveEntry(0, "a", "b");
    store.getState().moveBullet(1, "e", "a", "b");
    // And an index past the end of the section array.
    store.getState().moveSection(9, 0);
    expect(isDirty(store.getState())).toBe(false);
  });

  it("writes no order field at any level (§15.3)", () => {
    const store = open();
    store.getState().setEntryIncluded(2, "exp-2", true);
    store.getState().moveSection(3, 1);
    store.getState().moveEntry(3, "exp-2", "exp-1");
    store.getState().moveBullet(3, "exp-1", "b2", "b1");
    // Array position is the sole source of truth; a rank field alongside it is
    // exactly the desync §15.3 removed.
    expect(JSON.stringify(store.getState().draft.variant)).not.toContain('"order"');
  });

  it("writes a new bullet to the library, then references it (§6.3)", () => {
    const store = open();
    store.getState().addBullet(2, "exp-1", { text: "  Shipped the thing  " });

    const entry = store.getState().draft.library.experience[0];
    const added = entry.bullets.at(-1)!;
    expect(added.text).toBe("Shipped the thing");
    expect(added.id).toMatch(/^bullet-[a-z0-9]{6}$/);
    expect(added.tags).toEqual([]);
    // The variant carries the reference and no text of its own (§6.2).
    expect(store.getState().draft.variant.sections[2]).toMatchObject({
      entries: [{ id: "exp-1", bullets: ["b1", "b2", added.id] }],
    });
    expect(store.getState().saved.library.experience[0].bullets).toHaveLength(2);
  });

  it("writes a new entry to the library, then references it", () => {
    const store = open();
    store.getState().addEntry(2, { title: "Engineer", company: "Globex", dates: "2026" });

    const entry = store.getState().draft.library.experience.at(-1)!;
    expect(entry).toMatchObject({ title: "Engineer", company: "Globex", dates: "2026", bullets: [] });
    expect(store.getState().draft.variant.sections[2]).toMatchObject({
      entries: [{ id: "exp-1" }, { id: entry.id, bullets: [] }],
    });
  });

  it("adds skill groups and skills through the same two levels (§12.3)", () => {
    const store = open();
    store.getState().addEntry(3, { label: "Cloud" });
    const group = store.getState().draft.library.skillGroups.at(-1)!;
    expect(group).toMatchObject({ label: "Cloud", skills: [] });
    expect(store.getState().draft.variant.sections[3]).toMatchObject({
      groups: [{ id: "skills-backend" }, { id: group.id, skills: [] }],
    });

    store.getState().addBullet(3, group.id, { text: "AWS" });
    const skill = store.getState().draft.library.skillGroups.at(-1)!.skills[0];
    expect(skill.text).toBe("AWS");
    expect(store.getState().draft.variant.sections[3]).toMatchObject({
      groups: [{ id: "skills-backend" }, { id: group.id, skills: [skill.id] }],
    });
  });

  it("points the About Me section at the version just written for it", () => {
    const store = open();
    store.getState().addEntry(1, { key: "tailored", text: "A new paragraph." });
    const about = store.getState().draft.library.aboutMe.at(-1)!;
    expect(about).toMatchObject({ key: "tailored", text: "A new paragraph." });
    expect(store.getState().draft.variant.sections[1]).toMatchObject({
      options: { aboutMeId: about.id },
    });
  });

  it("generates IDs that collide with nothing already in the library", () => {
    const store = open();
    const before = libraryIds(store.getState().draft.library);
    for (let i = 0; i < 25; i += 1) store.getState().addBullet(2, "exp-1", { text: `b${i}` });

    const bullets = store.getState().draft.library.experience[0].bullets;
    expect(bullets).toHaveLength(27);
    const fresh = bullets.slice(2).map((bullet) => bullet.id);
    // Distinct from each other and from everything that was already there —
    // a repeat would silently repoint an existing item.
    expect(new Set(fresh).size).toBe(25);
    for (const id of fresh) expect(before.has(id)).toBe(false);
  });

  it("ignores an add aimed at a section that cannot hold one", () => {
    const store = open();
    // The header is a single record, not a list (§5.1).
    store.getState().addEntry(0, { title: "x" });
    // And an owner the library does not have.
    store.getState().addBullet(2, "no-such-entry", { text: "x" });
    expect(isDirty(store.getState())).toBe(false);
  });

  it("adopts what a save wrote as the new clean baseline", () => {
    const store = open();
    store.getState().setLabel("Tailored");
    const draft = store.getState().draft;

    // What the server echoes back: the same document, plus its own timestamp,
    // rebuilt by Zod — so its keys need not be in the client's order.
    store.getState().markSaved({
      variant: { ...draft.variant, updatedAt: "2026-09-01T00:00:00.000Z" },
      library: draft.library,
    });

    expect(isDirty(store.getState())).toBe(false);
    expect(store.getState().draft.variant.label).toBe("Tailored");
    expect(store.getState().draft.variant.updatedAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("keeps edits typed while a save was in flight", () => {
    const store = open();
    store.getState().setLabel("Tailored");
    const inFlight = store.getState().draft;
    // The user keeps typing before the response lands.
    store.getState().setTag("later");
    store.getState().markSaved({ ...inFlight, variant: { ...inFlight.variant } });

    expect(store.getState().draft.variant.tag).toBe("later");
    expect(isDirty(store.getState())).toBe(true);
  });

  it("does not call a key-order difference an unsaved change", () => {
    const store = open();
    const { variant, library } = store.getState().draft;
    // Same content, opposite key order — Save would write the same bytes.
    store.getState().markSaved({ variant, library });
    expect(isDirty(store.getState())).toBe(false);
  });

  it("reverts the whole document, library included", () => {
    const store = open();
    store.getState().setLabel("Tailored");
    store.getState().setBulletText("experience", "exp-1", "b2", "changed");
    store.getState().revert();
    expect(isDirty(store.getState())).toBe(false);
    expect(store.getState().draft).toEqual(store.getState().saved);
  });
});

describe("header content", () => {
  it("edits the header's own fields on the library draft", () => {
    const store = open();
    store.getState().setHeaderField("email", "a@example.com");
    store.getState().setHeaderField("title", "Backend Engineer");

    expect(store.getState().draft.library.header).toMatchObject({
      email: "a@example.com",
      title: "Backend Engineer",
      // Untouched fields are left exactly as they were.
      name: "A",
    });
    expect(isDirty(store.getState())).toBe(true);
    // The header is one record shared by every variant (§5.1) — the variant
    // itself must not have grown a copy of the text.
    expect(store.getState().draft.variant).toEqual(store.getState().saved.variant);
  });

  it("adds, edits and removes extra contact links", () => {
    const store = open();
    store.getState().addHeaderLink({ text: "  portfolio.example.com  " });
    store.getState().addHeaderLink({ text: "dev.to/jordan-rivera-demo" });

    const links = store.getState().draft.library.header.links;
    expect(links.map((link) => link.text)).toEqual([
      "portfolio.example.com",
      "dev.to/jordan-rivera-demo",
    ]);
    // Distinct IDs, so a form can address one row (§16.6).
    expect(new Set(links.map((link) => link.id)).size).toBe(2);

    store.getState().setHeaderLinkText(links[0].id, "portfolio.dev");
    store.getState().removeHeaderLink(links[1].id);
    expect(store.getState().draft.library.header.links).toEqual([
      { id: links[0].id, text: "portfolio.dev" },
    ]);
  });

  it("refuses to store a blank link", () => {
    const store = open();
    store.getState().addHeaderLink({ text: "   " });
    expect(store.getState().draft.library.header.links).toEqual([]);
    expect(isDirty(store.getState())).toBe(false);
  });
});

describe("custom sections", () => {
  it("adds the library item and the section that points at it", () => {
    const store = open();
    store.getState().addCustomSection({ title: "Open Source", paragraph: "Maintainer." });

    const { library: draftLibrary, variant: draftVariant } = store.getState().draft;
    expect(draftLibrary.customSections).toHaveLength(1);
    const item = draftLibrary.customSections[0];
    expect(item).toMatchObject({ title: "Open Source", paragraph: "Maintainer.", bullets: [] });

    // Appended, and pointing at the item just written for it (§12.4).
    const last = draftVariant.sections.at(-1);
    expect(last).toEqual({
      type: "custom",
      visible: true,
      options: { customSectionId: item.id },
    });
  });

  it("gives a second custom section its own item rather than repointing the first", () => {
    const store = open();
    store.getState().addCustomSection({ title: "Open Source" });
    store.getState().addCustomSection({ title: "Publications" });

    const { library: draftLibrary, variant: draftVariant } = store.getState().draft;
    const ids = draftLibrary.customSections.map((item) => item.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(
      draftVariant.sections
        .filter((section) => section.type === "custom")
        .map((section) => section.options.customSectionId),
    ).toEqual(ids);
  });

  it("edits a custom section's title and paragraph, blanking to null", () => {
    const store = open();
    store.getState().addCustomSection({ title: "Open Source", paragraph: "Maintainer." });
    const id = store.getState().draft.library.customSections[0].id;

    store.getState().setCustomSectionTitle(id, "Community");
    store.getState().setCustomSectionParagraph(id, "   ");
    expect(store.getState().draft.library.customSections[0]).toMatchObject({
      title: "Community",
      // An empty string would print an empty paragraph; absence is null.
      paragraph: null,
    });
  });

  it("removes a section from the variant but leaves its library item alone", () => {
    const store = open();
    store.getState().addCustomSection({ title: "Open Source" });
    const before = store.getState().draft.variant.sections.length;

    store.getState().removeSection(before - 1);
    expect(store.getState().draft.variant.sections).toHaveLength(before - 1);
    // Reusable by other variants (§12.4) — orphan cleanup is the manager's job.
    expect(store.getState().draft.library.customSections).toHaveLength(1);
  });

  it("ignores a remove aimed at no section", () => {
    const store = open();
    store.getState().removeSection(99);
    expect(isDirty(store.getState())).toBe(false);
  });
});
