/**
 * The library manager route (SPEC §7, §12.7).
 *
 * A separate screen from the variant editor, showing everything the profile
 * has ever written rather than what one CV includes. It sits in the dashboard
 * route group because it is chrome — Tailwind and toasts, no resume document.
 *
 * `?variant=` scopes only the actions that must name a single CV — Fork
 * (§11.4). Browsing and editing stay library-wide, because an edit reaches
 * every variant referencing the item whatever is selected here.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { LibraryBrowser } from "@/components/library/LibraryBrowser";
import { TagFilter } from "@/components/library/TagFilter";
import { VariantScope } from "@/components/library/VariantScope";
import { allTags, filterByTag, flattenItems, indexLibrary } from "@/lib/data/library-index";
import { NotFoundError, listVariants, readLibrary, readVariant } from "@/lib/data/store";
import { findOrphans, indexReferences, type NamedVariant } from "@/lib/data/orphans";
import { variantReferencedIds } from "@/lib/data/variant-refs";
import { libraryPath } from "@/lib/routes";

/** The library is a file on disk that the editor rewrites between requests. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/library/[profileId]">) {
  const { profileId } = await params;
  return { title: `Library — ${profileId}` };
}

/**
 * What the selected variant references. An unreadable or unknown selection
 * scopes to nothing rather than taking the page down — a hand-edited variant
 * must not cost the person the screen they came here to clean up with (§13).
 */
async function scopeOf(profileId: string, variantId: string | null) {
  if (!variantId) return { variantId: null, referenced: new Set<string>() };
  try {
    return { variantId, referenced: variantReferencedIds(await readVariant(profileId, variantId)) };
  } catch {
    return { variantId: null, referenced: new Set<string>() };
  }
}

export default async function LibraryPage({
  params,
  searchParams,
}: PageProps<"/library/[profileId]">) {
  const { profileId } = await params;
  const query = await searchParams;
  const one = (value: string | string[] | undefined): string | null =>
    typeof value === "string" && value.length > 0 ? value : null;
  const variantId = one(query.variant);
  const tag = one(query.tag);

  let library;
  let variants: string[];
  try {
    [library, variants] = await Promise.all([readLibrary(profileId), listVariants(profileId)]);
  } catch (error) {
    // A missing profile is a 404, never a blank page (§13).
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  // Every variant on disk, because "referenced by no variant" is a claim about
  // all of them. An unreadable one is listed rather than skipped: skipping it
  // would silently widen the orphan set to include what it was using.
  const read = await Promise.all(
    variants.map(
      async (id): Promise<NamedVariant | { id: string; reason: string }> => {
        try {
          return { id, variant: await readVariant(profileId, id) };
        } catch (error) {
          return { id, reason: error instanceof Error ? error.message : String(error) };
        }
      },
    ),
  );
  const readable = read.filter((entry): entry is NamedVariant => "variant" in entry);
  const unreadable = read.filter((entry) => !("variant" in entry));
  const references = indexReferences(readable);

  const groups = indexLibrary(library);
  const total = flattenItems(groups).length;
  const tags = allTags(groups);
  // An unknown tag filters to nothing and says so, rather than silently
  // showing the whole library as though the filter had not been applied.
  const shown = tag === null ? groups : filterByTag(groups, tag);
  const matchCount = flattenItems(shown).length;
  const orphans = findOrphans(library, references);
  const scope = await scopeOf(profileId, variantId);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link className="text-sm text-blue-700 hover:underline" href="/">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">
        Content library
        <span className="ml-3 font-mono text-sm font-normal text-gray-500">{profileId}</span>
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {total} item{total === 1 ? "" : "s"} across {groups.length} types, referenced by{" "}
        {readable.length} variant{readable.length === 1 ? "" : "s"}.{" "}
        {orphans.length === 0 ? (
          "Nothing is orphaned."
        ) : (
          <span className="text-amber-800">
            {orphans.length} orphaned — no variant references{" "}
            {orphans.length === 1 ? "it" : "them"}.
          </span>
        )}
      </p>

      {unreadable.length > 0 ? (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {unreadable.map((entry) => entry.id).join(", ")} could not be read, so what they reference
          is unknown — orphan marks below may be wrong, and deleting is blocked until they parse.
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        <VariantScope selected={scope.variantId} variants={variants} />
        <TagFilter
          basePath={libraryPath(profileId)}
          matchCount={matchCount}
          selected={tag}
          tags={tags}
          variantId={scope.variantId}
        />
      </div>

      <div className="mt-6">
        <LibraryBrowser
          groups={shown}
          profileId={profileId}
          references={references}
          scope={scope}
        />
      </div>
    </main>
  );
}
