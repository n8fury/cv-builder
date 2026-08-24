"use server";

/**
 * Save and Save As for the variant editor (SPEC §7, §12.5).
 *
 * A save is two files, not one. The variant carries curation and ordering;
 * everything the person actually *typed* lives in the content library, because
 * a variant holds no text of its own (§6.2) and library edits propagate to
 * every variant referencing them (§11.4, §6.3). The editor stages both in
 * memory and commits both here.
 *
 * Both documents are re-validated server-side before anything is written. The
 * payload arrives from the client, so the schemas are the boundary — the same
 * boundary the n8n endpoint of §10 will sit behind.
 */
import { revalidatePath } from "next/cache";

import { resolveVariant } from "@/lib/data/resolve";
import {
  ConflictError,
  createVariant,
  isValidSlug,
  readLibrary,
  writeLibrary,
  writeVariant,
} from "@/lib/data/store";
import { saveAsVariantId } from "@/lib/data/variant-name";
import { contentLibrarySchema, type ContentLibrary } from "@/lib/schema/library";
import { variantSchema, type Variant } from "@/lib/schema/variant";

export interface SaveInput {
  profileId: string;
  variantId: string;
  variant: Variant;
  library: ContentLibrary;
}

export interface SaveResult {
  error: string | null;
  /** What was written — the client adopts these as its new clean baseline. */
  saved?: { variantId: string; variant: Variant; library: ContentLibrary };
}

function fail(message: string): SaveResult {
  return { error: message };
}

/**
 * Parses both documents and checks that they agree. A variant referencing an
 * ID the library does not have renders as an error rather than a page (§13),
 * and writing that pair would persist a CV nothing can open — so the resolver
 * runs here as an admission check, not just as a renderer.
 */
function validate(input: SaveInput): { variant: Variant; library: ContentLibrary } | string {
  const library = contentLibrarySchema.safeParse(input.library);
  if (!library.success) return `Content library is invalid: ${library.error.message}`;

  const variant = variantSchema.safeParse(input.variant);
  if (!variant.success) return `Variant is invalid: ${variant.error.message}`;

  try {
    resolveVariant(library.data, variant.data);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return { variant: variant.data, library: library.data };
}

/**
 * The library is rewritten only when it actually changed. A save that only
 * curated — which is most of them — then leaves `content-library.json`
 * untouched, so it cannot clobber an edit made elsewhere in the meantime.
 */
async function saveLibrary(profileId: string, library: ContentLibrary): Promise<void> {
  const onDisk = await readLibrary(profileId);
  if (JSON.stringify(onDisk) === JSON.stringify(library)) return;
  await writeLibrary(profileId, library);
}

function refresh(profileId: string, variantId: string): void {
  revalidatePath("/");
  revalidatePath(`/edit/${profileId}/${variantId}`);
}

/**
 * Overwrites the open variant and bumps `updatedAt` (§12.5). The timestamp is
 * taken here rather than in the browser, so it records when the file was
 * written and not what the user's clock says.
 */
export async function saveVariantAction(input: SaveInput): Promise<SaveResult> {
  const checked = validate(input);
  if (typeof checked === "string") return fail(checked);

  const variant: Variant = { ...checked.variant, updatedAt: new Date().toISOString() };

  try {
    await saveLibrary(input.profileId, checked.library);
    await writeVariant(input.profileId, input.variantId, variant);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }

  refresh(input.profileId, input.variantId);
  return {
    error: null,
    saved: { variantId: input.variantId, variant, library: checked.library },
  };
}

/**
 * Forks the open variant into a new file named `{tag}_{date}` (§12.5),
 * leaving the original exactly as it was on disk — the draft is written to the
 * new id only.
 */
export async function saveVariantAsAction(input: SaveInput & { tag: string }): Promise<SaveResult> {
  const checked = validate(input);
  if (typeof checked === "string") return fail(checked);

  const tag = input.tag.trim();
  if (!tag) return fail("A tag is required.");

  const nextId = saveAsVariantId(tag);
  if (!nextId || !isValidSlug(nextId)) {
    return fail("That tag has no letters or numbers to build a filename from.");
  }

  const now = new Date().toISOString();
  // The fork's own history starts now: it is a new record, and carrying the
  // parent's `createdAt` would misdate it on the dashboard.
  const variant: Variant = { ...checked.variant, tag, createdAt: now, updatedAt: now };

  try {
    await saveLibrary(input.profileId, checked.library);
    await createVariant(input.profileId, nextId, variant);
  } catch (error) {
    if (error instanceof ConflictError) {
      return fail(`${error.message} — change the tag and try again.`);
    }
    return fail(error instanceof Error ? error.message : String(error));
  }

  refresh(input.profileId, nextId);
  return { error: null, saved: { variantId: nextId, variant, library: checked.library } };
}
