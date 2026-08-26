"use client";

/**
 * The preview surface (SPEC §7, §8).
 *
 * The resume is portalled into an iframe rather than rendered inline. §7 keeps
 * Tailwind away from components/resume/** and §8 has the print route on its
 * own root layout for the same reason: preflight would reset margins and the
 * font stack out from under a document whose fidelity is measured in tenths of
 * a point. An iframe is the only way to have editor chrome and an untouched
 * resume document in one page — and the resume subtree stays a live part of
 * this React tree, so store changes reach it without a reload (§11.1).
 *
 * The document is written once with `document.write`; React then owns the body
 * through the portal. Relative font URLs resolve against this page's origin,
 * so /fonts/*.woff2 loads exactly as it does on the print route.
 *
 * Size and paging are both applied out here, to the frame, and never inside
 * it. The scale is a CSS transform on the iframe box; showing one sheet at a
 * time is this box clipped to one sheet's height with the frame slid up by
 * that sheet's offset. Neither touches the document, which is the point: the
 * thing being looked at has to stay the thing that prints, so `resume.css`,
 * `PagedDocument` and the measurement all carry on at 1:1 whatever the preview
 * happens to be drawn at.
 *
 * That also settles a trap. `PagedDocument` measures page one's flow and
 * derives the whole stack from it, so hiding sheets with `display: none` — the
 * obvious way to page — would take page one's own geometry away and collapse
 * the stack the pager was walking. Sliding a window over sheets that all stay
 * laid out cannot.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { usePreviewLink } from "./preview-link";
import { PAGE_WIDTH_PX, previewViewportHeight, zoomScale, type ZoomMode } from "./zoom";

import {
  FALLBACK_FONTS_CLASS,
  findFontProblems,
  requiredFaceDescriptors,
} from "@/lib/render/font-check";

/** Where one sheet sits inside the document, in the iframe's own pixels. */
interface Sheet {
  top: number;
  height: number;
}

/**
 * The sheets as the iframe has actually laid them out.
 *
 * Read rather than computed. The gap between sheets and the padding above the
 * first are `resume.css`'s business — screen chrome it is free to change —
 * and a pager that had those two numbers written into it would slide the
 * window to the wrong place the day either moved.
 */
function readSheets(body: HTMLElement): Sheet[] {
  return [...body.querySelectorAll<HTMLElement>(".resume-page")].map((page) => ({
    top: page.offsetTop,
    height: page.offsetHeight,
  }));
}

function sameSheets(a: Sheet[], b: Sheet[]): boolean {
  return (
    a.length === b.length &&
    a.every((sheet, index) => sheet.top === b[index].top && sheet.height === b[index].height)
  );
}

export function PreviewFrame({
  css,
  children,
  onFontProblems,
  zoom = "fit-width",
  page = null,
  onScale,
}: {
  css: string;
  children: ReactNode;
  /** Called once the faces have resolved, with one message per unusable face. */
  onFontProblems?: (problems: string[]) => void;
  zoom?: ZoomMode;
  /** The 1-based sheet to show alone, or `null` for the whole stack. */
  page?: number | null;
  /** The scale `zoom` resolved to here, for the control that set it. */
  onScale?: (scale: number) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(1056);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const link = usePreviewLink();

  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body></body></html>`,
    );
    doc.close();
    setBody(doc.body);
  }, [css]);

  // §7's second direction: the document becomes clickable, and stays that way
  // only while this frame owns it. Re-run on every rewrite — `document.write`
  // replaces the body, and with it every listener anything hung off the old one.
  useEffect(() => link.attach(body), [body, link]);

  // The iframe cannot size itself: track the document's own height so the page
  // scrolls in the editor column instead of inside a fixed-height box. The
  // sheet offsets are read in the same pass, because a sheet appearing or
  // closing changes that height — this is exactly when they move.
  useEffect(() => {
    if (!body) return;
    // ResizeObserver fires once on observe(), which sets the initial height.
    const observer = new ResizeObserver(() => {
      setHeight(body.scrollHeight);
      const next = readSheets(body);
      setSheets((current) => (sameSheets(current, next) ? current : next));
    });
    observer.observe(body);
    return () => observer.disconnect();
  }, [body]);

  // §13, §15.14: a face that fails to load costs the preview its typography
  // and nothing else. The same check the export hard-fails on runs here, and
  // the result only downgrades the type and raises a warning — the editor
  // stays usable, and nothing waits on this.
  useEffect(() => {
    if (!body) return;
    const doc = body.ownerDocument;
    let live = true;
    void (async () => {
      // Settles either way — a missing woff2 resolves it just as a loaded one
      // does, which is exactly why the check below still has to run.
      await doc.fonts.ready;
      const problems = await findFontProblems(requiredFaceDescriptors(), doc);
      if (!live) return;
      // Ends `font-display: block`'s three-second wait for a face that is
      // never coming, rather than holding a blank page for it.
      doc.documentElement.classList.toggle(FALLBACK_FONTS_CLASS, problems.length > 0);
      onFontProblems?.(problems);
    })();
    return () => {
      live = false;
    };
  }, [body, onFontProblems]);

  // The box the fits are fits *to*: the column's width, and the height the
  // window leaves below the preview's top edge. Both are re-read when the
  // column resizes and when the window does — the second being a change no
  // observer on this element would ever see.
  useEffect(() => {
    const el = column.current;
    if (!el) return;
    const read = () =>
      setViewport((current) => {
        const width = el.clientWidth;
        const top = el.getBoundingClientRect().top + window.scrollY;
        const height = previewViewportHeight(top, window.innerHeight);
        return current.width === width && current.height === height
          ? current
          : { width, height };
      });
    const observer = new ResizeObserver(read);
    observer.observe(el);
    window.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, []);

  const scale = zoomScale(zoom, viewport);
  useEffect(() => onScale?.(scale), [onScale, scale]);

  // `undefined` until the sheets have been read — every render before the
  // first measurement lands, where the whole stack is the right thing to show.
  const sheet = page === null ? undefined : sheets[page - 1];
  const boxHeight = (sheet ? sheet.height : height) * scale;

  return (
    // Wider than its column at 100%, and it says so by scrolling rather than
    // by cutting the right margin off the page.
    <div ref={column} className="w-full overflow-x-auto">
      <div
        style={{
          height: boxHeight,
          width: PAGE_WIDTH_PX * scale,
          // Set only while one sheet is being shown: this clip is what hides
          // the others, and the stack itself must not be clipped.
          overflow: sheet ? "hidden" : undefined,
        }}
      >
        <iframe
          ref={frame}
          title="Resume preview"
          className="block border-0"
          style={{
            width: PAGE_WIDTH_PX,
            height,
            // Read right to left: slide the stack up by the sheet's own offset
            // first, then scale the result, so the shift scales with it.
            transform: `scale(${scale})${sheet ? ` translateY(${-sheet.top}px)` : ""}`,
            transformOrigin: "top left",
          }}
        />
      </div>
      {body ? createPortal(children, body) : null}
    </div>
  );
}
