/**
 * A bullet list (SPEC §4.5, §5.4, §16.3).
 *
 * Bullets are consecutive body lines with no gap between them — the source
 * runs 432.09 → 420.09 → 408.09 — so the only vertical metric here is the
 * leading itself. Wrapped lines hang at +20pt from the margin and the marker
 * sits out to their left, which is why the marker is positioned rather than
 * flowed: it must not occupy width on the first line.
 *
 * Justified, like the source: each bullet's first lines carry a word-space
 * delta and its last line carries none.
 */
import { InlineText } from "./InlineText";

import type { ResolvedBullet } from "@/lib/data/resolve";

const MARKER = "•";

export function ResumeBullets({ bullets }: { bullets: ResolvedBullet[] }) {
  if (bullets.length === 0) return null;
  return (
    <ul className="resume-bullets">
      {bullets.map((bullet) => (
        <li className="resume-bullet" key={bullet.id}>
          <span className="resume-bullet-marker" aria-hidden="true">
            {MARKER}
          </span>
          <InlineText text={bullet.text} />
        </li>
      ))}
    </ul>
  );
}
