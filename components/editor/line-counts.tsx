"use client";

/**
 * The preview's line counts, delivered to the fields that caused them
 * (SPEC §7, §16.3).
 *
 * `components/resume/line-counts.ts` measures each bullet where it is actually
 * laid out; this is the other end of that wire. It is a store rather than
 * state for the reason `preview-link` is a set of class toggles: the counts
 * change on every keystroke, and holding them in state above the two columns
 * would re-render the whole editor — the preview included — to update a
 * four-character label. Each field subscribes to its own id instead, so a
 * keystroke in one bullet re-renders that bullet's readout and nothing else.
 *
 * Outside the editor there is no provider and every field reads `null`, which
 * is also what a bullet the preview is not showing reads: an excluded bullet
 * has no line count because it has no lines.
 */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { LineCountReporter, type BulletLines } from "@/components/resume/line-counts";

export interface LineCountStore {
  /** Called by the preview with a fresh reading of every bullet. */
  publish(lines: BulletLines): void;
  subscribe(id: string, notify: () => void): () => void;
  get(id: string): number | null;
}

export function createLineCountStore(): LineCountStore {
  let lines: BulletLines = new Map();
  const listeners = new Map<string, Set<() => void>>();

  return {
    publish(next) {
      const previous = lines;
      lines = next;
      // Only the fields whose own figure moved: a reflow that adds a line to
      // one bullet must not re-render the other forty.
      for (const [id, set] of listeners) {
        if (previous.get(id) === next.get(id)) continue;
        for (const notify of set) notify();
      }
    },

    subscribe(id, notify) {
      const set = listeners.get(id) ?? new Set();
      set.add(notify);
      listeners.set(id, set);
      return () => {
        set.delete(notify);
        if (set.size === 0) listeners.delete(id);
      };
    },

    get(id) {
      return lines.get(id) ?? null;
    },
  };
}

const LineCountContext = createContext<LineCountStore | null>(null);

export function LineCountProvider({ children }: { children: ReactNode }) {
  // Created once and never replaced, like the preview link: the preview holds
  // its `publish` in an effect dependency, and a new store each render would
  // restart the measurement it feeds.
  const [store] = useState(createLineCountStore);

  return (
    <LineCountContext.Provider value={store}>
      <LineCountReporter value={store.publish}>{children}</LineCountReporter>
    </LineCountContext.Provider>
  );
}

/**
 * How many lines this bullet takes in the CV, or `null` when there is no
 * answer — no preview at all (the library manager), or a bullet this variant
 * leaves out.
 */
export function useLineCount(id: string): number | null {
  const store = useContext(LineCountContext);

  const subscribe = useCallback(
    (notify: () => void) => (store ? store.subscribe(id, notify) : () => {}),
    [store, id],
  );

  return useSyncExternalStore(
    subscribe,
    () => store?.get(id) ?? null,
    // Server-rendered, where nothing has been laid out and measured yet.
    () => null,
  );
}
