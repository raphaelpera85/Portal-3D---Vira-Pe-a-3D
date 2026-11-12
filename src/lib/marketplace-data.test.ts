import { describe, expect, it } from "vitest";
import { mapMarketplaceProduct } from "./marketplace-data";

describe("mapMarketplaceProduct", () => {
  it("maps only valid image URLs and converts database prices from reais", () => {
    const product = mapMarketplaceProduct({
      id: "p1", slug: "vaso-aresta", name: "Vaso Aresta", description: "Vaso autoral", price_mode: "fixed", price_brl: "89.90",
      tags: ["decoração", 3], media: ["https://cdn.example/vaso.webp", "javascript:alert(1)", 9], color: "blue",
      store: { name: "Oficina Norte", slug: "oficina-norte" }, category: { name: "Decoração", slug: "decoracao" },
    });

    expect(product.priceBrl).toBe(89.9);
    expect(product.media).toEqual(["https://cdn.example/vaso.webp"]);
    expect(product.tags).toEqual(["decoração"]);
    expect(product.maker).toBe("Oficina Norte");
    expect(product.slug).toBe("vaso-aresta");
  });

  it("keeps quote-only products without inventing a price or media", () => {
    const product = mapMarketplaceProduct({
      id: "p2", slug: "miniatura", name: "Miniatura", price_mode: "quote", price_brl: null,
      store: { name: "Ateliê", slug: "atelie" }, category: { name: "Miniaturas", slug: "miniaturas" },
    });

    expect(product.priceBrl).toBeNull();
    expect(product.priceLabel).toBe("Sob orçamento");
    expect(product.media).toEqual([]);
    expect(product.fulfillmentMode).toBe("quote");
    expect(product.stockQuantity).toBeNull();
  });

  it("preserves explicit zero stock and valid preparation time", () => {
    const product = mapMarketplaceProduct({
      id: "p3", slug: "vaso", name: "Vaso", price_mode: "fixed", price_brl: "50.00",
      fulfillment_mode: "ready_to_ship", stock_quantity: 0, preparation_days: 2,
      store: { name: "Oficina", slug: "oficina" }, category: { name: "Casa", slug: "casa" },
    });
    expect(product.stockQuantity).toBe(0);
    expect(product.fulfillmentMode).toBe("ready_to_ship");
    expect(product.preparationDays).toBe(2);
  });

  it("exposes public license prices without returning private file metadata", () => {
    const product = mapMarketplaceProduct({
      id: "p4", slug: "modelo-digital", name: "Modelo digital", listing_type: "digital", price_mode: "fixed", price_brl: "19.90",
      fulfillment_mode: "digital", digital_asset: { personal_price_brl: "19.90", commercial_price_brl: "89.90", object_path: "private/path.stl" },
      store: { name: "Ateliê", slug: "atelie" }, category: { name: "Arquivos digitais", slug: "arquivos-digitais" },
    });
    expect(product.listingType).toBe("digital");
    expect(product.digitalAsset).toEqual({ personalPriceBrl: 19.9, commercialPriceBrl: 89.9 });
    expect(product.digitalAsset).not.toHaveProperty("objectPath");
  });
});
