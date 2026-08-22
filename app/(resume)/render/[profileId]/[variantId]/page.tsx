/**
 * The render route (SPEC §7, §11.1).
 *
 * A server component reading the variant and library off disk — the single
 * surface both the live editor preview and the Puppeteer export path point
 * at. A missing profile or variant is a 404, never a blank page (§13).
 */
import { notFound } from "next/navigation";

import { ResumeHeader } from "@/components/resume/ResumeHeader";
import { ResumePage } from "@/components/resume/ResumePage";
import { NotFoundError } from "@/lib/data/store";
import { loadRenderModel, type LoadedRender } from "@/lib/render/load";

/** Variants change on disk between requests; never serve a cached resume. */
export const dynamic = "force-dynamic";

async function load(profileId: string, variantId: string): Promise<LoadedRender> {
  try {
    return await loadRenderModel(profileId, variantId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<"/render/[profileId]/[variantId]">) {
  const { profileId, variantId } = await params;
  return { title: `${profileId} — ${variantId}` };
}

export default async function RenderPage({
  params,
}: PageProps<"/render/[profileId]/[variantId]">) {
  const { profileId, variantId } = await params;
  const { model } = await load(profileId, variantId);

  return (
    <ResumePage>
      {model.sections.map((section, index) => {
        const key = `${section.type}-${index}`;
        if (section.type === "header") {
          return <ResumeHeader key={key} header={section.header} mode={section.mode} />;
        }
        return <div key={key}>{section.type}</div>;
      })}
    </ResumePage>
  );
}
