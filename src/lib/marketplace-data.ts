import type { Product, ProductVisual } from "./products";
import { normalizeProductImageUrls, normalizeProductVideoUrl, normalizeProductVariantOptions, validateProductVariantSelection } from "./marketplace-validation";
import { getModelAssetUrl, getShowcaseModel } from "./model-showcase";

type Row = Record<string, unknown>;
export function orderProductsByIds<T extends { id: string }>(products: T[], orderedIds: string[]) {
  const byId = new Map(products.map((product) => [product.id, product]));
  return orderedIds.flatMap((id) => {
    const product = byId.get(id);
    return product ? [product] : [];
  });
}

const asObject = (value: unknown): Row => Array.isArray(value) ? asObject(value[0]) : value && typeof value === "object" ? value as Row : {};
const asText = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const asTextList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const visuals = new Set<ProductVisual>(["vase", "dragon", "organizer", "keychain"]);
const themes = new Set(["blue", "green", "sand", "pink"]);

export function mapMarketplaceProduct(row: Row): Product {
  const store = asObject(row.store);
  const category = asObject(row.category);
  const digitalAssetRow = asObject(row.digital_asset);
  const properties = asObject(row.product_properties);
  const listingType = row.listing_type === "digital" || row.listing_type === "print_service" ? row.listing_type : "physical";
  const rawPrice = row.price_brl;
  const priceBrl = rawPrice == null || rawPrice === "" || !Number.isFinite(Number(rawPrice)) || Number(rawPrice) <= 0 ? null : Number(rawPrice);
  const priceMode = row.price_mode === "fixed" || row.price_mode === "from" ? row.price_mode : "quote";
  const fulfillmentMode = row.fulfillment_mode === "ready_to_ship" || row.fulfillment_mode === "made_to_order" || row.fulfillment_mode === "digital" ? row.fulfillment_mode : "quote";
  const rawStock = row.stock_quantity == null ? null : Number(row.stock_quantity);
  const stockQuantity = rawStock != null && Number.isSafeInteger(rawStock) && rawStock >= 0 ? rawStock : null;
  const rawPreparation = row.preparation_days == null ? null : Number(row.preparation_days);
  const preparationDays = rawPreparation != null && Number.isSafeInteger(rawPreparation) && rawPreparation >= 0 ? rawPreparation : null;
  const media = normalizeProductImageUrls(row.media);
  const visual = visuals.has(row.visual as ProductVisual) ? row.visual as ProductVisual : null;
  const rawTheme = asText(row.color_theme);
  const variantOptions = normalizeProductVariantOptions(properties.variant_options ?? {}) ?? {};
  const previewModel = listingType === "physical" ? getShowcaseModel(asText(properties.model_preview_id)) : null;
  const previewUrl = previewModel ? getModelAssetUrl(previewModel.filePath) : null;
  const optionalText = (value: unknown, maxLength: number) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength ? value.trim() : undefined;
  const optionalPositiveNumber = (value: unknown, max: number) => {
    const number = typeof value === "number" || typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
    return Number.isFinite(number) && number > 0 && number <= max ? number : undefined;
  };
  const rawDimensions = asObject(properties.item_dimensions_cm);
  const length = optionalPositiveNumber(rawDimensions.length, 500);
  const width = optionalPositiveNumber(rawDimensions.width, 500);
  const height = optionalPositiveNumber(rawDimensions.height, 500);
  const material = optionalText(properties.material, 100);
  const color = optionalText(properties.color, 80);
  const weightG = optionalPositiveNumber(properties.item_weight_g, 100_000);
  const physicalSpecifications = listingType === "physical" ? {
    ...(material ? { material } : {}),
    ...(color ? { color } : {}),
    ...(weightG != null ? { weightG } : {}),
    ...(length != null && width != null && height != null ? { dimensionsCm: { length, width, height } } : {}),
  } : undefined;
  const variants = (Array.isArray(row.variants) ? row.variants : []).flatMap((item) => {
    const variant = asObject(item);
    const selected = validateProductVariantSelection(JSON.stringify(variant.variant_options), properties);
    const price = Number(variant.price_brl);
    const stock = variant.stock_quantity == null ? null : Number(variant.stock_quantity);
    return selected && typeof variant.id === "string" && Number.isFinite(price) && price > 0
      && (stock == null || (Number.isSafeInteger(stock) && stock >= 0))
      ? [{ id: variant.id, options: selected, priceBrl: price, stockQuantity: stock }]
      : [];
  });
  const maker = asText(store.name, "Fabricante ViraPeça");
  const personalLicense = Number(digitalAssetRow.personal_price_brl);
  const commercialLicense = Number(digitalAssetRow.commercial_price_brl);

  return {
    id: asText(row.id), slug: asText(row.slug), name: asText(row.name, "Produto sem nome"),
    description: asText(row.description), category: asText(category.name, "Outros"), tags: asTextList(row.tags),
    maker, color: themes.has(rawTheme) ? rawTheme : "blue", visual,
    priceBrl: priceMode === "quote" ? null : priceBrl, priceMode, fulfillmentMode, stockQuantity, preparationDays,
    variantOptions, variants,
    ...(physicalSpecifications && Object.keys(physicalSpecifications).length ? { physicalSpecifications } : {}),
    ...(previewModel && previewUrl ? { modelPreview: { name: previewModel.name, url: previewUrl } } : {}),
    priceLabel: priceMode === "quote" ? "Sob orçamento" : priceBrl == null ? "Preço indisponível" : `${priceMode === "from" || variants.length > 0 ? "A partir de " : ""}${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(priceBrl)}`,
    media, videoUrl: normalizeProductVideoUrl(row.video_url), storeId: asText(row.store_id) || null, storeSlug: asText(store.slug) || null, demo: false, listingType,
    digitalAsset: listingType === "digital" && Number.isFinite(personalLicense) && personalLicense > 0
      ? { personalPriceBrl: personalLicense, commercialPriceBrl: Number.isFinite(commercialLicense) && commercialLicense > 0 ? commercialLicense : null }
      : null,
  };
}
