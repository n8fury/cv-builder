/**
 * One `**Label:** value` line (SPEC §5.7, §5.10).
 *
 * Technical Skills and Languages are the same shape — a bold label ending in
 * a colon, then a roman value on the same line — and §5.10 is explicit that
 * the two halves are set in different faces, which is why the label is not
 * folded into the value string. Both sections run at 13pt leading, carried by
 * `--section-leading` on the section wrapper rather than by this component.
 */
import type { ReactNode } from "react";

export function ResumeLabeledLine({
  label,
  children,
  ...rest
}: {
  label: string;
  children: ReactNode;
  /** Link attributes, for the callers whose line is a curated unit (§7). */
  [attribute: `data-${string}`]: string | undefined;
}) {
  return (
    <div className="resume-labeled-line" {...rest}>
      <span className="resume-label">{label}:</span> {children}
    </div>
  );
}
