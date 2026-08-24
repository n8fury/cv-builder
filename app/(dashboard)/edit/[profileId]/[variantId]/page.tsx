/**
 * The variant editor route (SPEC §7).
 *
 * Server component: it reads the library and the variant off disk and hands
 * both to the client shell as the store's opening snapshot. It sits in the
 * dashboard's route group because the editor *is* chrome — Tailwind, toasts
 * and all — while the resume it previews stays sealed inside an iframe.
 */
import { notFound } from "next/navigation";

import { EditorShell } from "@/components/editor/EditorShell";
import { NotFoundError, readLibrary, readVariant } from "@/lib/data/store";
import { resumeStylesheet } from "@/lib/render/stylesheet";
import type { ContentLibrary } from "@/lib/schema/library";
import type { Variant } from "@/lib/schema/variant";

/** The variant on disk is the store's starting point; never serve a cached one. */
export const dynamic = "force-dynamic";

interface Opened {
  library: ContentLibrary;
  variant: Variant;
  css: string;
}

/** Reading is what can fail here, so the try/catch wraps only the read. */
async function open(profileId: string, variantId: string): Promise<Opened> {
  try {
    const [library, variant, css] = await Promise.all([
      readLibrary(profileId),
      readVariant(profileId, variantId),
      resumeStylesheet(),
    ]);
    return { library, variant, css };
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<"/edit/[profileId]/[variantId]">) {
  const { profileId, variantId } = await params;
  return { title: `Edit ${profileId} — ${variantId}` };
}

export default async function EditPage({ params }: PageProps<"/edit/[profileId]/[variantId]">) {
  const { profileId, variantId } = await params;

  const { library, variant, css } = await open(profileId, variantId);

  return <EditorShell snapshot={{ profileId, variantId, library, variant }} css={css} />;
}
