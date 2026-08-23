/**
 * A section's body, dispatched on section type (SPEC §5, §13).
 *
 * The one place a resolved section becomes markup, so the render route stays
 * a list of sections rather than a switch statement. A section curated down
 * to nothing renders no body at all — not an empty wrapper — leaving the
 * heading and its rule standing alone, which is §13's "empty body, no crash".
 */
import { ResumeAboutMe } from "./ResumeAboutMe";
import { ResumeCertifications } from "./ResumeCertifications";
import { ResumeCompetencies } from "./ResumeCompetencies";
import { ResumeCustomSection } from "./ResumeCustomSection";
import { ResumeEducation } from "./ResumeEducation";
import { ResumeExperience } from "./ResumeExperience";
import { ResumeLanguages } from "./ResumeLanguages";
import { ResumeProjects } from "./ResumeProjects";
import { ResumeRecommendations } from "./ResumeRecommendations";
import { ResumeSkills } from "./ResumeSkills";

import { sectionHasContent, type ResolvedSection } from "@/lib/data/resolve";

export function ResumeSectionBody({ section }: { section: ResolvedSection }) {
  if (!sectionHasContent(section)) return null;

  switch (section.type) {
    // The header is its own block, not a heading plus a body (§5.1).
    case "header":
      return null;
    case "aboutMe":
      return <ResumeAboutMe text={section.text} />;
    case "competencies":
      return <ResumeCompetencies items={section.items} />;
    case "experience":
      return <ResumeExperience entries={section.entries} />;
    case "projects":
      return <ResumeProjects entries={section.entries} />;
    case "education":
      return <ResumeEducation entries={section.entries} />;
    case "skills":
      return <ResumeSkills groups={section.groups} />;
    case "certifications":
      return <ResumeCertifications entries={section.entries} />;
    case "languages":
      return <ResumeLanguages entries={section.entries} />;
    case "recommendations":
      return <ResumeRecommendations mode={section.mode} entries={section.entries} />;
    case "custom":
      return <ResumeCustomSection section={section.section} />;
  }
}
