"use server";

/**
 * Dashboard mutations — Rename and Delete for variants and profiles (§15.12).
 *
 * Server actions rather than API routes: these are form submissions from the
 * dashboard itself, and `revalidatePath("/")` re-reads the store so the row
 * reflects the filesystem immediately after the move or the unlink.
 *
 * Every failure comes back as a message on the returned state. The store's
 * errors already say what went wrong ("A variant named detailed already
 * exists"), and swallowing them into a generic "something failed" would hide
 * exactly the case the user needs to see.
 */
import { revalidatePath } from "next/cache";

import {
  deleteProfile,
  deleteVariant,
  isValidSlug,
  renameProfile,
  renameVariant,
} from "@/lib/data/store";

import { IDLE, type ActionState } from "./action-state";

const BAD_SLUG =
  "Use letters, numbers, dashes or underscores only, starting with a letter or number.";

function fail(message: string): ActionState {
  return { error: message };
}

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

/** Refreshes the dashboard so the moved or removed row is gone on the next paint. */
async function done(): Promise<ActionState> {
  revalidatePath("/");
  return IDLE;
}

async function run(operation: () => Promise<void>): Promise<ActionState> {
  try {
    await operation();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
  return done();
}

export async function renameVariantAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const profileId = field(form, "profileId");
  const variantId = field(form, "variantId");
  const nextId = field(form, "nextId");

  if (!nextId) return fail("A new name is required.");
  if (!isValidSlug(nextId)) return fail(BAD_SLUG);

  return run(() => renameVariant(profileId, variantId, nextId));
}

export async function deleteVariantAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(() => deleteVariant(field(form, "profileId"), field(form, "variantId")));
}

export async function renameProfileAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const profileId = field(form, "profileId");
  const nextId = field(form, "nextId");

  if (!nextId) return fail("A new name is required.");
  if (!isValidSlug(nextId)) return fail(BAD_SLUG);

  return run(() => renameProfile(profileId, nextId));
}

/** Removes the library and every variant with it — the UI confirms first. */
export async function deleteProfileAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(() => deleteProfile(field(form, "profileId")));
}
