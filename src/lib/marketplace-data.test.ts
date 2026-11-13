import { describe, expect, it } from "vitest";
import { mapMarketplaceProduct, orderProductsByIds } from "./marketplace-data";

describe("orderProductsByIds", () => {
  it("preserves ranking order and drops rows that are no longer public", () => {
    expect(orderProductsByIds([{ id: "new" }, { id: "best" }], ["best", "removed", "new"]))
      .toEqual([{ id: "best" }, { id: "new" }]);
  });
});

describe("mapMarketplaceProduct", () => {
  it("maps only valid image URLs and converts database prices from reais", () => {
    const product = mapMarketplaceProduct({
      id: "p1", slug: "vaso-aresta", name: "Vaso Aresta", description: "Vaso autoral", price_mode: "fixed", price_brl: "89.90",
      tags: ["decoração", 3], media: ["https://cdn.example/vaso.webp", "https://user:password@cdn.example/private.webp", "javascript:alert(1)", 9], color: "blue",
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
    expect(product.videoUrl).toBeNull();
    expect(product.fulfillmentMode).toBe("quote");
    expect(product.stockQuantity).toBeNull();
  });

  it("maps only safe direct video links from product rows", () => {
    const product = mapMarketplaceProduct({
      id: "p6", slug: "demo-video", name: "Produto com vídeo", price_mode: "quote",
      video_url: "https://cdn.example/demo.webm?version=1",
    });
    expect(product.videoUrl).toBe("https://cdn.example/demo.webm?version=1");
    expect(mapMarketplaceProduct({ id: "p7", video_url: "javascript:alert(1)" }).videoUrl).toBeNull();
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

  it("maps only variant prices, stock, and choices that belong to the published option groups", () => {
    const product = mapMarketplaceProduct({
      id: "p5", slug: "vaso-variante", name: "Vaso", price_mode: "fixed", price_brl: "30.00",
      product_properties: { variant_options: { Cor: ["Preto", "Branco"] } },
      variants: [
        { id: "v1", variant_options: { Cor: "Preto" }, price_brl: "30.00", stock_quantity: 4 },
        { id: "v2", variant_options: { Cor: "Branco" }, price_brl: "35.90", stock_quantity: 0 },
        { id: "v3", variant_options: { Cor: "Roxo" }, price_brl: "10.00", stock_quantity: 2 },
      ],
      store: { name: "Ateliê", slug: "atelie" }, category: { name: "Casa", slug: "casa" },
    });
    expect(product.variants).toEqual([
      { id: "v1", options: { Cor: "Preto" }, priceBrl: 30, stockQuantity: 4 },
      { id: "v2", options: { Cor: "Branco" }, priceBrl: 35.9, stockQuantity: 0 },
    ]);
    expect(product.priceLabel.replace(/\u00a0/g, " ")).toBe("A partir de R$ 30,00");
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
