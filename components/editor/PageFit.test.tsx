import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PageFit } from "./PageFit";

import { CONTENT_HEIGHT_PT } from "@/lib/render/metrics";
import { paginate, type FlowBlock } from "@/lib/render/pagination";

/**
 * Rendered text with the markup taken out, which is what the reading actually
 * is — the figures are chrome, not a document, so they are asserted as the
 * sentence a person reads rather than as a tree.
 */
function readout(node: React.ReactElement): string {
  return renderToStaticMarkup(node)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** The real page, so every figure below is one the editor could actually show. */
const page = (options: Omit<Parameters<typeof paginate>[0], "usableHeight">) =>
  paginate({ ...options, usableHeight: CONTENT_HEIGHT_PT });

describe("PageFit", () => {
  it("says how much room is left on the only page", () => {
    const text = readout(
      <PageFit pagination={page({ blocks: [], contentHeight: CONTENT_HEIGHT_PT - 120 })} />,
    );

    expect(text).toContain("1 page");
    expect(text).toContain("120pt free");
    // 120pt of body leading is ten lines — the unit a person edits in.
    expect(text).toContain("room for 10 more lines");
  });

  it("says a full page is full rather than offering a part-line", () => {
    const text = readout(
      <PageFit pagination={page({ blocks: [], contentHeight: CONTENT_HEIGHT_PT - 4 })} />,
    );

    expect(text).toContain("Page 1 is full");
    expect(text).not.toContain("room for");
  });

  it("says how much spilled past the break", () => {
    const text = readout(
      <PageFit pagination={page({ blocks: [], contentHeight: CONTENT_HEIGHT_PT + 41 })} />,
    );

    expect(text).toContain("2 pages");
    expect(text).toContain("Page 2 holds 41pt, about 3 lines.");
  });

  it("names the entry a break pushed and the hole it left", () => {
    const entry: FlowBlock = {
      top: CONTENT_HEIGHT_PT - 40,
      bottom: CONTENT_HEIGHT_PT + 50,
      keepWithNext: false,
      label: "Senior Engineer",
    };
    const text = readout(
      <PageFit pagination={page({ blocks: [entry], contentHeight: entry.bottom })} />,
    );

    expect(text).toContain("“Senior Engineer” moved here whole");
    expect(text).toContain("leaving 40pt at the foot of page 1");
  });

  it("attributes nothing to a page that simply ran out of room", () => {
    const text = readout(
      <PageFit pagination={page({ blocks: [], contentHeight: CONTENT_HEIGHT_PT + 41 })} />,
    );

    expect(text).not.toContain("moved here");
  });

  it("draws the gauge from the last page's own fill", () => {
    const markup = renderToStaticMarkup(
      <PageFit pagination={page({ blocks: [], contentHeight: CONTENT_HEIGHT_PT / 4 })} />,
    );

    expect(markup).toContain("width:25%");
  });
});
