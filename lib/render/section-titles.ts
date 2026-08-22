/**
 * Section heading text (SPEC §5, §15.9).
 *
 * Title Case, not uppercase — the source sets "About Me", "Core
 * Competencies". Custom sections carry their own title on the library item
 * (§12.4), so they have no entry here.
 */
import type { SectionType } from "@/lib/schema/variant";

export const SECTION_TITLE: Record<Exclude<SectionType, "header" | "custom">, string> = {
  aboutMe: "About Me",
  competencies: "Core Competencies",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  skills: "Technical Skills",
  certifications: "Certifications",
  languages: "Languages",
  recommendations: "Recommendations",
};
