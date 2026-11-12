import { describe, expect, it } from "vitest";
import { expandProductVariantOptions, validateMakerApplication, validateProductDraft, validateProductInventory, validateProductQuoteOffer, validateProductQuoteRequest, validateProductShippingPackage, validateProductVariantPricing, validateStoreNotificationContacts } from "./marketplace-validation";

describe("marketplace form validation", () => {
  it("expands product option groups into bounded, deterministic SKU combinations", () => {
    expect(expandProductVariantOptions({ Cor: ["Preto", "Branco"], Tamanho: ["P", "M"] })).toEqual([
      { Cor: "Preto", Tamanho: "P" }, { Cor: "Preto", Tamanho: "M" },
      { Cor: "Branco", Tamanho: "P" }, { Cor: "Branco", Tamanho: "M" },
    ]);
    expect(expandProductVariantOptions({})).toEqual([]);
    expect(expandProductVariantOptions({ Cor: Array.from({ length: 11 }, (_, i) => String(i)), Tamanho: Array.from({ length: 10 }, (_, i) => String(i)) })).toBeNull();
    expect(expandProductVariantOptions({ Cor: ["Preto", "preto"] })).toBeNull();
  });

  it("requires one valid price and fulfillment-appropriate stock value for every variant", () => {
    const options = { Cor: ["Preto", "Branco"] };
    const rows = [
      { options: { Cor: "Preto" }, priceBrl: 30, stockQuantity: 2 },
      { options: { Cor: "Branco" }, priceBrl: 35.9, stockQuantity: 0 },
    ];
    expect(validateProductVariantPricing(JSON.stringify(rows), options, "ready_to_ship")).toEqual(rows);
    expect(validateProductVariantPricing(JSON.stringify(rows.map((row) => ({ ...row, stockQuantity: null }))), options, "made_to_order"))
      .toMatchObject([{ stockQuantity: null }, { stockQuantity: null }]);
    expect(validateProductVariantPricing(JSON.stringify(rows.slice(0, 1)), options, "ready_to_ship")).toBeNull();
    expect(validateProductVariantPricing(JSON.stringify([rows[0], { ...rows[0], priceBrl: 40 }]), options, "ready_to_ship")).toBeNull();
    expect(validateProductVariantPricing(JSON.stringify(rows.map((row) => ({ ...row, priceBrl: 0 }))), options, "ready_to_ship")).toBeNull();
    expect(validateProductVariantPricing(JSON.stringify(rows.map((row) => ({ ...row, priceBrl: 19.999 }))), options, "ready_to_ship")).toBeNull();
  });

  it("uses the minimum variant price and summed ready-to-ship stock for a listing", () => {
    const draft = {
      name: "Miniatura modular", categoryId: "7b383334-110a-4dc3-9000-6c7e0c2ad491", priceMode: "fixed",
      priceBrl: "30", fulfillmentMode: "ready_to_ship", stockQuantity: "2", variantOptions: "Cor: Preto, Branco",
      variantPricing: JSON.stringify([
        { options: { Cor: "Preto" }, priceBrl: "30", stockQuantity: "2" },
        { options: { Cor: "Branco" }, priceBrl: "35.90", stockQuantity: "0" },
      ]),
    };
    expect(validateProductDraft(draft)).toMatchObject({ priceBrl: 30, stockQuantity: 2, variantPricing: [{ priceBrl: 30 }, { priceBrl: 35.9 }] });
    expect(validateProductDraft({ ...draft, stockQuantity: "3" })).toBeNull();
    expect(validateProductDraft({ ...draft, priceBrl: "29" })).toBeNull();
    expect(validateProductDraft({ ...draft, variantPricing: "" })).toBeNull();
  });

  it("requires a useful maker description and secure optional portfolio link", () => {
    expect(validateMakerApplication({ businessName: "Oficina Norte", description: "Produzimos peças e miniaturas personalizadas sob encomenda para clientes no Brasil." })?.portfolioUrl).toBeNull();
    expect(validateMakerApplication({ businessName: "Maker", description: "Descrição suficiente, com detalhes claros sobre a oficina e os produtos fabricados.", portfolioUrl: "http://example.com" })).toBeNull();
    expect(validateMakerApplication({ businessName: "A", description: "Descrição suficiente, com detalhes claros sobre a oficina e os produtos fabricados." })).toBeNull();
  });

  it("requires exact valid pricing and keeps quote listings without a price", () => {
    const categoryId = "7b383334-110a-4dc3-9000-6c7e0c2ad491";
    expect(validateProductDraft({ name: "Vaso modular", categoryId, priceMode: "from", priceBrl: "84.90" })?.priceBrl).toBe(84.9);
    expect(validateProductDraft({ name: "Vaso modular", categoryId, priceMode: "quote", priceBrl: "999" })?.priceBrl).toBeNull();
    expect(validateProductDraft({ name: "Vaso modular", categoryId, priceMode: "fixed", priceBrl: "0" })).toBeNull();
  });

  it("validates physical stock and preparation time without treating made-to-order as stocked", () => {
    const base = { name: "Vaso modular", categoryId: "7b383334-110a-4dc3-9000-6c7e0c2ad491", priceMode: "fixed", priceBrl: "84.90" };
    expect(validateProductDraft({ ...base, fulfillmentMode: "ready_to_ship", stockQuantity: "0" })).toMatchObject({ fulfillmentMode: "ready_to_ship", stockQuantity: 0 });
    expect(validateProductDraft({ ...base, fulfillmentMode: "ready_to_ship", stockQuantity: "" })).toBeNull();
    expect(validateProductDraft({ ...base, fulfillmentMode: "ready_to_ship", stockQuantity: "1.5" })).toBeNull();
    expect(validateProductDraft({ ...base, fulfillmentMode: "made_to_order", preparationDays: "7" })).toMatchObject({ fulfillmentMode: "made_to_order", stockQuantity: null, preparationDays: 7 });
    expect(validateProductDraft({ ...base, fulfillmentMode: "quote" })).toBeNull();
    expect(validateProductInventory({ fulfillmentMode: "ready_to_ship", stockQuantity: "0" }, "fixed")?.stockQuantity).toBe(0);
    expect(validateProductInventory({ fulfillmentMode: "ready_to_ship", stockQuantity: "" }, "fixed")).toBeNull();
    expect(validateProductInventory({ fulfillmentMode: "made_to_order", preparationDays: "12" }, "from")).toEqual({ fulfillmentMode: "made_to_order", stockQuantity: null, preparationDays: 12 });
    expect(validateProductInventory({ fulfillmentMode: "quote" }, "quote")).toEqual({ fulfillmentMode: "quote", stockQuantity: null, preparationDays: null });
  });

  it("validates shipping package data as an all-or-none physical product detail", () => {
    const base = { name: "Vaso modular", categoryId: "7b383334-110a-4dc3-9000-6c7e0c2ad491", priceMode: "fixed", priceBrl: "84.90" };
    const parcel = { packageWeightG: "420", packageLengthCm: "18", packageWidthCm: "12.5", packageHeightCm: "9" };
    expect(validateProductDraft({ ...base, ...parcel })).toMatchObject({ shippingPackage: { weightG: 420, lengthCm: 18, widthCm: 12.5, heightCm: 9 } });
    expect(validateProductDraft({ ...base, packageWeightG: "420" })).toBeNull();
    expect(validateProductDraft({ ...base, ...parcel, packageWeightG: "0" })).toBeNull();
    expect(validateProductDraft({ ...base, listingType: "digital", fulfillmentMode: "digital", ...parcel })).toBeNull();
    expect(validateProductShippingPackage(parcel)).toEqual({ weightG: 420, lengthCm: 18, widthCm: 12.5, heightCm: 9 });
  });

  it("accepts digital listings only with fixed pricing and digital fulfillment", () => {
    const base = { name: "Modelo articulado", categoryId: "7b383334-110a-4dc3-9000-6c7e0c2ad491", listingType: "digital", priceMode: "fixed", priceBrl: "29.90", fulfillmentMode: "digital" };
    expect(validateProductDraft(base)).toMatchObject({ listingType: "digital", fulfillmentMode: "digital", stockQuantity: null });
    expect(validateProductDraft({ ...base, fulfillmentMode: "made_to_order" })).toBeNull();
    expect(validateProductDraft({ ...base, priceMode: "quote" })).toBeNull();
  });

  it("rejects unsafe media URLs and oversized tag lists", () => {
    const base = { name: "Vaso modular", categoryId: "7b383334-110a-4dc3-9000-6c7e0c2ad491", priceMode: "quote" };
    expect(validateProductDraft({ ...base, imageUrl: "javascript:alert(1)" })).toBeNull();
    expect(validateProductDraft({ ...base, tags: "a,b,c,d,e,f,g,h,i" })).toBeNull();
  });

  it("validates quote quantities, due dates, prices, and lead times", () => {
    expect(validateProductQuoteRequest({ quantity: "2", dueDate: "2027-01-15" }, "2026-11-11")?.quantity).toBe(2);
    expect(validateProductQuoteRequest({ quantity: "101" })).toBeNull();
    expect(validateProductQuoteRequest({ quantity: "1", dueDate: "2026-11-10" }, "2026-11-11")).toBeNull();
    expect(validateProductQuoteOffer({ totalBrl: "149.90", leadDays: "12", terms: "" })?.totalBrl).toBe(149.9);
    expect(validateProductQuoteOffer({ totalBrl: "0", leadDays: "12" })).toBeNull();
    expect(validateProductQuoteOffer({ totalBrl: "149", leadDays: "366" })).toBeNull();
  });

  it("normalizes seller notification contacts and requires WhatsApp opt-in", () => {
    expect(validateStoreNotificationContacts({ email: " Vendedor@Example.com ", whatsapp: "+55 11 00000-0000", whatsappOptIn: "on" })).toEqual({ email: "vendedor@example.com", whatsapp: "+5511000000000", whatsappOptIn: true });
    expect(validateStoreNotificationContacts({ email: "bad", whatsapp: "11999990000", whatsappOptIn: "on" })).toBeNull();
    expect(validateStoreNotificationContacts({ email: "maker@example.com", whatsapp: "11999990000", whatsappOptIn: false })).toBeNull();
    expect(validateStoreNotificationContacts({ email: "maker@example.com", whatsapp: "", whatsappOptIn: false })).toEqual({ email: "maker@example.com", whatsapp: null, whatsappOptIn: false });
  });
});
