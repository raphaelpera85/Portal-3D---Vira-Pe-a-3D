import { describe, expect, it } from "vitest";
import { readPrintProfileColors } from "./print-profile-colors";

describe("readPrintProfileColors", () => {
  it("keeps only unique, valid color rows", () => {
    expect(readPrintProfileColors([
      { color: "#aa00ff", grams: 12 }, { color: "#AA00FF", grams: 3 }, null,
      { color: "url(javascript:alert(1))", grams: 1 }, { color: "#0099ff", grams: Number.NaN },
    ])).toEqual([{ color: "#AA00FF", grams: 12, lengthMeters: null }]);
  });

  it("preserves validated lengths and accepts length-only rows", () => {
    expect(readPrintProfileColors([
      { color: "#aa00ff", grams: 12, lengthMeters: 4.8 }, { color: "#0099ff", grams: null, lengthMeters: 1.2 },
      { color: "#123456", grams: -1, lengthMeters: 2 }, { color: "#654321", grams: null, lengthMeters: null },
    ])).toEqual([
      { color: "#AA00FF", grams: 12, lengthMeters: 4.8 }, { color: "#0099FF", grams: null, lengthMeters: 1.2 },
    ]);
  });

  it("ignores non-array values", () => {
    expect(readPrintProfileColors({ color: "#AA00FF", grams: 4 })).toEqual([]);
  });
});
