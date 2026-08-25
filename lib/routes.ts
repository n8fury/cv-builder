/**
 * The URLs the dashboard's actions point at (SPEC §7).
 *
 * The dashboard, the export route and the harness all have to agree on where
 * a variant lives and what its download is called; keeping the two paths and
 * the filename in one place means a rename never leaves a dead button behind.
 */

/** Where a variant renders — the live preview and Puppeteer's print target. */
export function renderPath(profileId: string, variantId: string): string {
  return `/render/${encodeURIComponent(profileId)}/${encodeURIComponent(variantId)}`;
}

/** Where a variant is curated — the two-column editor (§7). */
export function editPath(profileId: string, variantId: string): string {
  return `/edit/${encodeURIComponent(profileId)}/${encodeURIComponent(variantId)}`;
}

/**
 * Where a profile's content library is browsed and cleaned up — the library
 * manager, a separate screen from the variant editor (§7, §12.7).
 */
export function libraryPath(profileId: string): string {
  return `/library/${encodeURIComponent(profileId)}`;
}

/**
 * The export endpoint. `download` flips the response from an inline preview
 * to a save-to-disk attachment, so one endpoint serves both the browser's PDF
 * viewer and the dashboard's Download button.
 */
export function exportPath(
  profileId: string,
  variantId: string,
  options: { download?: boolean } = {},
): string {
  const query = new URLSearchParams({ profileId, variantId });
  if (options.download) query.set("download", "1");
  return `/api/generate-pdf?${query.toString()}`;
}

/** Derived from the variant id, which is the variant's identity (§12.5). */
export function pdfFilename(profileId: string, variantId: string): string {
  return `${profileId}-${variantId}.pdf`;
}

/**
 * Both ids have already passed the store's slug check by the time this runs,
 * so neither can carry a quote or newline into the header.
 */
export function contentDisposition(
  profileId: string,
  variantId: string,
  options: { download?: boolean } = {},
): string {
  const kind = options.download ? "attachment" : "inline";
  return `${kind}; filename="${pdfFilename(profileId, variantId)}"`;
}
