/**
 * The library-read endpoint (SPEC §10, step 2).
 *
 * The drafting workflow fetches the library over HTTP, so what matters here
 * is that both shapes come back whole: the raw library the workflow may want
 * to inspect, and the catalogue-plus-prompt the LLM node is given. The
 * catalogue's own correctness is `lib/n8n/prompt.test.ts`; this covers the
 * wiring and the two error paths.
 */
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DRAFT_SYSTEM_PROMPT } from "@/lib/n8n/prompt";

import { GET } from "./route";

let root: string;

const library = {
  schemaVersion: 1,
  header: { name: "Test Person" },
  competencies: [{ id: "comp-apis", text: "APIs" }],
};

const get = (query: string) => GET(new Request(`http://localhost/api/library?${query}`));

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "cv-lib-api-"));
  process.env.CV_PROFILES_DIR = root;
  await mkdir(join(root, "tester"), { recursive: true });
  await writeFile(join(root, "tester", "content-library.json"), JSON.stringify(library), "utf8");
});

afterEach(async () => {
  delete process.env.CV_PROFILES_DIR;
  await rm(root, { recursive: true, force: true });
});

describe("GET /api/library", () => {
  it("returns the parsed library", async () => {
    const response = await get("profileId=tester");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.library.competencies).toEqual([{ id: "comp-apis", text: "APIs", tags: [] }]);
  });

  it("returns the prompt and the id catalogue in catalogue format", async () => {
    const body = await (await get("profileId=tester&format=catalogue")).json();
    expect(body.systemPrompt).toBe(DRAFT_SYSTEM_PROMPT);
    expect(body.catalogue).toContain("comp-apis — APIs");
    // The raw library is not sent in this shape — the model gets IDs and text.
    expect(body.library).toBeUndefined();
  });

  it("400s without a profileId and 404s for an unknown one", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get("profileId=nobody")).status).toBe(404);
  });
});
