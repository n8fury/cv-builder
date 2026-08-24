import { describe, expect, it } from "vitest";

import { moved, movedById, movedIds, ordered, sectionKeys } from "./ordering";

describe("moved", () => {
  it("drops the item at the target index, dragging the rest along", () => {
    expect(moved(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moved(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("leaves the list alone for a no-op or an out-of-range move", () => {
    const list = ["a", "b", "c"];
    expect(moved(list, 1, 1)).toEqual(list);
    // A drop whose target is gone must do nothing rather than throw or
    // silently append.
    expect(moved(list, -1, 0)).toEqual(list);
    expect(moved(list, 0, 9)).toEqual(list);
  });

  it("never mutates its input", () => {
    const list = ["a", "b", "c"];
    moved(list, 0, 2);
    expect(list).toEqual(["a", "b", "c"]);
  });
});

describe("movedIds / movedById", () => {
  it("moves by the pair of IDs a drop reports", () => {
    expect(movedIds(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(movedById([{ id: "a" }, { id: "b" }], "b", "a")).toEqual([{ id: "b" }, { id: "a" }]);
  });

  it("ignores an ID that is not in the list", () => {
    expect(movedIds(["a", "b"], "z", "a")).toEqual(["a", "b"]);
    expect(movedIds(["a", "b"], "a", "z")).toEqual(["a", "b"]);
  });
});

describe("ordered", () => {
  it("puts included items first in the variant's order, then the rest", () => {
    const all = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(ordered(all, ["c", "a"])).toEqual([{ id: "c" }, { id: "a" }, { id: "b" }]);
  });

  it("skips an included ID the library no longer has", () => {
    expect(ordered([{ id: "a" }], ["gone", "a"])).toEqual([{ id: "a" }]);
  });
});

describe("sectionKeys", () => {
  it("gives repeated section types distinct keys", () => {
    expect(
      sectionKeys([{ type: "custom" }, { type: "experience" }, { type: "custom" }]),
    ).toEqual(["custom#0", "experience#0", "custom#1"]);
  });
});
