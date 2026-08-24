/**
 * Save As naming (SPEC §12.5).
 *
 * A forked variant is auto-named `{tag}_{date}` — `google-swe_2026-08-22` —
 * and the filename slug *is* the record's id, so the name has to survive
 * `isValidSlug` before it ever reaches the filesystem. The tag itself is typed
 * by the person and may be anything; this is the one place that turns it into
 * a filename.
 */

/** ISO date, no time: the id names a day, not a moment (§12.5). */
export function isoDate(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

/**
 * A tag reduced to a filename-safe slug. Anything outside `[a-z0-9]` becomes a
 * dash, because that is what §12.5's own example does with a space
 * ("Google SWE" → `google-swe`), and a run of them collapses to one.
 */
export function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The variant id a Save As produces. Returns `null` when the tag has no
 * slug-able characters at all — the caller reports that rather than writing a
 * file named after the date alone, which would say nothing about its contents.
 */
export function saveAsVariantId(tag: string, at: Date = new Date()): string | null {
  const slug = slugifyTag(tag);
  return slug.length > 0 ? `${slug}_${isoDate(at)}` : null;
}
