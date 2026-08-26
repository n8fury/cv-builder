"use client";

/**
 * Scopes one editor store to one open variant (SPEC §7).
 *
 * A module-level store would survive navigation between variants and hand the
 * next one the previous one's draft; a store created per mount and shared
 * through context is torn down with the route. The lazy initializer keeps the
 * factory from running on every render.
 */
import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";

import { createEditorStore, type EditorSnapshot, type EditorState, type EditorStore } from "./store";

const EditorStoreContext = createContext<EditorStore | null>(null);

export function EditorStoreProvider({
  snapshot,
  children,
}: {
  snapshot: EditorSnapshot;
  children: ReactNode;
}) {
  const [store] = useState<EditorStore>(() => createEditorStore(snapshot));
  return <EditorStoreContext.Provider value={store}>{children}</EditorStoreContext.Provider>;
}

export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStore(useEditorStore(), selector);
}

/**
 * The store itself, for the rare reader that wants to *watch* it rather than
 * render from it — the crash copy subscribes to every draft change and writes
 * it away, which must not put the whole editor through a render.
 */
export function useEditorStore(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error("useEditor must be used inside <EditorStoreProvider>");
  return store;
}
