import { describe, expect, it } from "vitest";
import { getSelectedProductVariant } from "./product-variant-chooser";

const variants = [
  { id: "blue", options: { Cor: "Azul" }, priceBrl: 29.9, stockQuantity: 4 },
  { id: "red", options: { Cor: "Vermelho" }, priceBrl: 39.9, stockQuantity: 0 },
];

describe("getSelectedProductVariant", () => {
  it("uses the selected variant price and stock after selection changes", () => {
    expect(getSelectedProductVariant(variants, "red")).toMatchObject({ priceBrl: 39.9, stockQuantity: 0 });
  });

  it("falls back to the first variant when the URL has no valid selection", () => {
    expect(getSelectedProductVariant(variants, "missing")).toBe(variants[0]);
  });
});
