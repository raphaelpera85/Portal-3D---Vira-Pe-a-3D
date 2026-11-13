export type MakerApplicationInput = { businessName: string; description: string; portfolioUrl: string | null; city: string | null; stateCode: string | null };
export type ProductVariantOptions = Record<string, string[]>;
export type ProductVariantPricing = { options: Record<string, string>; priceBrl: number; stockQuantity: number | null };
export type ProductShippingPackage = { weightG: number; lengthCm: number; widthCm: number; heightCm: number };
export type ProductDraftInput = { name: string; description: string; categoryId: string; media: string[]; videoUrl: string | null; tags: string[]; listingType: "physical" | "digital"; priceMode: "fixed" | "from" | "quote"; priceBrl: number | null; fulfillmentMode: "ready_to_ship" | "made_to_order" | "digital" | "quote"; stockQuantity: number | null; preparationDays: number | null; shippingPackage: ProductShippingPackage | null; variantOptions: ProductVariantOptions; variantPricing: ProductVariantPricing[] };
export type ProductInventoryInput = { fulfillmentMode: "ready_to_ship" | "made_to_order" | "quote"; stockQuantity: number | null; preparationDays: number | null };
export type ProductQuoteRequestInput = { quantity: number; customization: string; dueDate: string | null };
export type ProductQuoteOfferInput = { totalBrl: number; leadDays: number; terms: string };
export type StoreNotificationContacts = { email: string; whatsapp: string | null; whatsappOptIn: boolean };

const text = (value: unknown) => typeof value === "string" ? value.trim() : null;

export function normalizeProductVideoUrl(value: unknown): string | null {
  // shortcut: direct public links only; move to managed storage when vendors need uploads or retention guarantees.
  const raw = text(value);
  if (!raw || raw.length > 1000) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password && /\.(?:mp4|webm)$/i.test(url.pathname)
      ? url.toString()
      : null;
  } catch { return null; }
}

export function normalizeProductImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "string" || !item || item.length > 1000) return [];
    try {
      const url = new URL(item);
      return url.protocol === "https:" && !url.username && !url.password ? [url.toString()] : [];
    } catch { return []; }
  }).filter((url, index, all) => all.indexOf(url) === index).slice(0, 8);
}

export function validateProductShippingPackage(values: Record<string, unknown>): ProductShippingPackage | null | undefined {
  const raw = [values.packageWeightG, values.packageLengthCm, values.packageWidthCm, values.packageHeightCm].map(text);
  if (raw.every((value) => !value)) return undefined;
  if (raw.some((value) => !value || !/^\d{1,6}(?:\.\d{1,2})?$/.test(value))) return null;
  const [weightG, lengthCm, widthCm, heightCm] = raw.map(Number);
  if (weightG < 1 || weightG > 100_000 || [lengthCm, widthCm, heightCm].some((size) => size < 0.1 || size > 500)) return null;
  return { weightG, lengthCm, widthCm, heightCm };
}

export function normalizeProductVariantOptions(value: unknown): ProductVariantOptions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 4) return null;
  const options: ProductVariantOptions = {};
  for (const [rawName, rawValues] of entries) {
    const name = rawName.trim();
    if (!/^[\p{L}\p{N}][\p{L}\p{N} _./()-]{0,31}$/u.test(name) || !Array.isArray(rawValues) || rawValues.length < 2 || rawValues.length > 12) return null;
    const values = rawValues.map((value) => typeof value === "string" ? value.trim() : "");
    if (values.some((value) => !value || value.length > 40 || /[\u0000-\u001f\u007f]/.test(value)) || new Set(values.map((value) => value.toLocaleLowerCase("pt-BR"))).size !== values.length) return null;
    options[name] = values;
  }
  if (new Set(Object.keys(options).map((name) => name.toLocaleLowerCase("pt-BR"))).size !== entries.length) return null;
  return options;
}

export function expandProductVariantOptions(value: unknown, limit = 100): Record<string, string>[] | null {
  const options = normalizeProductVariantOptions(value);
  if (!options || !Number.isSafeInteger(limit) || limit < 1) return null;
  const groups = Object.entries(options);
  if (!groups.length) return [];
  const count = groups.reduce((total, [, values]) => total * values.length, 1);
  if (count > limit) return null;
  return groups.reduce<Record<string, string>[]>((combinations, [name, values]) =>
    combinations.flatMap((combination) => values.map((value) => ({ ...combination, [name]: value }))), [{}]);
}

export function validateProductVariantPricing(raw: unknown, availableOptions: unknown,
  fulfillmentMode: "ready_to_ship" | "made_to_order"): ProductVariantPricing[] | null {
  const combinations = expandProductVariantOptions(availableOptions);
  if (!combinations || !combinations.length || typeof raw !== "string" || raw.length > 40_000) return null;
  let rows: unknown;
  try { rows = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(rows) || rows.length !== combinations.length) return null;
  const key = (options: Record<string, string>) => JSON.stringify(Object.fromEntries(Object.entries(options).sort(([a], [b]) => a.localeCompare(b))));
  const expected = new Set(combinations.map(key));
  const byCombination = new Map<string, ProductVariantPricing>();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const value = row as Record<string, unknown>;
    const selected = value.options;
    if (!selected || typeof selected !== "object" || Array.isArray(selected)) return null;
    const entries = Object.entries(selected as Record<string, unknown>);
    if (entries.length !== Object.keys(normalizeProductVariantOptions(availableOptions) ?? {}).length
      || entries.some(([name, choice]) => typeof choice !== "string")) return null;
    const variantOptions = Object.fromEntries(entries as [string, string][]);
    const variantKey = key(variantOptions);
    const priceBrl = typeof value.priceBrl === "number" ? value.priceBrl
      : typeof value.priceBrl === "string" && /^\d{1,9}(?:\.\d{1,2})?$/.test(value.priceBrl) ? Number(value.priceBrl) : Number.NaN;
    const rawStock = value.stockQuantity;
    const stockQuantity = typeof rawStock === "number" ? rawStock
      : typeof rawStock === "string" && /^\d{1,7}$/.test(rawStock) ? Number(rawStock) : rawStock;
    if (!expected.has(variantKey) || byCombination.has(variantKey) || !Number.isFinite(priceBrl) || priceBrl <= 0
      || priceBrl > 999_999_999 || Math.abs(priceBrl * 100 - Math.round(priceBrl * 100)) > 1e-7
      || (fulfillmentMode === "ready_to_ship" && (!Number.isSafeInteger(stockQuantity) || (stockQuantity as number) < 0 || (stockQuantity as number) > 1_000_000))
    || (fulfillmentMode === "made_to_order" && stockQuantity !== null)) return null;
    byCombination.set(variantKey, { options: variantOptions, priceBrl, stockQuantity: stockQuantity as number | null });
  }
  return combinations.map((combination) => byCombination.get(key(combination)) ?? null).some((row) => row === null)
    ? null : combinations.map((combination) => byCombination.get(key(combination))!);
}

export function validateProductVariantOptions(value: unknown): ProductVariantOptions | null {
  const raw = text(value) ?? "";
  if (!raw) return {};
  if (raw.length > 500) return null;
  const options: Record<string, string[]> = {};
  for (const line of raw.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) return null;
    const name = line.slice(0, separator).trim();
    const values = line.slice(separator + 1).split(",").map((item) => item.trim());
    if (!name || options[name] || values.length < 2) return null;
    options[name] = values;
  }
  return normalizeProductVariantOptions(options);
}

export function validateProductVariantSelection(value: unknown, productProperties: unknown): Record<string, string> | null {
  const properties = productProperties && typeof productProperties === "object" && !Array.isArray(productProperties)
    ? productProperties as Record<string, unknown> : {};
  const available = normalizeProductVariantOptions(properties.variant_options ?? {});
  if (!available) return null;
  const raw = text(value);
  if (!raw || raw.length > 1000) return null;
  let selected: unknown;
  try { selected = JSON.parse(raw); } catch { return null; }
  if (!selected || typeof selected !== "object" || Array.isArray(selected)) return null;
  const entries = Object.entries(selected as Record<string, unknown>);
  if (entries.length !== Object.keys(available).length) return null;
  for (const [name, options] of Object.entries(available)) {
    const choice = (selected as Record<string, unknown>)[name];
    if (typeof choice !== "string" || !options.includes(choice)) return null;
  }
  return Object.fromEntries(entries.map(([name, choice]) => [name, choice as string]));
}

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
  const variantOptions = validateProductVariantOptions(values.variantOptions);
  const shippingPackage = validateProductShippingPackage(values);
  if (!name || name.length < 3 || name.length > 100 || description.length > 2000 || !categoryId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(categoryId) || !variantOptions || shippingPackage === null || (listingType === "digital" && shippingPackage !== undefined)) return null;
  if (priceMode !== "fixed" && priceMode !== "from" && priceMode !== "quote") return null;
  const priceBrl = priceMode === "quote" ? null : rawPrice && /^\d{1,9}(?:\.\d{1,2})?$/.test(rawPrice) ? Number(rawPrice) : null;
  if (priceMode !== "quote" && (priceBrl == null || priceBrl <= 0 || !Number.isFinite(priceBrl))) return null;
  if (listingType === "digital" && (priceMode !== "fixed" || fulfillmentMode !== "digital")) return null;
  if ((listingType !== "physical" || priceMode !== "fixed") && Object.keys(variantOptions).length > 0) return null;
  if (listingType === "physical" && ((priceMode === "quote" && fulfillmentMode !== "quote")
    || (priceMode !== "quote" && fulfillmentMode !== "ready_to_ship" && fulfillmentMode !== "made_to_order"))) return null;
  const stockQuantity = rawStock ? /^\d{1,7}$/.test(rawStock) ? Number(rawStock) : Number.NaN : null;
  const preparationDays = rawPreparationDays ? /^\d{1,3}$/.test(rawPreparationDays) ? Number(rawPreparationDays) : Number.NaN : null;
  const variantPricing = Object.keys(variantOptions).length
    ? validateProductVariantPricing(values.variantPricing, variantOptions, fulfillmentMode as "ready_to_ship" | "made_to_order")
    : [];
  if (Object.keys(variantOptions).length && (!variantPricing?.length
    || Math.min(...variantPricing.map((variant) => variant.priceBrl)) !== priceBrl
    || (fulfillmentMode === "ready_to_ship" && variantPricing.reduce((sum, variant) => sum + (variant.stockQuantity ?? 0), 0) !== stockQuantity))) return null;
  if ((fulfillmentMode === "ready_to_ship" && (stockQuantity == null || !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1_000_000))
    || (listingType === "digital" && (stockQuantity != null || preparationDays != null))
    || (fulfillmentMode !== "ready_to_ship" && stockQuantity != null)
    || (preparationDays != null && (!Number.isSafeInteger(preparationDays) || preparationDays < 0 || preparationDays > 365))
    || (fulfillmentMode !== "made_to_order" && preparationDays != null)) return null;
  const rawImages = text(values.imageUrls) ?? text(values.imageUrl) ?? "";
  if (rawImages.length > 8007) return null;
  const imageUrls = rawImages.split(/\r?\n/).map((image) => image.trim()).filter(Boolean);
  if (imageUrls.length > 8) return null;
  const media: string[] = [];
  for (const image of imageUrls) {
    try {
      const url = new URL(image);
      if (url.protocol !== "https:" || url.username || url.password || image.length > 1000) return null;
      if (!media.includes(url.toString())) media.push(url.toString());
    } catch { return null; }
  }
  const rawVideoUrl = text(values.videoUrl);
  const videoUrl = rawVideoUrl ? normalizeProductVideoUrl(rawVideoUrl) : null;
  if (rawVideoUrl && !videoUrl) return null;
  const tags = (text(values.tags) ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
  if (tags.length > 8 || tags.some((tag) => tag.length > 32)) return null;
  return { name, description, categoryId, media, videoUrl, tags, listingType, priceMode, priceBrl, fulfillmentMode: fulfillmentMode as ProductDraftInput["fulfillmentMode"], stockQuantity: stockQuantity as number | null, preparationDays: preparationDays as number | null, shippingPackage: shippingPackage ?? null, variantOptions, variantPricing: variantPricing ?? [] };
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
