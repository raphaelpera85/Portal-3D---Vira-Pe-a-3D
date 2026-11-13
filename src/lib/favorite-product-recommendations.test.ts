import { describe, expect, it } from "vitest";
import type { Product } from "./products";
import { getFavoriteProductRecommendations } from "./favorite-product-recommendations";

const product = (id: string, category: string, tags: string[], demo = false): Product => ({
  id, slug: id, name: id, description: "", category, tags, maker: "Loja", color: "blue", visual: null,
  priceBrl: null, priceMode: "quote", fulfillmentMode: "quote", stockQuantity: null, preparationDays: null,
  priceLabel: "Sob orçamento", media: [], videoUrl: null, storeId: demo ? null : "store-1", storeSlug: "loja", demo,
});

describe("favorite-based product recommendations", () => {
  it("ranks published products by favorite categories and tags without repeating favorites", () => {
    const favorites = [product("saved", "Chaveiros", ["gato", "presente"]), product("glasses", "Suporte para Óculos", ["óculos", "gato"])];
    const candidates = [
      product("unrelated", "Decoração", ["vaso"]),
      product("same-category", "Chaveiros", ["borboleta"]),
      product("same-category-tags", "Chaveiros", ["gato", "presente"]),
      product("shared-tags", "Miniaturas", ["gato", "oculos"]),
      product("saved", "Chaveiros", ["gato"]),
      product("demo", "Chaveiros", ["gato"], true),
    ];

    expect(getFavoriteProductRecommendations(favorites, candidates).map(({ id }) => id))
      .toEqual(["same-category-tags", "same-category", "shared-tags"]);
  });

  it("returns no suggestions before the buyer saves a favorite", () => {
    expect(getFavoriteProductRecommendations([], [product("candidate", "Chaveiros", ["gato"])]))
      .toEqual([]);
  });
});
