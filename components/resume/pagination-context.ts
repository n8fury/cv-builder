"use client";

/**
 * How the page count leaves the document (SPEC §11.5).
 *
 * The guides are measured inside `.resume-page`, but §11.5's live indicator
 * belongs to the editor's chrome, outside it — and in the editor the resume
 * lives in an iframe, so there is no DOM path between the two. They are one
 * React tree though (the preview is portalled), so a context carries the
 * reading out.
 *
 * The default is a no-op: the print route renders the same document and has
 * no indicator to feed.
 */
import { createContext, useContext } from "react";

import type { Pagination } from "@/lib/render/pagination";

export type PaginationListener = (pagination: Pagination) => void;

const noop: PaginationListener = () => {};

const PaginationContext = createContext<PaginationListener>(noop);

export const PaginationReporter = PaginationContext.Provider;

export function usePaginationListener(): PaginationListener {
  return useContext(PaginationContext);
}
