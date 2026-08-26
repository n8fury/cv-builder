/**
 * Bullet text as the two routes render it (SPEC §7, §16.3).
 *
 * `markup.test.ts` settles what text typed into the page is stored as; this
 * settles which of the two blocks gets drawn — and, just as importantly, that
 * the editable one is drawn *empty*, because its contents are the browser's
 * to hold while someone is typing into them and React never writes them.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ResumeBullets } from "./ResumeBullets";
import { BulletText, EDITABLE_ATTRIBUTE, TextEditProvider, type TextWriter } from "./editable";

const write: TextWriter = vi.fn();

const bullets = [{ id: "exp-acme-b1", text: "Built *the* platform." }];
const source = { owner: "experience", entryId: "exp-acme" } as const;

function draw(node: React.ReactNode, editing: boolean): string {
  return renderToStaticMarkup(
    editing ? <TextEditProvider value={write}>{node}</TextEditProvider> : node,
  );
}

describe("BulletText", () => {
  // The print route renders the same components with no writer in scope, so
  // this is what `/render` and the harness see — unchanged by any of this.
  it("renders the printed markup where nothing is listening", () => {
    const html = draw(<BulletText id="b1" source={source} text="Built *the* platform." />, false);

    expect(html).toBe('<span>Built </span><em class="resume-italic">the</em><span> platform.</span>');
    expect(html).not.toMatch(/contenteditable/i);
  });

  it("renders the printed markup for text that is not a library bullet", () => {
    // No `source`: Education's description renders as a bullet but is a field
    // of its entry (§16.4), so there is nothing a keystroke could write to.
    const html = draw(<BulletText id="edu-buet-description" text="Graduated." />, true);

    expect(html).toBe("<span>Graduated.</span>");
    expect(html).not.toMatch(/contenteditable/i);
  });

  it("hands the block to the browser, and puts nothing of its own in it", () => {
    const html = draw(<BulletText id="b1" source={source} text="Built *the* platform." />, true);

    expect(html).toMatch(/contenteditable="true"/i);
    expect(html).toContain(`${EDITABLE_ATTRIBUTE}="b1"`);
    // Empty: the text is written into the DOM imperatively, which is what
    // keeps React from moving the caret on the keystroke that caused it.
    expect(html).not.toContain("platform");
  });
});

describe("ResumeBullets", () => {
  it("marks an editable bullet with the id the store writes under", () => {
    const html = draw(<ResumeBullets bullets={bullets} source={source} />, true);

    expect(html).toContain('data-bullet="exp-acme-b1"');
    expect(html).toContain(`${EDITABLE_ATTRIBUTE}="exp-acme-b1"`);
  });

  it("leaves a list with no library behind it exactly as it printed", () => {
    const withSource = draw(<ResumeBullets bullets={bullets} />, true);
    const printed = draw(<ResumeBullets bullets={bullets} />, false);

    expect(withSource).toBe(printed);
    expect(printed).toContain("Built ");
    expect(printed).not.toContain("contenteditable");
  });
});
