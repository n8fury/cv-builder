"use client";

/**
 * The two-column editor shell (SPEC §7).
 *
 * Form on the left, the live page on the right. The preview is not a picture
 * of the variant — it is `ResumeDocument`, the same component the print route
 * renders, fed from the draft in the store, so what the column shows is what
 * `/api/generate-pdf` would produce. Every keystroke re-resolves the draft and
 * re-renders that tree in place; nothing here launches Chromium, which §7
 * reserves for the explicit export action.
 */
import { useCallback, useMemo, useState } from "react";

import { PendingLink } from "@/app/(dashboard)/PendingLink";
import { EMPTY_PAGINATION } from "@/components/resume/PagedDocument";
import { ResumeDocument } from "@/components/resume/ResumeDocument";
import { PaginationReporter } from "@/components/resume/pagination-context";
import { resolveVariant } from "@/lib/data/resolve";
import { libraryPath } from "@/lib/routes";
import type { Pagination } from "@/lib/render/pagination";

import { DraftRecovery } from "./DraftRecovery";
import { EditorStoreProvider, useEditor } from "./EditorStoreProvider";
import { FontWarning } from "./FontWarning";
import { LineCountProvider } from "./line-counts";
import { PageFit } from "./PageFit";
import { PreviewControls } from "./PreviewControls";
import { PreviewLinkProvider } from "./preview-link";
import { PreviewFrame } from "./PreviewFrame";
import { SaveControls } from "./SaveControls";
import { UndoRedo } from "./UndoRedo";
import { VariantForm } from "./VariantForm";
import { clampPage, type ZoomMode } from "./zoom";
import { isDirty, type EditorSnapshot } from "./store";

function Preview({
  css,
  onPaginate,
  onFontProblems,
  zoom,
  page,
  onScale,
}: {
  css: string;
  onPaginate: (pagination: Pagination) => void;
  onFontProblems: (problems: string[]) => void;
  zoom: ZoomMode;
  page: number | null;
  onScale: (scale: number) => void;
}) {
  const draft = useEditor((state) => state.draft);

  // A draft can reference a library item that is gone — a hand-edited or
  // n8n-written file, or a library change under an open editor. §13: say so
  // in place of the page rather than blanking the column.
  const resolved = useMemo(() => {
    try {
      return {
        model: resolveVariant(draft.library, draft.variant),
        error: null as string | null,
      };
    } catch (error) {
      return { model: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [draft]);

  if (resolved.error) {
    return (
      <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        Preview unavailable — {resolved.error}
      </p>
    );
  }

  // Context reaches the resume through the portal, so the pagination reading
  // crosses out of the iframe without either side knowing about the other.
  return (
    <PaginationReporter value={onPaginate}>
      <PreviewFrame
        css={css}
        onFontProblems={onFontProblems}
        onScale={onScale}
        page={page}
        zoom={zoom}
      >
        <ResumeDocument model={resolved.model!} />
      </PreviewFrame>
    </PaginationReporter>
  );
}

function Status() {
  const dirty = useEditor(isDirty);
  const revert = useEditor((state) => state.revert);

  if (!dirty) return <span className="text-xs text-gray-500">Saved</span>;
  return (
    <span className="flex items-baseline gap-2 text-xs text-amber-700">
      Unsaved changes
      <button
        type="button"
        className="rounded border border-gray-300 px-2 py-1 font-medium text-gray-700 hover:bg-gray-50"
        onClick={revert}
      >
        Revert
      </button>
    </span>
  );
}

export function EditorShell({ snapshot, css }: { snapshot: EditorSnapshot; css: string }) {
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [fontProblems, setFontProblems] = useState<string[]>([]);
  // How the preview is being looked at, which is nobody's business but this
  // component's: none of the three reaches the store, so none of them can
  // make the variant dirty or end up in the file.
  const [zoom, setZoom] = useState<ZoomMode>("fit-width");
  const [single, setSingle] = useState(false);
  const [wanted, setWanted] = useState(1);
  const [scale, setScale] = useState(1);
  // Stable: the preview re-runs its reporting effect whenever this changes.
  const onPaginate = useCallback((next: Pagination) => setPagination(next), []);
  const onFontProblems = useCallback((next: string[]) => setFontProblems(next), []);
  const onScale = useCallback((next: number) => setScale(next), []);

  // Clamped on the way out rather than on the way in: the stack shrinks under
  // an untouched pager whenever an edit closes the last page, and the sheet to
  // show is a question about the pagination that arrived, not about the last
  // button that was pressed.
  const page = clampPage(wanted, pagination.pageCount);

  return (
    // Keyed by the open document: Save As navigates to a different variant
    // under the same route, and React would otherwise reuse the component —
    // handing the fork the parent's store, draft and all.
    <EditorStoreProvider
      key={`${snapshot.profileId}/${snapshot.variantId}`}
      snapshot={snapshot}
    >
      {/* Both columns, since the link runs both ways: the form points into the
          preview, and a click in the preview comes back out to the form. */}
      <PreviewLinkProvider>
      {/* Both columns again, and for the same reason: the preview measures
          each bullet's line count and the form's fields are what show it. */}
      <LineCountProvider>
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <header className="mb-4 flex items-baseline gap-3">
          <h1 className="text-lg font-semibold text-gray-900">
            <span className="font-mono">{snapshot.profileId}</span>
            <span className="text-gray-400"> / </span>
            <span className="font-mono">{snapshot.variantId}</span>
          </h1>
          <PendingLink className="text-sm text-gray-600 underline hover:text-gray-900" href="/">
            Dashboard
          </PendingLink>
          {/* Carries the open variant, so the manager's Fork acts on this one
              — §11.4's "the currently open variant", made literal. */}
          <PendingLink
            className="text-sm text-gray-600 underline hover:text-gray-900"
            href={`${libraryPath(snapshot.profileId)}?variant=${encodeURIComponent(snapshot.variantId)}`}
          >
            Library
          </PendingLink>
          <div className="ml-auto flex items-center gap-3">
            <UndoRedo />
            <Status />
            <SaveControls />
          </div>
        </header>

        {/* Above both columns: it speaks for the whole document, and its two
            answers change what the form and the preview are showing. */}
        <DraftRecovery />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
          <div className="rounded-lg border border-gray-200 p-4">
            <VariantForm />
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <FontWarning problems={fontProblems} />
            {/* Above the sheets it describes: every figure in it is a reading
                of the same pagination those sheets are windowed with. */}
            <PageFit pagination={pagination} />
            {/* Below the report and above the sheets, because it sits between
                them in meaning too: the report says what the document does,
                this says how much of it is on screen. */}
            <PreviewControls
              onPage={setWanted}
              onSingle={setSingle}
              onZoom={setZoom}
              page={page}
              pageCount={pagination.pageCount}
              scale={scale}
              single={single}
              zoom={zoom}
            />
            <Preview
              css={css}
              onFontProblems={onFontProblems}
              onPaginate={onPaginate}
              onScale={onScale}
              page={single && pagination.pageCount > 1 ? page : null}
              zoom={zoom}
            />
          </div>
        </div>
      </div>
      </LineCountProvider>
      </PreviewLinkProvider>
    </EditorStoreProvider>
  );
}
