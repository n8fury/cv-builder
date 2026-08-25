/**
 * The drafting prompt's guarantees (SPEC §10).
 *
 * Two things are worth testing about a prompt. First, that the prohibition
 * §10 requires is actually in it — a prompt is easy to reword into vagueness
 * during a tidy-up, and the failure mode is a CV that invents a job. Second,
 * that the catalogue it promises the model matches the library it was built
 * from: a model can only select from what it was shown, so an id missing from
 * the digest is content the drafter can never choose, and an id in the digest
 * that is not in the library is an invitation to reference something that
 * `POST /api/variants` will then reject.
 */
import { describe, expect, it } from "vitest";

import { libraryIds } from "../data/ids";
import { contentLibrarySchema } from "../schema/library";
import { SECTION_TYPES } from "../schema/variant";
import { DRAFT_SYSTEM_PROMPT, draftUserMessage, libraryDigest } from "./prompt";

const library = contentLibrarySchema.parse({
  schemaVersion: 1,
  header: { name: "Test Person" },
  aboutMe: [{ id: "about-default", key: "default", text: "A paragraph." }],
  competencies: [{ id: "comp-apis", text: "APIs", tags: ["backend"] }],
  experience: [
    {
      id: "exp-acme",
      title: "Engineer",
      company: "Acme",
      location: "Remote",
      dates: "2024 — Present",
      bullets: [{ id: "bullet-one", text: "Shipped a thing." }],
    },
  ],
  skillGroups: [
    { id: "skills-lang", label: "Languages", skills: [{ id: "skill-ts", text: "TypeScript" }] },
  ],
  languages: [{ id: "lang-en", language: "English", proficiency: "Native" }],
});

describe("DRAFT_SYSTEM_PROMPT", () => {
  it("forbids inventing experience, metrics and skills", () => {
    const prompt = DRAFT_SYSTEM_PROMPT.toLowerCase();
    expect(prompt).toContain("must not");
    for (const forbidden of ["experience", "metrics", "skills", "invent"]) {
      expect(prompt).toContain(forbidden);
    }
    // The rule that makes the rest enforceable rather than advisory.
    expect(prompt).toMatch(/does not appear verbatim in the library catalogue/);
  });

  it("allows only selection, ordering and section options", () => {
    expect(DRAFT_SYSTEM_PROMPT).toMatch(/You may ONLY:/);
    expect(DRAFT_SYSTEM_PROMPT).toMatch(/only IDs/);
    expect(DRAFT_SYSTEM_PROMPT).toMatch(/not emitting text, only IDs/);
  });

  it("describes every section type the schema defines", () => {
    // A type the prompt omits is a section the drafter silently never uses.
    for (const type of SECTION_TYPES) {
      expect(DRAFT_SYSTEM_PROMPT).toContain(`"type": "${type}"`);
    }
  });
});

describe("libraryDigest", () => {
  it("offers exactly the ids the library holds", () => {
    const digest = libraryDigest(library);
    const offered = new Set(
      digest
        .split("\n")
        .map((line) => /^\s*(\S+) — /.exec(line)?.[1])
        .filter((id) => id !== undefined),
    );

    expect(offered).toEqual(libraryIds(library));
  });

  it("carries each item's text and tags so the model can judge relevance", () => {
    const digest = libraryDigest(library);
    expect(digest).toContain("comp-apis — APIs  [tags: backend]");
    expect(digest).toContain("bullet-one — Shipped a thing.");
    // Nested under its entry rather than loose, which is the only context that
    // makes a bullet meaningful.
    expect(digest).toMatch(/exp-acme — .*\n {2}bullet-one/);
  });

  it("omits collections the library has nothing in", () => {
    expect(libraryDigest(library)).not.toContain("Projects");
  });
});

describe("draftUserMessage", () => {
  it("puts the catalogue, the role and the posting in one message", () => {
    const message = draftUserMessage(library, "Backend Engineer", "You will build APIs.");
    expect(message).toContain(libraryDigest(library));
    expect(message).toContain("Backend Engineer");
    expect(message).toContain("You will build APIs.");
    expect(message.indexOf("catalogue")).toBeLessThan(message.indexOf("Job description"));
  });
});
