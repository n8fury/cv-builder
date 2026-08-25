/**
 * Read-only content-library API (SPEC §10, step 2).
 *
 * The drafting workflow's first real step is "fetch the profile's
 * content-library.json", and n8n does not necessarily run on the machine the
 * profiles live on — so it fetches over HTTP rather than reading the disk.
 *
 * Two shapes, because the workflow wants two things from one file: the raw
 * library, and the catalogue of IDs and text the LLM node is prompted with
 * (§10's "may only select"). Building the catalogue here keeps the prompt and
 * the schema in one repo instead of pasted into a workflow that nothing tests.
 */
import { NextResponse } from "next/server";

import { InvalidDataError, NotFoundError, readLibrary } from "@/lib/data/store";
import { DRAFT_SYSTEM_PROMPT, libraryDigest } from "@/lib/n8n/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const profileId = params.get("profileId");
  // `?format=catalogue` returns what the LLM node needs and nothing else: the
  // system prompt and the id/text listing, with no schema noise to distract a
  // model that is only allowed to pick IDs out of it.
  const catalogue = params.get("format") === "catalogue";

  if (!profileId) return errorResponse(400, "profileId is required");

  try {
    const library = await readLibrary(profileId);
    return NextResponse.json(
      catalogue
        ? { profileId, systemPrompt: DRAFT_SYSTEM_PROMPT, catalogue: libraryDigest(library) }
        : { profileId, library },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof NotFoundError) return errorResponse(404, `No profile ${profileId}`);
    if (error instanceof InvalidDataError) return errorResponse(500, error.message);
    throw error;
  }
}
