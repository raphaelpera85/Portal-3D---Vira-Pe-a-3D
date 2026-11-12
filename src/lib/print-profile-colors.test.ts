import { describe, expect, it } from "vitest";
import { readPrintProfileColors } from "./print-profile-colors";

describe("readPrintProfileColors", () => {
  it("keeps only unique, valid color rows", () => {
    expect(readPrintProfileColors([
      { color: "#aa00ff", grams: 12 }, { color: "#AA00FF", grams: 3 }, null,
      { color: "url(javascript:alert(1))", grams: 1 }, { color: "#0099ff", grams: Number.NaN },
    ])).toEqual([{ color: "#AA00FF", grams: 12 }]);
  });

  it("ignores non-array values", () => {
    expect(readPrintProfileColors({ color: "#AA00FF", grams: 4 })).toEqual([]);
  });
});
