/**
 * Recommendations, collapsed or expanded (SPEC §5.9, §15.5).
 *
 * Collapsed is the single stock line; expanded stacks one block per entry:
 * name in bold, then the combined role/institution line, location, and a
 * label-prefixed email. Which entries appear is curated per variant by ID,
 * the same pattern experience bullets use — the resolver has already applied
 * it by the time this renders.
 *
 * An empty field drops its line rather than leaving a blank one, matching how
 * the header drops an empty contact field.
 *
 * Neither source document has a Recommendations section, so nothing here is
 * measured: the lines are plain body leading, and the gap between entries is
 * borrowed (see RECOMMENDATION_GAP_MARGIN_PT).
 */
import type { Recommendation } from "@/lib/schema/library";

/** The collapsed mode's fixed text (§5.9). */
export const COLLAPSED_TEXT = "References available upon request";

const EMAIL_LABEL = "Email:";

export function ResumeRecommendations({
  mode,
  entries,
}: {
  mode: "collapsed" | "expanded";
  entries: Recommendation[];
}) {
  if (mode === "collapsed") {
    return <p className="resume-body">{COLLAPSED_TEXT}</p>;
  }
  return (
    <div className="resume-body">
      {entries.map((entry) => (
        <div className="resume-recommendation" key={entry.id}>
          {entry.name ? (
            <div className="resume-recommendation-name">{entry.name}</div>
          ) : null}
          {entry.role ? <div>{entry.role}</div> : null}
          {entry.location ? <div>{entry.location}</div> : null}
          {entry.email ? (
            <div>
              {EMAIL_LABEL} {entry.email}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
