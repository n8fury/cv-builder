/**
 * The drafting endpoint's contract (SPEC §10, §13).
 *
 * The endpoint exists so an LLM can write a variant, which means it is the
 * one place in the app where untrusted, generated JSON reaches the profile
 * store. Everything here is about what it refuses: invented IDs, an ID in the
 * wrong slot, a key the schema does not know, an id that would escape the
 * profiles directory, and a second write over an existing variant.
 *
 * It runs against a real temp profile rather than a mocked store — the write
 * landing on disk in a readable, schema-valid shape is half the contract, and
 * a mock would assert that it was *asked* to write, not that the file parses.
 */
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readVariant } from "@/lib/data/store";
import { LIBRARY_SCHEMA_VERSION } from "@/lib/schema/library";

import { POST } from "./route";

let root: string;
const PROFILE = "tester";

/** A library just big enough to reference from every level a variant has. */
const library = {
  schemaVersion: LIBRARY_SCHEMA_VERSION,
  header: { name: "Test Person" },
  aboutMe: [{ id: "about-default", key: "default", text: "A paragraph." }],
  competencies: [{ id: "comp-apis", text: "APIs" }],
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
  skillGroups: [{ id: "skills-lang", label: "Languages", skills: [{ id: "skill-ts", text: "TypeScript" }] }],
};

/** A well-formed draft: every id above, in the slot it belongs in. */
function draft(overrides: Record<string, unknown> = {}) {
  return {
    profileId: PROFILE,
    variantId: "acme-backend",
    tag: "acme-backend",
    label: "Acme — backend",
    sections: [
      { type: "header", visible: true, options: { mode: "full" } },
      { type: "aboutMe", visible: true, options: { aboutMeId: "about-default" } },
      { type: "competencies", visible: true, options: {}, items: ["comp-apis"] },
      {
        type: "experience",
        visible: true,
        options: {},
        entries: [{ id: "exp-acme", bullets: ["bullet-one"] }],
      },
      {
        type: "skills",
        visible: true,
        options: {},
        groups: [{ id: "skills-lang", skills: ["skill-ts"] }],
      },
    ],
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/variants", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "cv-api-"));
  process.env.CV_PROFILES_DIR = root;
  await mkdir(join(root, PROFILE, "variants"), { recursive: true });
  await writeFile(join(root, PROFILE, "content-library.json"), JSON.stringify(library), "utf8");
});

afterEach(async () => {
  delete process.env.CV_PROFILES_DIR;
  delete process.env.CV_API_TOKEN;
  await rm(root, { recursive: true, force: true });
});

describe("POST /api/variants", () => {
  it("creates a variant file from a schema-valid body and returns its id", async () => {
    const response = await post(draft());
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body).toMatchObject({
      profileId: PROFILE,
      variantId: "acme-backend",
      editPath: "/edit/tester/acme-backend",
    });

    // The file itself, read back through the schema: what the editor will open.
    const written = await readVariant(PROFILE, "acme-backend");
    expect(written.tag).toBe("acme-backend");
    expect(written.sections).toHaveLength(5);
    // Set by the endpoint, never accepted from the caller.
    expect(written.schemaVersion).toBe(1);
    expect(written.createdAt).toEqual(written.updatedAt);
  });

  it("names every dangling library id and writes nothing", async () => {
    const response = await post(
      draft({
        sections: [
          { type: "aboutMe", visible: true, options: { aboutMeId: "about-invented" } },
          { type: "competencies", visible: true, options: {}, items: ["comp-apis", "comp-madeup"] },
        ],
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.unknownIds).toEqual(["about-invented", "comp-madeup"]);
    expect(body.error).toContain("about-invented");
    expect(body.error).toContain("comp-madeup");

    await expect(readVariant(PROFILE, "acme-backend")).rejects.toThrow();
  });

  it("rejects a real id used in the wrong slot", async () => {
    const response = await post(
      draft({ sections: [{ type: "aboutMe", visible: true, options: { aboutMeId: "exp-acme" } }] }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).unknownIds).toEqual(["exp-acme"]);
  });

  it("rejects a key the variant schema does not define", async () => {
    const response = await post(
      draft({
        sections: [
          { type: "header", visible: true, options: { mode: "full" }, headline: "Invented!" },
        ],
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("Invalid") });
  });

  it("rejects an id that would escape the profiles directory", async () => {
    const response = await post(draft({ variantId: "../escape" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("variantId");
  });

  it("404s for a profile that does not exist", async () => {
    expect((await post(draft({ profileId: "nobody" }))).status).toBe(404);
  });

  it("400s on a body that is not JSON", async () => {
    expect((await post("{not json")).status).toBe(400);
  });

  it("409s rather than overwriting a variant that already exists", async () => {
    expect((await post(draft())).status).toBe(201);
    expect((await post(draft({ label: "Second try" }))).status).toBe(409);
    expect((await readVariant(PROFILE, "acme-backend")).label).toBe("Acme — backend");
  });

  it("overwrites only when the caller asks", async () => {
    await post(draft());
    expect((await post(draft({ label: "Second try", overwrite: true }))).status).toBe(201);
    expect((await readVariant(PROFILE, "acme-backend")).label).toBe("Second try");
  });

  it("requires the token once CV_API_TOKEN is set", async () => {
    process.env.CV_API_TOKEN = "s3cret";

    expect((await post(draft())).status).toBe(401);
    expect((await post(draft(), { authorization: "Bearer wrong" })).status).toBe(401);
    expect((await post(draft(), { authorization: "Bearer s3cret" })).status).toBe(201);
  });
});
