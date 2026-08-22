/**
 * Core Competencies — one bold run, pipe-separated (SPEC §5.3, §15.9).
 *
 * A single flowing run, not a list: the source wraps it as ordinary text, so
 * the separator has to be able to fall at a line break like any other word.
 */
import { InlineText } from "./InlineText";

import type { ResolvedBullet } from "@/lib/data/resolve";

const SEPARATOR = " | ";

export function ResumeCompetencies({ items }: { items: ResolvedBullet[] }) {
  return (
    <p className="resume-body resume-competencies">
      {items.map((item, index) => (
        <span key={item.id}>
          {index > 0 ? SEPARATOR : ""}
          <InlineText text={item.text} />
        </span>
      ))}
    </p>
  );
}
