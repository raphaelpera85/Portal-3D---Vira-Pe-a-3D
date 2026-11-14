import { describe, expect, it } from "vitest";
import { groupRowsByKey } from "./group-rows-by-key";

describe("groupRowsByKey", () => {
  it("keeps every row under its parent key in input order", () => {
    const rows = [
      { parent_id: "order-a", id: "first" },
      { parent_id: "order-b", id: "other" },
      { parent_id: "order-a", id: "second" },
    ];

    expect(groupRowsByKey(rows, (row) => row.parent_id)).toEqual(new Map([
      ["order-a", [rows[0], rows[2]]],
      ["order-b", [rows[1]]],
    ]));
  });

  it("returns an empty map for no rows", () => {
    expect(groupRowsByKey([], (row: { parent_id: string }) => row.parent_id)).toEqual(new Map());
  });
});
