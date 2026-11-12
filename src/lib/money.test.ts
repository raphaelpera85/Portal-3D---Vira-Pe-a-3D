import { describe, expect, it } from "vitest";
import { formatBrlTotal } from "./money";

describe("BRL order totals", () => {
  it("multiplies exact cent values without floating point drift", () => {
    expect(formatBrlTotal("19.99", 3)).toContain("59,97");
  });
});
