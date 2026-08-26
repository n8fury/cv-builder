import { describe, expect, it } from "vitest";

import {
  COALESCE_MS,
  EMPTY_HISTORY,
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  recorded,
  redone,
  undone,
  type History,
} from "./history";

import type { EditorDocument } from "./store";

/** Only identity matters here, so a document is stood in for by its label. */
const doc = (label: string) => ({ variant: { label }, library: {} }) as unknown as EditorDocument;
const labels = (history: History, side: "past" | "future") =>
  history[side].map((entry) => (entry.document.variant as { label: string }).label);

describe("editor history", () => {
  it("starts with nothing to undo or redo", () => {
    expect(canUndo(EMPTY_HISTORY)).toBe(false);
    expect(canRedo(EMPTY_HISTORY)).toBe(false);
    expect(undone(EMPTY_HISTORY, doc("a"))).toBeNull();
    expect(redone(EMPTY_HISTORY, doc("a"))).toBeNull();
  });

  it("walks back and forward through the documents in order", () => {
    let history = EMPTY_HISTORY;
    history = recorded(history, doc("a"), null, 0);
    history = recorded(history, doc("b"), null, 1);
    history = recorded(history, doc("c"), null, 2);

    let at = doc("d");
    const back: string[] = [];
    for (let step = undone(history, at); step; step = undone(history, at)) {
      history = step.history;
      at = step.document;
      back.push((at.variant as { label: string }).label);
    }
    expect(back).toEqual(["c", "b", "a"]);

    const forward: string[] = [];
    for (let step = redone(history, at); step; step = redone(history, at)) {
      history = step.history;
      at = step.document;
      forward.push((at.variant as { label: string }).label);
    }
    expect(forward).toEqual(["b", "c", "d"]);
  });

  it("coalesces consecutive edits to one field inside the window", () => {
    let history = recorded(EMPTY_HISTORY, doc("a"), "label", 0);
    history = recorded(history, doc("b"), "label", 100);
    history = recorded(history, doc("c"), "label", 200);

    // One step, and it goes back to where the typing started.
    expect(labels(history, "past")).toEqual(["a"]);
  });

  it("opens a new step once the window has passed", () => {
    let history = recorded(EMPTY_HISTORY, doc("a"), "label", 0);
    history = recorded(history, doc("b"), "label", COALESCE_MS + 1);

    expect(labels(history, "past")).toEqual(["a", "b"]);
  });

  it("keeps edits to different fields apart, however fast they arrive", () => {
    let history = recorded(EMPTY_HISTORY, doc("a"), "label", 0);
    history = recorded(history, doc("b"), "tag", 0);

    expect(labels(history, "past")).toEqual(["a", "b"]);
  });

  it("never coalesces an untagged change", () => {
    let history = recorded(EMPTY_HISTORY, doc("a"), null, 0);
    history = recorded(history, doc("b"), null, 0);

    // Two toggles in the same millisecond are still two steps.
    expect(labels(history, "past")).toEqual(["a", "b"]);
  });

  it("drops the redo stack as soon as the document takes a different turn", () => {
    let history = recorded(EMPTY_HISTORY, doc("a"), null, 0);
    const step = undone(history, doc("b"))!;
    expect(labels(step.history, "future")).toEqual(["b"]);

    history = recorded(step.history, doc("a"), null, 1);
    expect(canRedo(history)).toBe(false);
  });

  it("caps the stack, dropping the oldest steps first", () => {
    let history = EMPTY_HISTORY;
    for (let step = 0; step < HISTORY_LIMIT + 5; step += 1) {
      history = recorded(history, doc(`step-${step}`), null, step * (COALESCE_MS + 1));
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(labels(history, "past")[0]).toBe("step-5");
  });
});
