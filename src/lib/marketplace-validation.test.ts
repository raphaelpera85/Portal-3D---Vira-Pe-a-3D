import { describe, expect, it } from "vitest";
import { validateMakerApplication, validateProductDraft, validateProductInventory, validateProductQuoteOffer, validateProductQuoteRequest, validateStoreNotificationContacts } from "./marketplace-validation";

describe("marketplace form validation", () => {
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
