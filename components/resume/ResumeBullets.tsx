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
import { BulletText, type BulletSource } from "./editable";
import { linkTarget } from "./link-targets";

import type { ResolvedBullet } from "@/lib/data/resolve";

const MARKER = "•";

export function ResumeBullets({
  bullets,
  source,
}: {
  bullets: ResolvedBullet[];
  /**
   * Where these bullets live in the library, for the editor's preview to
   * write back to (`editable`). Absent for a list that is not curated bullet
   * by bullet — Education's lone description bullet, which is a field of its
   * entry (§16.4) — which is what leaves those blocks uneditable in place.
   */
  source?: BulletSource;
}) {
  if (bullets.length === 0) return null;
  return (
    <ul className="resume-bullets">
      {bullets.map((bullet) => (
        <li className="resume-bullet" key={bullet.id} {...linkTarget("bullet", bullet.id)}>
          <span className="resume-bullet-marker" aria-hidden="true">
            {MARKER}
          </span>
          <BulletText id={bullet.id} source={source} text={bullet.text} />
        </li>
      ))}
    </ul>
  );
}
