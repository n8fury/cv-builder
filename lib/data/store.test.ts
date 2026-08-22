import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contentLibrarySchema } from "../schema/library";
import type { Variant } from "../schema/variant";
import {
  InvalidDataError,
  NotFoundError,
  deleteVariant,
  listProfiles,
  listVariants,
  readLibrary,
  readVariant,
  variantPath,
  writeVariant,
} from "./store";

// Real fs calls still run; the spies only record how the write was performed.
vi.mock("node:fs/promises", { spy: true });

const variant: Variant = {
  schemaVersion: 1,
  tag: "scratch",
  label: "Scratch — round trip",
  createdAt: "2026-08-22T11:00:00Z",
  updatedAt: "2026-08-22T11:00:00Z",
  sections: [
    { type: "header", visible: true, options: { mode: "minimal" } },
    { type: "aboutMe", visible: true, options: { aboutMeId: "about-default" } },
    { type: "competencies", visible: true, options: {}, items: ["comp-fullstack"] },
  ],
};

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "cv-store-"));
  process.env.CV_PROFILES_DIR = root;
  await mkdir(join(root, "temp-profile"), { recursive: true });
  await writeFile(
    join(root, "temp-profile", "content-library.json"),
    JSON.stringify(contentLibrarySchema.parse({ schemaVersion: 1 }), null, 2),
    "utf8",
  );
  vi.clearAllMocks();
});

afterEach(async () => {
  delete process.env.CV_PROFILES_DIR;
  await rm(root, { recursive: true, force: true });
});

describe("round trip", () => {
  it("writes a variant and reads back exactly what was written", async () => {
    await writeVariant("temp-profile", "scratch", variant);
    expect(await readVariant("temp-profile", "scratch")).toEqual(variant);
  });

  it("lists the profile and its variants", async () => {
    await writeVariant("temp-profile", "scratch", variant);
    await writeVariant("temp-profile", "another", { ...variant, tag: "another" });

    expect(await listProfiles()).toEqual(["temp-profile"]);
    expect(await listVariants("temp-profile")).toEqual(["another", "scratch"]);
  });

  it("reads a library and reports an empty profile as schemaVersion 1", async () => {
    expect((await readLibrary("temp-profile")).schemaVersion).toBe(1);
  });

  it("deletes a variant", async () => {
    await writeVariant("temp-profile", "scratch", variant);
    await deleteVariant("temp-profile", "scratch");

    expect(await listVariants("temp-profile")).toEqual([]);
    await expect(readVariant("temp-profile", "scratch")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("atomic writes", () => {
  it("writes to a temp file and renames it onto the target", async () => {
    const target = variantPath("temp-profile", "scratch");

    await writeVariant("temp-profile", "scratch", variant);

    expect(fsp.writeFile).toHaveBeenCalledTimes(1);
    const writtenPath = vi.mocked(fsp.writeFile).mock.calls[0]![0] as string;
    expect(writtenPath).not.toBe(target);
    expect(writtenPath.startsWith(`${target}.`)).toBe(true);
    expect(writtenPath.endsWith(".tmp")).toBe(true);

    expect(fsp.rename).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fsp.rename).mock.calls[0]).toEqual([writtenPath, target]);

    // The temp file is gone and only the target survives.
    expect(await listVariants("temp-profile")).toEqual(["scratch"]);
    expect(JSON.parse(await readFile(target, "utf8"))).toEqual(variant);
  });

  it("removes the temp file and leaves the target untouched when the rename fails", async () => {
    const target = variantPath("temp-profile", "scratch");
    await writeVariant("temp-profile", "scratch", variant);
    const before = await readFile(target, "utf8");

    vi.mocked(fsp.rename).mockRejectedValueOnce(new Error("rename failed"));
    await expect(
      writeVariant("temp-profile", "scratch", { ...variant, tag: "clobbered" }),
    ).rejects.toThrow("rename failed");

    expect(await readFile(target, "utf8")).toBe(before);
    expect(await listVariants("temp-profile")).toEqual(["scratch"]);
  });
});

describe("guards", () => {
  it("rejects an invalid variant before touching the disk", async () => {
    const invalid = { ...variant, schemaVersion: 2 } as unknown as Variant;
    await expect(writeVariant("temp-profile", "scratch", invalid)).rejects.toBeInstanceOf(
      InvalidDataError,
    );
    expect(fsp.writeFile).not.toHaveBeenCalled();
  });

  it("rejects ids that would escape the profiles directory", async () => {
    await expect(readVariant("temp-profile", "../../etc/passwd")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(readLibrary("..")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reports malformed JSON as invalid data, not as missing", async () => {
    await mkdir(join(root, "temp-profile", "variants"), { recursive: true });
    await writeFile(variantPath("temp-profile", "broken"), "{ not json", "utf8");
    await expect(readVariant("temp-profile", "broken")).rejects.toBeInstanceOf(InvalidDataError);
  });

  it("returns empty lists rather than throwing for a store with nothing in it", async () => {
    await expect(listVariants("temp-profile")).resolves.toEqual([]);
    await expect(readLibrary("missing-profile")).rejects.toBeInstanceOf(NotFoundError);
  });
});
