import { describe, expect, it } from "vitest";
import { filterProducts } from "./catalog";

describe("filterProducts", () => {
  it("matches product text and category together", () => {
    const products = [
      { name: "Miniatura de dragão", category: "Miniaturas", tags: ["RPG"] },
      { name: "Vaso modular", category: "Decoração", tags: ["casa"] },
      { name: "Torre de dados", category: "RPG", tags: ["Miniaturas"] },
    ];

    expect(filterProducts(products, "dragão", "Miniaturas").map(({ name }) => name)).toEqual([
      "Miniatura de dragão",
    ]);
    expect(filterProducts(products, "dragão", "RPG")).toEqual([]);
  });
});
