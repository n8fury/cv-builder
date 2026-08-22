/**
 * A section: its heading, its rule, and its body (SPEC §4.2, §4.5, §15.11).
 *
 * `data-section` is what selects the section's own measured space-before and
 * heading→content gaps in resume.css — §16.1 is explicit that these vary by
 * section type and must never be averaged into one constant.
 *
 * The heading renders even when the body is empty (§13): a visible section
 * with nothing resolved under it is a curation state, not an error.
 */
import type { ReactNode } from "react";

import type { SectionType } from "@/lib/schema/variant";

/** `aboutMe` → `about-me`, matching the custom-property names. */
export function sectionKey(type: SectionType): string {
  return type.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

export function ResumeSection({
  type,
  title,
  children,
}: {
  type: SectionType;
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="resume-section" data-section={sectionKey(type)}>
      <h2 className="resume-section-heading">{title}</h2>
      {children}
    </section>
  );
}
