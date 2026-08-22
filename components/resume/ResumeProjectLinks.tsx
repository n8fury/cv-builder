/**
 * A project's repository and demo links (SPEC §5.5, §6.4).
 *
 * Presence is the toggle: a link renders whenever its URL is set on the
 * library item, and there is no per-variant visibility flag for links.
 *
 * Set in the body face at body colour, underlined — a printed CV has no
 * hover state and no blue-link convention to borrow, so the underline is the
 * only affordance, and colouring it would be the one non-black element on
 * the page. The href stays live so the exported PDF's links are clickable.
 *
 * Neither URL is set in the canonical source (§12.6), so nothing here is
 * measured: the links sit in the right column under the dates — the slot
 * Experience uses for its location and Projects otherwise leaves empty —
 * which keeps every §4.4 metric on the left column untouched.
 */
const SEPARATOR = " | ";

/** `https://github.com/jordan-rivera-demo/foo` → `github.com/jordan-rivera-demo/foo` (§15.9's bare style). */
export function linkLabel(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function ResumeProjectLinks({
  repoUrl,
  demoUrl,
}: {
  repoUrl: string | null;
  demoUrl: string | null;
}) {
  const urls = [repoUrl, demoUrl].filter((url): url is string => Boolean(url));
  if (urls.length === 0) return null;
  return (
    <div className="resume-entry-links">
      {urls.map((url, index) => (
        <span key={url}>
          {index === 0 ? null : SEPARATOR}
          <a className="resume-link" href={url}>
            {linkLabel(url)}
          </a>
        </span>
      ))}
    </div>
  );
}
