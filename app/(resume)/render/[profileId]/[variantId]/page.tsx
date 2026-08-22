/**
 * The render route (SPEC §7, §11.1).
 *
 * A server component reading the variant and library off disk — the single
 * surface both the live editor preview and the Puppeteer export path point
 * at. A missing profile or variant is a 404, never a blank page (§13).
 */
import { notFound } from "next/navigation";

import { ResumeAboutMe } from "@/components/resume/ResumeAboutMe";
import { ResumeCompetencies } from "@/components/resume/ResumeCompetencies";
import { ResumeCustomSection } from "@/components/resume/ResumeCustomSection";
import { ResumeEducation } from "@/components/resume/ResumeEducation";
import { ResumeCertifications } from "@/components/resume/ResumeCertifications";
import { ResumeLanguages } from "@/components/resume/ResumeLanguages";
import { ResumeSkills } from "@/components/resume/ResumeSkills";
import { ResumeExperience } from "@/components/resume/ResumeExperience";
import { ResumeHeader } from "@/components/resume/ResumeHeader";
import { ResumePage } from "@/components/resume/ResumePage";
import { ResumeProjects } from "@/components/resume/ResumeProjects";
import { ResumeRecommendations } from "@/components/resume/ResumeRecommendations";
import { ResumeSection } from "@/components/resume/ResumeSection";
import { SECTION_TITLE } from "@/lib/render/section-titles";
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
        const title =
          section.type === "custom" ? section.section.title : SECTION_TITLE[section.type];
        return (
          <ResumeSection key={key} type={section.type} title={title}>
            {section.type === "aboutMe" ? <ResumeAboutMe text={section.text} /> : null}
            {section.type === "competencies" ? (
              <ResumeCompetencies items={section.items} />
            ) : null}
            {section.type === "experience" ? (
              <ResumeExperience entries={section.entries} />
            ) : null}
            {section.type === "projects" ? (
              <ResumeProjects entries={section.entries} />
            ) : null}
            {section.type === "education" ? (
              <ResumeEducation entries={section.entries} />
            ) : null}
            {section.type === "skills" ? <ResumeSkills groups={section.groups} /> : null}
            {section.type === "certifications" ? (
              <ResumeCertifications entries={section.entries} />
            ) : null}
            {section.type === "languages" ? (
              <ResumeLanguages entries={section.entries} />
            ) : null}
            {section.type === "recommendations" ? (
              <ResumeRecommendations mode={section.mode} entries={section.entries} />
            ) : null}
            {section.type === "custom" ? (
              <ResumeCustomSection section={section.section} />
            ) : null}
          </ResumeSection>
        );
      })}
    </ResumePage>
  );
}
