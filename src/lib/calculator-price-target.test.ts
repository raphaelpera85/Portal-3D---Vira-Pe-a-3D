import { describe, expect, it } from "vitest";
import { getCalculatorProductPrefill } from "./calculator-price-target";

const products = [
  { id: "physical", canApplyPrice: true, variants: [{ id: "red" }, { id: "blue" }] },
  { id: "plain", canApplyPrice: true, variants: [] },
  { id: "quote", canApplyPrice: false, variants: [] },
];

describe("calculator product prefill", () => {
  it("links calculations to the store product without choosing a variant arbitrarily", () => {
    expect(getCalculatorProductPrefill(products, "physical")).toEqual({ productId: "physical", priceTargetId: "" });
    expect(getCalculatorProductPrefill(products, "plain")).toEqual({ productId: "plain", priceTargetId: "plain" });
  });

  it("ignores unknown, non-priceable, and repeated query values", () => {
    expect(getCalculatorProductPrefill(products, "other-store-product")).toBeNull();
    expect(getCalculatorProductPrefill(products, "quote")).toBeNull();
    expect(getCalculatorProductPrefill(products, ["plain", "physical"])).toBeNull();
  });
});
