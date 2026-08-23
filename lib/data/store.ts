/**
 * Filesystem data layer (SPEC §9).
 *
 *   data/profiles/<profileId>/content-library.json
 *   data/profiles/<profileId>/variants/<variantId>.json
 *
 * Every read is validated against the schemas in lib/schema, so nothing
 * downstream has to defend against malformed JSON. Variant writes go through
 * a temp file plus rename, so a crash mid-write can never leave a half-written
 * variant behind — the variant file is the only thing the editor overwrites in
 * place, and losing one to a partial write would lose real curation work.
 */
import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  LIBRARY_SCHEMA_VERSION,
  contentLibrarySchema,
  type ContentLibrary,
} from "../schema/library";
import { variantSchema, type Variant } from "../schema/variant";

/** A profile, library, or variant that does not exist on disk. §13 maps this to a 404. */
export class NotFoundError extends Error {
  override readonly name = "NotFoundError";
}

/** A file that exists but does not match its schema. */
export class InvalidDataError extends Error {
  override readonly name = "InvalidDataError";
}

/** A rename whose target name is already taken. §13 maps this to a 409. */
export class ConflictError extends Error {
  override readonly name = "ConflictError";
}

const SLUG = /^[a-z0-9][a-z0-9_-]*$/i;

/**
 * The shape every profile and variant id must have. Exported so the UI can
 * reject a bad name with a sentence rather than let it surface as a 404 from
 * `assertSlug` two layers down.
 */
export function isValidSlug(value: string): boolean {
  return SLUG.test(value);
}

/**
 * Profile and variant ids come from URLs and form input; keeping them to a
 * flat slug means they can never escape the profiles directory.
 */
function assertSlug(kind: string, value: string): string {
  if (!SLUG.test(value)) {
    throw new NotFoundError(`Invalid ${kind} id: ${JSON.stringify(value)}`);
  }
  return value;
}

/** Root of the profile store. Overridable so tests can point at a temp dir. */
export function profilesRoot(): string {
  return process.env.CV_PROFILES_DIR ?? join(process.cwd(), "data", "profiles");
}

export function profileDir(profileId: string): string {
  return join(profilesRoot(), assertSlug("profile", profileId));
}

export function libraryPath(profileId: string): string {
  return join(profileDir(profileId), "content-library.json");
}

export function variantsDir(profileId: string): string {
  return join(profileDir(profileId), "variants");
}

export function variantPath(profileId: string, variantId: string): string {
  return join(variantsDir(profileId), `${assertSlug("variant", variantId)}.json`);
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}

async function readJsonFile(path: string, label: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (isMissing(error)) throw new NotFoundError(`No ${label} at ${path}`);
    throw error;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new InvalidDataError(`${label} at ${path} is not valid JSON: ${String(error)}`);
  }
}

/** Profile ids, sorted. Empty when the store has not been created yet. */
export async function listProfiles(): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(profilesRoot(), { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isDirectory() && SLUG.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export async function readLibrary(profileId: string): Promise<ContentLibrary> {
  const path = libraryPath(profileId);
  const parsed = contentLibrarySchema.safeParse(await readJsonFile(path, "content library"));
  if (!parsed.success) {
    throw new InvalidDataError(`Invalid content library at ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Variant ids for a profile, sorted. Empty when the profile has no variants yet. */
export async function listVariants(profileId: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(variantsDir(profileId), { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.slice(0, -".json".length))
    .filter((id) => SLUG.test(id))
    .sort();
}

export async function readVariant(profileId: string, variantId: string): Promise<Variant> {
  const path = variantPath(profileId, variantId);
  const parsed = variantSchema.safeParse(await readJsonFile(path, "variant"));
  if (!parsed.success) {
    throw new InvalidDataError(`Invalid variant at ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}

/**
 * Validates, then writes atomically: a sibling temp file is written and
 * fsync-free renamed over the target, which is atomic on both POSIX and NTFS.
 */
export async function writeVariant(
  profileId: string,
  variantId: string,
  variant: Variant,
): Promise<void> {
  const parsed = variantSchema.safeParse(variant);
  if (!parsed.success) {
    throw new InvalidDataError(`Refusing to write invalid variant: ${parsed.error.message}`);
  }

  const target = variantPath(profileId, variantId);
  const temp = `${target}.${randomUUID()}.tmp`;
  await mkdir(variantsDir(profileId), { recursive: true });
  try {
    await writeFile(temp, `${JSON.stringify(parsed.data, null, 2)}\n`, "utf8");
    await rename(temp, target);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

/**
 * Scaffolds a new profile: the directory, an empty `content-library.json`
 * and the `variants/` directory the editor will write into (SPEC §9, §12.7).
 *
 * The library is empty apart from the person's name, which goes into the
 * header because that is where the resume renders it — there is nowhere else
 * for it to live, and dropping it would mean asking for it twice.
 *
 * `wx` on the write is what makes this safe: creating the directory first
 * then checking would be a race, whereas an exclusive create fails outright
 * if a library is already there, so an existing profile can never be
 * flattened by a repeated submission.
 */
export async function createProfile(profileId: string, name: string): Promise<void> {
  const dir = profileDir(profileId);
  const library = contentLibrarySchema.parse({
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    header: { name },
  });

  await mkdir(join(dir, "variants"), { recursive: true });
  try {
    await writeFile(libraryPath(profileId), `${JSON.stringify(library, null, 2)}
`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new ConflictError(`A profile named ${profileId} already exists`);
    }
    throw error;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

/**
 * Renames the file, and nothing else: the slug *is* the variant's id (§12.5),
 * so moving the file is the whole operation — `tag`, `label` and `updatedAt`
 * describe the curation, not its name, and a rename does not touch the
 * content the timestamps refer to.
 *
 * The target is checked first because `rename` silently overwrites on both
 * POSIX and NTFS, and renaming onto an existing variant would destroy it
 * without a word.
 */
export async function renameVariant(
  profileId: string,
  fromId: string,
  toId: string,
): Promise<void> {
  const from = variantPath(profileId, fromId);
  const to = variantPath(profileId, toId);
  if (from === to) return;

  if (!(await exists(from))) throw new NotFoundError(`No variant at ${from}`);
  if (await exists(to)) throw new ConflictError(`A variant named ${toId} already exists`);
  await rename(from, to);
}

/** Renames the profile directory, carrying its library and every variant. */
export async function renameProfile(fromId: string, toId: string): Promise<void> {
  const from = profileDir(fromId);
  const to = profileDir(toId);
  if (from === to) return;

  if (!(await exists(from))) throw new NotFoundError(`No profile at ${from}`);
  if (await exists(to)) throw new ConflictError(`A profile named ${toId} already exists`);
  await rename(from, to);
}

/**
 * Deletes the whole profile — library, variants and all. Irreversible and
 * unrecoverable (there is no trash), so every caller must confirm first (§15.12).
 */
export async function deleteProfile(profileId: string): Promise<void> {
  const dir = profileDir(profileId);
  if (!(await exists(dir))) throw new NotFoundError(`No profile at ${dir}`);
  await rm(dir, { recursive: true, force: true });
}

export async function deleteVariant(profileId: string, variantId: string): Promise<void> {
  const path = variantPath(profileId, variantId);
  try {
    await unlink(path);
  } catch (error) {
    if (isMissing(error)) throw new NotFoundError(`No variant at ${path}`);
    throw error;
  }
}
