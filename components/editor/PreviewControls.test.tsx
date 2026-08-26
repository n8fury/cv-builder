/**
 * The preview controls as they are drawn (SPEC §7).
 *
 * `zoom.test.ts` settles what each size resolves to; this settles that the
 * control says which one is on, prints the figure it resolved to, and offers a
 * pager only where there is a stack to page through.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PreviewControls } from "./PreviewControls";
import type { ZoomMode } from "./zoom";

const noop = () => {};

function draw(over: Partial<Parameters<typeof PreviewControls>[0]> = {}): string {
  return renderToStaticMarkup(
    <PreviewControls
      onPage={noop}
      onSingle={noop}
      onZoom={noop}
      page={1}
      pageCount={1}
      scale={1}
      single={false}
      zoom="fit-width"
      {...over}
    />,
  );
}

/** The one button carrying `attribute`, or `null` if it is not drawn. */
function button(html: string, attribute: string): string | null {
  const at = html.indexOf(attribute);
  if (at === -1) return null;
  const open = html.lastIndexOf("<", at);
  return html.slice(open, html.indexOf(">", at) + 1);
}

/**
 * Whether that button is actually disabled — the attribute, not the word,
 * which also appears in the `disabled:` class names beside it.
 */
function isDisabled(tag: string | null): boolean {
  return tag !== null && / disabled=""/.test(tag);
}

describe("PreviewControls", () => {
  it("offers all three sizes, with the current one pressed", () => {
    const html = draw({ zoom: "fit-page" });

    for (const mode of ["fit-width", "fit-page", "actual"] as ZoomMode[]) {
      expect(button(html, `data-zoom="${mode}"`)).not.toBeNull();
    }
    expect(button(html, 'data-zoom="fit-page"')).toContain('aria-pressed="true"');
    expect(button(html, 'data-zoom="fit-width"')).toContain('aria-pressed="false"');
    expect(button(html, 'data-zoom="actual"')).toContain('aria-pressed="false"');
  });

  it("prints the figure the mode resolved to, not just the mode", () => {
    const html = draw({ zoom: "fit-width", scale: 0.6237 });
    expect(html).toContain('data-preview-scale="62"');
    expect(html).toContain("62%");
  });

  it("offers no pager for a document that is one page", () => {
    const html = draw({ pageCount: 1, single: true });
    expect(button(html, "data-single-page")).toBeNull();
    expect(button(html, "data-page-next")).toBeNull();
  });

  it("offers the toggle for a stack, and the pager only once it is on", () => {
    const off = draw({ pageCount: 3 });
    expect(button(off, "data-single-page")).toContain('aria-pressed="false"');
    expect(button(off, "data-page-next")).toBeNull();

    const on = draw({ pageCount: 3, single: true, page: 2 });
    expect(button(on, "data-single-page")).toContain('aria-pressed="true"');
    expect(on).toContain('data-page-showing="2"');
    expect(on).toContain("Page 2 of 3");
  });

  it("stops the pager at both ends of the stack", () => {
    const first = draw({ pageCount: 3, single: true, page: 1 });
    expect(isDisabled(button(first, "data-page-prev"))).toBe(true);
    expect(isDisabled(button(first, "data-page-next"))).toBe(false);

    const last = draw({ pageCount: 3, single: true, page: 3 });
    expect(isDisabled(button(last, "data-page-prev"))).toBe(false);
    expect(isDisabled(button(last, "data-page-next"))).toBe(true);
  });
});
