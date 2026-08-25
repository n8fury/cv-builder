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
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { ResumeDocument } from "@/components/resume/ResumeDocument";
import { PaginationReporter } from "@/components/resume/pagination-context";
import { resolveVariant } from "@/lib/data/resolve";
import { libraryPath } from "@/lib/routes";
import type { Pagination } from "@/lib/render/pagination";

import { EditorStoreProvider, useEditor } from "./EditorStoreProvider";
import { FontWarning } from "./FontWarning";
import { PageCount } from "./PageCount";
import { PreviewFrame } from "./PreviewFrame";
import { SaveControls } from "./SaveControls";
import { VariantForm } from "./VariantForm";
import { isDirty, type EditorSnapshot } from "./store";

function Preview({
  css,
  onPaginate,
  onFontProblems,
}: {
  css: string;
  onPaginate: (pagination: Pagination) => void;
  onFontProblems: (problems: string[]) => void;
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

  // Context reaches the resume through the portal, so the page-count reading
  // crosses out of the iframe without either side knowing about the other.
  return (
    <PaginationReporter value={onPaginate}>
      <PreviewFrame css={css} onFontProblems={onFontProblems}>
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
  const [pagination, setPagination] = useState<Pagination>({ breaks: [], pageCount: 1 });
  const [fontProblems, setFontProblems] = useState<string[]>([]);
  // Stable: the preview re-runs its reporting effect whenever this changes.
  const onPaginate = useCallback((next: Pagination) => setPagination(next), []);
  const onFontProblems = useCallback((next: string[]) => setFontProblems(next), []);

  return (
    // Keyed by the open document: Save As navigates to a different variant
    // under the same route, and React would otherwise reuse the component —
    // handing the fork the parent's store, draft and all.
    <EditorStoreProvider
      key={`${snapshot.profileId}/${snapshot.variantId}`}
      snapshot={snapshot}
    >
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <header className="mb-4 flex items-baseline gap-3">
          <h1 className="text-lg font-semibold text-gray-900">
            <span className="font-mono">{snapshot.profileId}</span>
            <span className="text-gray-400"> / </span>
            <span className="font-mono">{snapshot.variantId}</span>
          </h1>
          <Link className="text-sm text-gray-600 underline hover:text-gray-900" href="/">
            Dashboard
          </Link>
          {/* Carries the open variant, so the manager's Fork acts on this one
              — §11.4's "the currently open variant", made literal. */}
          <Link
            className="text-sm text-gray-600 underline hover:text-gray-900"
            href={`${libraryPath(snapshot.profileId)}?variant=${encodeURIComponent(snapshot.variantId)}`}
          >
            Library
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <PageCount pagination={pagination} />
            <Status />
            <SaveControls />
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
          <div className="rounded-lg border border-gray-200 p-4">
            <VariantForm />
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <FontWarning problems={fontProblems} />
            <Preview css={css} onPaginate={onPaginate} onFontProblems={onFontProblems} />
          </div>
        </div>
      </div>
    </EditorStoreProvider>
  );
}
