"use client";

/**
 * A link that says it is working (SPEC §13's spirit, §7).
 *
 * Every screen here is `force-dynamic` and reads the profile off disk, so
 * following View, Edit or Library is a request, not a jump — and a plain
 * `<Link>` gives no sign of it. The route-level `loading.tsx` files cover the
 * gap once the navigation commits; this covers the moment before that, which
 * is exactly when a second, impatient click happens.
 *
 * `useLinkStatus` has to be read from *inside* the `<Link>` subtree, which is
 * why the indicator is its own component rather than a flag on this one.
 *
 * Toasts (`Toaster.tsx`) live beside this for the same reason: feedback
 * belongs where the person is looking.
 */
import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

/**
 * The same spinner the Download button uses, so "working" looks like one
 * thing across the dashboard rather than three.
 */
function Spinner() {
  return (
    <svg aria-hidden className="size-3 animate-spin" viewBox="0 0 16 16">
      <circle
        cx="8"
        cy="8"
        fill="none"
        r="6"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="2"
      />
      <path
        d="M8 2a6 6 0 0 1 6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

/** `data-pending` is what the check script reads; `role=status` is for people. */
function Indicator() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="ml-1.5 inline-flex items-center" data-pending="true" role="status">
      <Spinner />
      <span className="sr-only">Loading…</span>
    </span>
  );
}

export function PendingLink({
  children,
  className,
  href,
  prefetch,
}: {
  children: ReactNode;
  className?: string;
  href: string;
  /**
   * Dynamic routes are not prefetched to completion anyway, so the default
   * stands; `false` is here for links whose destination is heavy enough that
   * even the partial prefetch is wasted work.
   */
  prefetch?: boolean;
}) {
  return (
    <Link className={`inline-flex items-baseline ${className ?? ""}`} href={href} prefetch={prefetch}>
      {children}
      <Indicator />
    </Link>
  );
}
