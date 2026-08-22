/**
 * The page shell (SPEC §2, §8).
 *
 * One Letter-size box, 612×792pt, with the 55pt margins applied as padding —
 * §8 is explicit that the real margins live here and that Puppeteer's own PDF
 * margin option stays at zero, so `preferCSSPageSize` has nothing to fight
 * with. `min-height` rather than `height`: §11.5 allows a CV to run onto more
 * pages, and each printed page picks up the same margins from `@page`.
 */
import type { ReactNode } from "react";

export function ResumePage({ children }: { children: ReactNode }) {
  return (
    <div className="resume-page">
      {children}
      <div className="resume-page-guides" aria-hidden="true" />
    </div>
  );
}
