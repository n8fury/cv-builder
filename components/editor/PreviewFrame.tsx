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
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  FALLBACK_FONTS_CLASS,
  findFontProblems,
  requiredFaceDescriptors,
} from "@/lib/render/font-check";

/** 612pt at 96dpi — the page's own width, before any fit-to-column scaling. */
const PAGE_WIDTH_PX = 816;

export function PreviewFrame({
  css,
  children,
  onFontProblems,
}: {
  css: string;
  children: ReactNode;
  /** Called once the faces have resolved, with one message per unusable face. */
  onFontProblems?: (problems: string[]) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(1056);
  const [scale, setScale] = useState(1);

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

  // The iframe cannot size itself: track the document's own height so the page
  // scrolls in the editor column instead of inside a fixed-height box.
  useEffect(() => {
    if (!body) return;
    // ResizeObserver fires once on observe(), which sets the initial height.
    const observer = new ResizeObserver(() => setHeight(body.scrollHeight));
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

  // Shrink to fit a narrow column, never enlarge — a preview shown above 100%
  // would misrepresent the printed page.
  useEffect(() => {
    const el = column.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setScale(Math.min(1, el.clientWidth / PAGE_WIDTH_PX)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={column} className="w-full">
      <div style={{ height: height * scale }}>
        <iframe
          ref={frame}
          title="Resume preview"
          className="block border-0"
          style={{
            width: PAGE_WIDTH_PX,
            height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
      {body ? createPortal(children, body) : null}
    </div>
  );
}
