import { describe, expect, it } from "vitest";
import { filterProducts, getCatalogEmptyState } from "./catalog";

describe("getCatalogEmptyState", () => {
  it("explains when the connected marketplace has no published products", () => {
    expect(getCatalogEmptyState({ source: "database", unavailable: false, query: "", category: "" })).toBe("no-published-products");
  });

  it("distinguishes filtered results and catalog errors", () => {
    expect(getCatalogEmptyState({ source: "database", unavailable: false, query: "dragão", category: "" })).toBe("no-results");
    expect(getCatalogEmptyState({ source: "database", unavailable: false, query: "", category: "invalid-category" })).toBe("no-results");
    expect(getCatalogEmptyState({ source: "local", unavailable: false, query: "", category: "" })).toBe("no-results");
    expect(getCatalogEmptyState({ source: "database", unavailable: true, query: "", category: "" })).toBe("unavailable");
  });
});

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
