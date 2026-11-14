import { describe, expect, it } from "vitest";
import { groupCartItemsByStore } from "./cart";

describe("groupCartItemsByStore", () => {
  it("keeps each seller's items together and calculates line totals", () => {
    expect(groupCartItemsByStore([
      { id: "item-1", store_id: "a", store_name: "Loja A", product_id: "1", product_name: "Peça 1", quantity: 2, price_brl: 10 },
      { id: "item-2", store_id: "b", store_name: "Loja B", product_id: "2", product_name: "Peça 2", quantity: 1, price_brl: 7.5 },
      { id: "item-3", store_id: "a", store_name: "Loja A", product_id: "3", product_name: "Peça 3", quantity: 3, price_brl: 4 },
    ])).toEqual([
      { storeId: "a", storeName: "Loja A", items: [
        { id: "item-1", productId: "1", productName: "Peça 1", quantity: 2, priceBrl: 10, totalBrl: 20 },
        { id: "item-3", productId: "3", productName: "Peça 3", quantity: 3, priceBrl: 4, totalBrl: 12 },
      ], totalBrl: 32 },
      { storeId: "b", storeName: "Loja B", items: [
        { id: "item-2", productId: "2", productName: "Peça 2", quantity: 1, priceBrl: 7.5, totalBrl: 7.5 },
      ], totalBrl: 7.5 },
    ]);
  });

  it("preserves distinct cart item IDs for variants of the same product", () => {
    const grouped = groupCartItemsByStore([
      { id: "red-variant-row", store_id: "a", store_name: "Loja A", product_id: "1", product_name: "Peça · vermelha", quantity: 1, price_brl: 10 },
      { id: "blue-variant-row", store_id: "a", store_name: "Loja A", product_id: "1", product_name: "Peça · azul", quantity: 1, price_brl: 12 },
    ]);

    expect(grouped[0].items.map((item) => item.id)).toEqual(["red-variant-row", "blue-variant-row"]);
  });
});
