/**
 * A custom section's body (SPEC §5.11, §12.4).
 *
 * Freeform: either the paragraph or the bullet list may be absent, and both
 * may be present. The instance is a library item, so its title travels with
 * the content and is rendered by the section heading, not here.
 *
 * The bullets are ordinary bullets — same glyph, hanging indent, and §16.3
 * markup — so a custom section behaves like the rest of the document rather
 * than becoming a second, parallel rendering path.
 */
import { InlineText } from "./InlineText";
import { ResumeBullets } from "./ResumeBullets";

import type { ResolvedCustomSection } from "@/lib/data/resolve";

export function ResumeCustomSection({ section }: { section: ResolvedCustomSection }) {
  return (
    <div className="resume-body">
      {section.paragraph === null ? null : (
        <p className="resume-paragraph">
          <InlineText text={section.paragraph} />
        </p>
      )}
      <ResumeBullets
        bullets={section.bullets}
        source={{ owner: "customSections", entryId: section.id }}
      />
    </div>
  );
}
