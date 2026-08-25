/**
 * Filter the library by tag (SPEC §6.1, §7).
 *
 * Links rather than a form: the filter is part of what the page *is*, so it
 * belongs in the URL — bookmarkable, reloadable, and shareable with the
 * variant scope beside it, which each link therefore carries through.
 */
import Link from "next/link";

const CHIP = "rounded px-2 py-0.5 text-xs font-medium";

export function TagFilter({
  basePath,
  tags,
  selected,
  variantId,
  matchCount,
}: {
  basePath: string;
  tags: string[];
  selected: string | null;
  variantId: string | null;
  /** How many items survive the filter, so an empty result explains itself. */
  matchCount: number;
}) {
  const href = (tag: string | null): string => {
    const query = new URLSearchParams();
    if (variantId) query.set("variant", variantId);
    if (tag) query.set("tag", tag);
    const search = query.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  if (tags.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        No tags in this library yet — add them on any item below to filter by them.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-sm text-gray-600">Filter by tag</span>
      <Link
        className={`${CHIP} ${selected === null ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        href={href(null)}
      >
        all
      </Link>
      {tags.map((tag) => (
        <Link
          key={tag}
          className={`${CHIP} ${selected === tag ? "bg-blue-700 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
          href={href(tag)}
        >
          {tag}
        </Link>
      ))}
      {selected ? (
        <span className="text-xs text-gray-500">
          {matchCount} item{matchCount === 1 ? "" : "s"} tagged {selected}
        </span>
      ) : null}
    </div>
  );
}
