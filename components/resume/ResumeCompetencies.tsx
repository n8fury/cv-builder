/**
 * Core Competencies — one bold run, pipe-separated (SPEC §5.3, §15.9).
 *
 * A single flowing run, not a list: the source wraps it as ordinary text, so
 * the separator has to be able to fall at a line break like any other word.
 */
import { Fragment } from "react";

import { InlineText } from "./InlineText";
import { linkTarget } from "./link-targets";

import type { ResolvedBullet } from "@/lib/data/resolve";

const SEPARATOR = " | ";

export function ResumeCompetencies({ items }: { items: ResolvedBullet[] }) {
  return (
    <p className="resume-body resume-competencies">
      {items.map((item, index) => (
        // An entry, not a bullet: the form curates one competency per row,
        // with no second level under it (§12.3). The separator sits outside
        // the span so a highlight covers the competency and not the pipe in
        // front of it — same text, same order, a sibling text node rather
        // than a nested one.
        <Fragment key={item.id}>
          {index > 0 ? SEPARATOR : ""}
          <span {...linkTarget("entry", item.id)}>
            <InlineText text={item.text} />
          </span>
        </Fragment>
      ))}
    </p>
  );
}
