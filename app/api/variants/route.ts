/**
 * Variant-write API for external drafting (SPEC §10, §13).
 *
 * The n8n workflow's save step, and the only way into `data/profiles/` that
 * is not a person clicking something. §10 makes the LLM a *selector*: it
 * chooses library IDs and their order, and writes nothing. This endpoint is
 * where that is settled rather than requested — every reference in the body is
 * checked against the profile's library, and a draft naming an ID the library
 * does not have is rejected whole, with the offending IDs named so the caller
 * can see exactly what it made up.
 *
 * Timestamps and `schemaVersion` are set here, not accepted from the caller:
 * they describe the write, and the write happens here.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { libraryIds } from "@/lib/data/ids";
import { UnknownReferenceError, resolveVariant } from "@/lib/data/resolve";
import {
  ConflictError,
  InvalidDataError,
  NotFoundError,
  createVariant,
  isValidSlug,
  readLibrary,
  writeVariant,
} from "@/lib/data/store";
import { danglingRefs } from "@/lib/data/variant-refs";
import { VARIANT_SCHEMA_VERSION, sectionSchema, variantSchema } from "@/lib/schema/variant";
import { editPath, exportPath } from "@/lib/routes";

/** Filesystem reads and writes make this a Node runtime route. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What a drafter sends. Strict, like the variant schema itself: a mistyped key
 * from a generated payload must fail loudly rather than be dropped (§6.2).
 */
const draftRequestSchema = z.strictObject({
  profileId: z.string().min(1),
  variantId: z.string().min(1),
  tag: z.string().min(1),
  label: z.string().default(""),
  sections: z.array(sectionSchema).default([]),
  /**
   * Off by default so a repeated webhook delivery cannot overwrite curation
   * someone has since edited by hand; on, so a deliberate re-draft under the
   * same id does not need a delete first.
   */
  overwrite: z.boolean().default(false),
});

function errorResponse(status: number, message: string, extra: object = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * Optional shared secret. Unset — the self-hosted default of §9 — and the
 * endpoint is open exactly like the rest of the app; set, and every caller
 * must present it, which is what makes this safe to expose to an n8n instance
 * that is not on the same machine.
 */
function unauthorized(request: Request): boolean {
  const token = process.env.CV_API_TOKEN;
  if (!token) return false;
  return request.headers.get("authorization") !== `Bearer ${token}`;
}

export async function POST(request: Request) {
  if (unauthorized(request)) return errorResponse(401, "Invalid or missing API token");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Request body is not valid JSON");
  }

  const parsed = draftRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, `Invalid request body: ${z.prettifyError(parsed.error)}`);
  }
  const { profileId, variantId, tag, label, sections, overwrite } = parsed.data;

  // Caught here rather than left to the store, which reports a bad slug as a
  // 404 — accurate for a URL, misleading for a body field the caller chose.
  for (const [field, value] of [
    ["profileId", profileId],
    ["variantId", variantId],
  ] as const) {
    if (!isValidSlug(value)) {
      return errorResponse(400, `${field} must be a slug of letters, digits, dashes or underscores`);
    }
  }

  let library;
  try {
    library = await readLibrary(profileId);
  } catch (error) {
    if (error instanceof NotFoundError) return errorResponse(404, `No profile ${profileId}`);
    if (error instanceof InvalidDataError) return errorResponse(500, error.message);
    throw error;
  }

  const now = new Date().toISOString();
  const candidate = variantSchema.safeParse({
    schemaVersion: VARIANT_SCHEMA_VERSION,
    tag,
    label,
    createdAt: now,
    updatedAt: now,
    sections,
  });
  if (!candidate.success) {
    return errorResponse(400, `Invalid variant: ${z.prettifyError(candidate.error)}`);
  }
  const variant = candidate.data;

  // §10's whole constraint, enforced: the draft may only name content that
  // already exists. All of them at once, so a hallucinating model learns about
  // every invented ID in one response.
  const missing = danglingRefs(variant, libraryIds(library));
  if (missing.length > 0) {
    return errorResponse(
      400,
      `Variant references ${missing.length} unknown library ${
        missing.length === 1 ? "id" : "ids"
      }: ${missing.join(", ")}`,
      { unknownIds: missing },
    );
  }

  // The IDs all exist, but an existing ID can still be used in the wrong slot —
  // an experience id sitting in `aboutMeId` would pass the check above and
  // break at render. Resolving now means a stored draft is always renderable.
  try {
    resolveVariant(library, variant);
  } catch (error) {
    if (error instanceof UnknownReferenceError) {
      return errorResponse(400, error.message, { unknownIds: [error.id] });
    }
    throw error;
  }

  try {
    if (overwrite) await writeVariant(profileId, variantId, variant);
    else await createVariant(profileId, variantId, variant);
  } catch (error) {
    if (error instanceof ConflictError) {
      return errorResponse(409, `A variant named ${variantId} already exists`);
    }
    throw error;
  }

  // The caller's next two steps (§10): render the PDF, then send the person a
  // link to fine-tune the draft by hand.
  return NextResponse.json(
    {
      profileId,
      variantId,
      editPath: editPath(profileId, variantId),
      exportPath: exportPath(profileId, variantId, { download: true }),
    },
    { status: 201 },
  );
}
