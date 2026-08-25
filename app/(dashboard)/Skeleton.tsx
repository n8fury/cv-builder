/**
 * The pieces the route-level `loading.tsx` files are built from (SPEC §7).
 *
 * Every screen in this group is `force-dynamic`: the dashboard lists the
 * profiles directory, the editor and the manager read a library off disk. That
 * is a real wait, and Next will happily hold the *previous* page on screen for
 * its duration — which reads as a click that did nothing. A skeleton shaped
 * like the screen being fetched says which one is coming, not merely that
 * something is.
 *
 * Server components: a placeholder that has to hydrate before it can appear
 * would defeat its own purpose.
 */

/** One grey block. Widths are Tailwind classes so the shapes stay declarative. */
export function Bar({ className }: { className: string }) {
  return <div className={`h-3 animate-pulse rounded bg-gray-200 ${className}`} />;
}

/**
 * Wraps a skeleton so assistive tech hears "loading" once, rather than
 * announcing a screenful of empty boxes.
 */
export function Loading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite" data-loading role="status">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
