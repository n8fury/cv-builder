import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contentLibrarySchema } from "../schema/library";
import type { Variant } from "../schema/variant";
import {
  ConflictError,
  InvalidDataError,
  NotFoundError,
  createProfile,
  createVariant,
  deleteProfile,
  deleteVariant,
  isValidSlug,
  renameProfile,
  renameVariant,
  listProfiles,
  listVariants,
  readLibrary,
  readVariant,
  libraryPath,
  variantPath,
  writeLibrary,
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

describe("rename and delete", () => {
  it("moves the variant file and leaves its contents untouched", async () => {
    await writeVariant("temp-profile", "scratch", variant);

    await renameVariant("temp-profile", "scratch", "renamed");

    expect(await listVariants("temp-profile")).toEqual(["renamed"]);
    expect(await readVariant("temp-profile", "renamed")).toEqual(variant);
    await expect(readVariant("temp-profile", "scratch")).rejects.toBeInstanceOf(NotFoundError);
  });

  // `rename` overwrites silently on both POSIX and NTFS; renaming onto a
  // sibling would destroy real curation work without a word.
  it("refuses to rename a variant onto an existing one", async () => {
    await writeVariant("temp-profile", "scratch", variant);
    await writeVariant("temp-profile", "taken", { ...variant, tag: "taken" });

    await expect(renameVariant("temp-profile", "scratch", "taken")).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect((await readVariant("temp-profile", "taken")).tag).toBe("taken");
  });

  it("rejects a rename of a variant that is not there", async () => {
    await expect(renameVariant("temp-profile", "ghost", "renamed")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("renames a profile, carrying its library and variants", async () => {
    await writeVariant("temp-profile", "scratch", variant);

    await renameProfile("temp-profile", "moved-profile");

    expect(await listProfiles()).toEqual(["moved-profile"]);
    expect(await listVariants("moved-profile")).toEqual(["scratch"]);
    expect((await readLibrary("moved-profile")).schemaVersion).toBe(1);
  });

  it("refuses to rename a profile onto an existing one", async () => {
    await writeVariant("temp-profile", "scratch", variant);
    await writeVariant("other-profile", "scratch", variant);

    await expect(renameProfile("temp-profile", "other-profile")).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(await listVariants("temp-profile")).toEqual(["scratch"]);
  });

  it("deletes a profile with everything in it", async () => {
    await writeVariant("temp-profile", "scratch", variant);

    await deleteProfile("temp-profile");

    expect(await listProfiles()).toEqual([]);
    await expect(readLibrary("temp-profile")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects deleting a profile that is not there", async () => {
    await expect(deleteProfile("ghost-profile")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("accepts slugs and rejects anything that could escape the store", () => {
    expect(isValidSlug("google-swe_2026-08-22")).toBe(true);
    expect(isValidSlug("../escape")).toBe(false);
    expect(isValidSlug("with space")).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });
});

describe("createProfile", () => {
  it("scaffolds an empty library and a variants directory", async () => {
    await createProfile("new-profile", "Ada Lovelace");

    const library = await readLibrary("new-profile");
    expect(library.schemaVersion).toBe(1);
    expect(library.header.name).toBe("Ada Lovelace");
    // Empty in every other respect — content arrives through the editor.
    expect(library.experience).toEqual([]);
    expect(library.competencies).toEqual([]);

    expect(await listProfiles()).toContain("new-profile");
    expect(await listVariants("new-profile")).toEqual([]);
    await expect(readFile(join(root, "new-profile", "variants"))).rejects.toThrow();
  });

  it("writes a variant into the scaffolded profile without further setup", async () => {
    await createProfile("new-profile", "Ada Lovelace");
    await writeVariant("new-profile", "scratch", variant);

    expect(await listVariants("new-profile")).toEqual(["scratch"]);
  });

  // An exclusive create, so a double submission cannot flatten a real library.
  it("refuses to overwrite an existing profile", async () => {
    await expect(createProfile("temp-profile", "Someone Else")).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect((await readLibrary("temp-profile")).header.name).toBe("");
  });

  it("rejects an id that is not a slug", async () => {
    await expect(createProfile("../escape", "Escape")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("createVariant", () => {
  it("writes a new variant that can be read back", async () => {
    await createVariant("temp-profile", "fork", variant);
    expect(await readVariant("temp-profile", "fork")).toEqual(variant);
  });

  it("refuses to overwrite an existing variant", async () => {
    await createVariant("temp-profile", "fork", variant);
    // A fork whose auto-generated name collides must not destroy what it
    // collided with (§12.5).
    await expect(createVariant("temp-profile", "fork", { ...variant, tag: "other" })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect((await readVariant("temp-profile", "fork")).tag).toBe("scratch");
  });

  it("creates exclusively rather than checking first", async () => {
    await createVariant("temp-profile", "fork", variant);
    const call = vi.mocked(fsp.writeFile).mock.calls.at(-1);
    expect(call?.[2]).toMatchObject({ flag: "wx" });
  });

  it("validates before writing", async () => {
    await expect(
      createVariant("temp-profile", "bad", { ...variant, schemaVersion: 2 } as unknown as Variant),
    ).rejects.toBeInstanceOf(InvalidDataError);
  });
});

describe("writeLibrary", () => {
  const library = contentLibrarySchema.parse({
    schemaVersion: 1,
    header: { name: "A Person" },
    competencies: [{ id: "comp-1", text: "Something" }],
  });

  it("round-trips through disk", async () => {
    await writeLibrary("temp-profile", library);
    expect(await readLibrary("temp-profile")).toEqual(library);
  });

  it("replaces atomically — every variant reads through this file", async () => {
    await writeLibrary("temp-profile", library);
    const renamed = vi.mocked(fsp.rename).mock.calls.at(-1);
    expect(renamed?.[0]).toMatch(/\.tmp$/);
    expect(renamed?.[1]).toBe(libraryPath("temp-profile"));
  });

  it("validates before writing, leaving the old library in place", async () => {
    await writeLibrary("temp-profile", library);
    await expect(
      writeLibrary("temp-profile", { schemaVersion: 9 } as unknown as typeof library),
    ).rejects.toBeInstanceOf(InvalidDataError);
    expect(await readLibrary("temp-profile")).toEqual(library);
  });
});
