/**
 * About Me — one paragraph of body text (SPEC §5.2).
 *
 * Justified, not ragged: the source sets a different word-space delta on each
 * line of this paragraph (Tw -0.02 … 0.22) and none at all on the competencies
 * run below it, which is what justified and left-aligned text look like coming
 * out of a design tool.
 */
import { InlineText } from "./InlineText";

export function ResumeAboutMe({ text }: { text: string }) {
  return (
    <p className="resume-body resume-paragraph">
      <InlineText text={text} />
    </p>
  );
}
