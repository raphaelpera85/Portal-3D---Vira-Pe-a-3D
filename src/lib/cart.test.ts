import { describe, expect, it } from "vitest";
import { groupCartItemsByStore } from "./cart";

describe("groupCartItemsByStore", () => {
  it("keeps each seller's items together and calculates line totals", () => {
    expect(groupCartItemsByStore([
      { store_id: "a", store_name: "Loja A", product_id: "1", product_name: "Peça 1", quantity: 2, price_brl: 10 },
      { store_id: "b", store_name: "Loja B", product_id: "2", product_name: "Peça 2", quantity: 1, price_brl: 7.5 },
      { store_id: "a", store_name: "Loja A", product_id: "3", product_name: "Peça 3", quantity: 3, price_brl: 4 },
    ])).toEqual([
      { storeId: "a", storeName: "Loja A", items: [
        { productId: "1", productName: "Peça 1", quantity: 2, priceBrl: 10, totalBrl: 20 },
        { productId: "3", productName: "Peça 3", quantity: 3, priceBrl: 4, totalBrl: 12 },
      ], totalBrl: 32 },
      { storeId: "b", storeName: "Loja B", items: [
        { productId: "2", productName: "Peça 2", quantity: 1, priceBrl: 7.5, totalBrl: 7.5 },
      ], totalBrl: 7.5 },
    ]);
  });
});
