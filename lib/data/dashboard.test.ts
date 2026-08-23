import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listDashboard } from "./dashboard";

let root: string;

function variantJson(tag: string, updatedAt: string) {
  return JSON.stringify({
    schemaVersion: 1,
    tag,
    label: `${tag} — label`,
    createdAt: "2026-08-01T09:00:00Z",
    updatedAt,
    sections: [],
  });
}

async function profile(id: string, name: string) {
  await mkdir(join(root, id, "variants"), { recursive: true });
  await writeFile(
    join(root, id, "content-library.json"),
    JSON.stringify({ schemaVersion: 1, header: { name } }),
    "utf8",
  );
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "cv-dashboard-"));
  process.env.CV_PROFILES_DIR = root;
});

afterEach(async () => {
  delete process.env.CV_PROFILES_DIR;
  await rm(root, { recursive: true, force: true });
});

describe("listDashboard", () => {
  it("is empty when the store has no profiles", async () => {
    expect(await listDashboard()).toEqual([]);
  });

  it("lists each profile's variants with label, tag and updatedAt", async () => {
    await profile("jordan-rivera", "Jordan A Rivera");
    await writeFile(
      join(root, "jordan-rivera", "variants", "detailed.json"),
      variantJson("detailed", "2026-08-22T11:00:00Z"),
      "utf8",
    );

    const [entry] = await listDashboard();

    expect(entry.id).toBe("jordan-rivera");
    expect(entry.name).toBe("Jordan A Rivera");
    expect(entry.error).toBeUndefined();
    expect(entry.variants).toEqual([
      {
        id: "detailed",
        tag: "detailed",
        label: "detailed — label",
        createdAt: "2026-08-01T09:00:00Z",
        updatedAt: "2026-08-22T11:00:00Z",
      },
    ]);
  });

  it("orders variants most recently updated first", async () => {
    await profile("p", "P");
    await writeFile(
      join(root, "p", "variants", "old.json"),
      variantJson("old", "2026-01-02T00:00:00Z"),
      "utf8",
    );
    await writeFile(
      join(root, "p", "variants", "new.json"),
      variantJson("new", "2026-07-02T00:00:00Z"),
      "utf8",
    );

    const [entry] = await listDashboard();
    expect(entry.variants.map((variant) => variant.id)).toEqual(["new", "old"]);
  });

  // A hand-edited or n8n-written file must not blank the whole dashboard (§13).
  it("reports an unreadable variant without dropping its siblings", async () => {
    await profile("p", "P");
    await writeFile(
      join(root, "p", "variants", "good.json"),
      variantJson("good", "2026-03-01T00:00:00Z"),
      "utf8",
    );
    await writeFile(join(root, "p", "variants", "bad.json"), "{ not json", "utf8");

    const [entry] = await listDashboard();

    expect(entry.variants.map((variant) => variant.id)).toEqual(["good"]);
    expect(entry.broken).toHaveLength(1);
    expect(entry.broken[0].id).toBe("bad");
    expect(entry.broken[0].reason).toMatch(/not valid JSON/);
  });

  it("carries a library read failure on the profile row", async () => {
    await mkdir(join(root, "p", "variants"), { recursive: true });

    const [entry] = await listDashboard();

    expect(entry.error).toMatch(/No content library/);
    expect(entry.variants).toEqual([]);
  });
});
