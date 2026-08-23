/**
 * Dashboard summaries (SPEC §7).
 *
 * The home page lists every profile and its saved variants, so it touches
 * every file in the store at once. That makes it the one screen where a
 * single malformed file on disk could take out the whole view — hand-edited
 * variants and n8n-written ones (§10) both land here — so each read is
 * isolated and a failure is carried as an `error` string on the row rather
 * than thrown. A broken variant then shows up as a broken variant, which is
 * exactly the thing you opened the dashboard to find out.
 */
import { listProfiles, listVariants, readLibrary, readVariant } from "./store";

export interface VariantSummary {
  id: string;
  /** Short slug shown as a chip — the `{tag}` half of `{tag}_{date}` (§7). */
  tag: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSummary {
  id: string;
  /** From the library header; empty for a freshly created profile (§12.7). */
  name: string;
  variants: VariantSummary[];
  /** Unreadable rows, by id, with the reason — never silently dropped (§13). */
  broken: { id: string; reason: string }[];
  /** Set when the profile's content library itself could not be read. */
  error?: string;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function summarizeVariant(
  profileId: string,
  variantId: string,
): Promise<VariantSummary> {
  const variant = await readVariant(profileId, variantId);
  return {
    id: variantId,
    tag: variant.tag,
    label: variant.label,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
  };
}

/** Most recently edited first — the working set sits at the top as it grows. */
function byUpdatedDesc(a: VariantSummary, b: VariantSummary): number {
  return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
}

export async function summarizeProfile(profileId: string): Promise<ProfileSummary> {
  const summary: ProfileSummary = { id: profileId, name: "", variants: [], broken: [] };

  try {
    summary.name = (await readLibrary(profileId)).header.name;
  } catch (error) {
    summary.error = reason(error);
  }

  const results = await Promise.all(
    (await listVariants(profileId)).map(async (variantId) => {
      try {
        return await summarizeVariant(profileId, variantId);
      } catch (error) {
        return { id: variantId, reason: reason(error) };
      }
    }),
  );

  for (const result of results) {
    if ("reason" in result) summary.broken.push(result);
    else summary.variants.push(result);
  }
  summary.variants.sort(byUpdatedDesc);

  return summary;
}

/** Every profile in the store, sorted by id, each with its variants. */
export async function listDashboard(): Promise<ProfileSummary[]> {
  const profileIds = await listProfiles();
  return Promise.all(profileIds.map(summarizeProfile));
}
