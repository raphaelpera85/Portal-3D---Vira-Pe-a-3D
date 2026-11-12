export type MakerApplicationInput = { businessName: string; description: string; portfolioUrl: string | null; city: string | null; stateCode: string | null };
export type ProductDraftInput = { name: string; description: string; categoryId: string; media: string[]; tags: string[]; listingType: "physical" | "digital"; priceMode: "fixed" | "from" | "quote"; priceBrl: number | null; fulfillmentMode: "ready_to_ship" | "made_to_order" | "digital" | "quote"; stockQuantity: number | null; preparationDays: number | null };
export type ProductInventoryInput = { fulfillmentMode: "ready_to_ship" | "made_to_order" | "quote"; stockQuantity: number | null; preparationDays: number | null };
export type ProductQuoteRequestInput = { quantity: number; customization: string; dueDate: string | null };
export type ProductQuoteOfferInput = { totalBrl: number; leadDays: number; terms: string };
export type StoreNotificationContacts = { email: string; whatsapp: string | null; whatsappOptIn: boolean };

const text = (value: unknown) => typeof value === "string" ? value.trim() : null;

export function validateMakerApplication(values: Record<string, unknown>): MakerApplicationInput | null {
  const businessName = text(values.businessName);
  const description = text(values.description);
  const rawUrl = text(values.portfolioUrl);
  const city = text(values.city);
  const rawState = text(values.stateCode);
  if (!businessName || businessName.length < 2 || businessName.length > 80 || !description || description.length < 30 || description.length > 1200) return null;
  if (city && city.length > 60) return null;
  const stateCode = rawState ? rawState.toUpperCase() : null;
  if (stateCode && !/^[A-Z]{2}$/.test(stateCode)) return null;
  let portfolioUrl: string | null = null;
  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:" || url.username || url.password || rawUrl.length > 500) return null;
      portfolioUrl = url.toString();
    } catch { return null; }
  }
  return { businessName, description, portfolioUrl, city: city || null, stateCode };
}

export function validateProductDraft(values: Record<string, unknown>): ProductDraftInput | null {
  const name = text(values.name);
  const description = text(values.description) ?? "";
  const categoryId = text(values.categoryId);
  const listingType = values.listingType === "digital" ? "digital" : "physical";
  const priceMode = values.priceMode;
  const rawPrice = text(values.priceBrl);
  const requestedFulfillment = text(values.fulfillmentMode);
  const fulfillmentMode = requestedFulfillment ?? (priceMode === "quote" ? "quote" : "made_to_order");
  const rawStock = text(values.stockQuantity);
  const rawPreparationDays = text(values.preparationDays);
  if (!name || name.length < 3 || name.length > 100 || description.length > 2000 || !categoryId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(categoryId)) return null;
  if (priceMode !== "fixed" && priceMode !== "from" && priceMode !== "quote") return null;
  const priceBrl = priceMode === "quote" ? null : rawPrice && /^\d{1,9}(?:\.\d{1,2})?$/.test(rawPrice) ? Number(rawPrice) : null;
  if (priceMode !== "quote" && (priceBrl == null || priceBrl <= 0 || !Number.isFinite(priceBrl))) return null;
  if (listingType === "digital" && (priceMode !== "fixed" || fulfillmentMode !== "digital")) return null;
  if (listingType === "physical" && ((priceMode === "quote" && fulfillmentMode !== "quote")
    || (priceMode !== "quote" && fulfillmentMode !== "ready_to_ship" && fulfillmentMode !== "made_to_order"))) return null;
  const stockQuantity = rawStock ? /^\d{1,7}$/.test(rawStock) ? Number(rawStock) : Number.NaN : null;
  const preparationDays = rawPreparationDays ? /^\d{1,3}$/.test(rawPreparationDays) ? Number(rawPreparationDays) : Number.NaN : null;
  if ((fulfillmentMode === "ready_to_ship" && (stockQuantity == null || !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1_000_000))
    || (listingType === "digital" && (stockQuantity != null || preparationDays != null))
    || (fulfillmentMode !== "ready_to_ship" && stockQuantity != null)
    || (preparationDays != null && (!Number.isSafeInteger(preparationDays) || preparationDays < 0 || preparationDays > 365))
    || (fulfillmentMode !== "made_to_order" && preparationDays != null)) return null;
  const image = text(values.imageUrl);
  const media: string[] = [];
  if (image) {
    try {
      const url = new URL(image);
      if (url.protocol !== "https:" || url.username || url.password || image.length > 1000) return null;
      media.push(url.toString());
    } catch { return null; }
  }
  const tags = (text(values.tags) ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
  if (tags.length > 8 || tags.some((tag) => tag.length > 32)) return null;
  return { name, description, categoryId, media, tags, listingType, priceMode, priceBrl, fulfillmentMode: fulfillmentMode as ProductDraftInput["fulfillmentMode"], stockQuantity: stockQuantity as number | null, preparationDays: preparationDays as number | null };
}

export function validateProductInventory(values: Record<string, unknown>, priceMode: unknown): ProductInventoryInput | null {
  const fulfillmentMode = text(values.fulfillmentMode);
  const rawStock = text(values.stockQuantity);
  const rawPreparationDays = text(values.preparationDays);
  if (priceMode === "quote") {
    return fulfillmentMode === "quote" && !rawStock && !rawPreparationDays
      ? { fulfillmentMode, stockQuantity: null, preparationDays: null }
      : null;
  }
  if (priceMode !== "fixed" && priceMode !== "from") return null;
  const stockQuantity = rawStock ? /^\d{1,7}$/.test(rawStock) ? Number(rawStock) : Number.NaN : null;
  const preparationDays = rawPreparationDays ? /^\d{1,3}$/.test(rawPreparationDays) ? Number(rawPreparationDays) : Number.NaN : null;
  if ((fulfillmentMode === "ready_to_ship" && (stockQuantity == null || !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1_000_000))
    || (fulfillmentMode === "made_to_order" && stockQuantity != null)
    || (fulfillmentMode !== "ready_to_ship" && fulfillmentMode !== "made_to_order")
    || (preparationDays != null && (!Number.isSafeInteger(preparationDays) || preparationDays < 0 || preparationDays > 365))) return null;
  return { fulfillmentMode, stockQuantity: stockQuantity as number | null, preparationDays: preparationDays as number | null };
}

export function validateProductQuoteRequest(values: Record<string, unknown>, today = new Date().toISOString().slice(0, 10)): ProductQuoteRequestInput | null {
  const rawQuantity = text(values.quantity) ?? "1";
  const customization = text(values.customization) ?? "";
  const rawDate = text(values.dueDate);
  if (!/^\d{1,3}$/.test(rawQuantity) || customization.length > 2000) return null;
  const quantity = Number(rawQuantity);
  if (quantity < 1 || quantity > 100) return null;
  if (!rawDate) return { quantity, customization, dueDate: null };
  const date = new Date(`${rawDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== rawDate || rawDate < today) return null;
  return { quantity, customization, dueDate: rawDate };
}

export function validateProductQuoteOffer(values: Record<string, unknown>): ProductQuoteOfferInput | null {
  const rawTotal = text(values.totalBrl);
  const rawDays = text(values.leadDays);
  const terms = text(values.terms) ?? "";
  if (!rawTotal || !/^\d{1,9}(?:\.\d{1,2})?$/.test(rawTotal) || terms.length > 2000 || !rawDays || !/^\d{1,3}$/.test(rawDays)) return null;
  const totalBrl = Number(rawTotal);
  const leadDays = Number(rawDays);
  if (!Number.isFinite(totalBrl) || totalBrl <= 0 || totalBrl > 1_000_000_000 || leadDays < 1 || leadDays > 365) return null;
  return { totalBrl, leadDays, terms };
}

export function validateStoreNotificationContacts(values: Record<string, unknown>): StoreNotificationContacts | null {
  const email = text(values.email)?.toLowerCase() ?? "";
  const rawWhatsapp = text(values.whatsapp) ?? "";
  const whatsappOptIn = values.whatsappOptIn === true || values.whatsappOptIn === "on";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (!rawWhatsapp) return whatsappOptIn ? null : { email, whatsapp: null, whatsappOptIn: false };
  if (!/^[+\d\s().-]+$/.test(rawWhatsapp)) return null;
  const digits = rawWhatsapp.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  if (!/^\d{10,11}$/.test(national) || !/^[1-9]\d{9,10}$/.test(national) || !whatsappOptIn) return null;
  return { email, whatsapp: `+55${national}`, whatsappOptIn: true };
}
