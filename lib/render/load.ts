/**
 * Render-model loading for the `/render` route and the PDF export path
 * (SPEC §11.1).
 *
 * Puppeteer navigates to the same URL the live preview uses, so both paths
 * must build their model the same way: read the library and variant off disk,
 * then resolve one against the other. Keeping that in one function means the
 * export can never drift from what the preview showed.
 */
import { readLibrary, readVariant } from "../data/store";
import { resolveVariant, type RenderModel } from "../data/resolve";

export interface LoadedRender {
  profileId: string;
  variantId: string;
  model: RenderModel;
}

/**
 * Throws `NotFoundError` when the profile or variant does not exist (§13 maps
 * that to a 404) and `InvalidDataError` / `UnknownReferenceError` when the
 * files exist but do not hold a renderable resume.
 */
export async function loadRenderModel(
  profileId: string,
  variantId: string,
): Promise<LoadedRender> {
  const [library, variant] = await Promise.all([
    readLibrary(profileId),
    readVariant(profileId, variantId),
  ]);
  return { profileId, variantId, model: resolveVariant(library, variant) };
}
