import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterProducts } from "@/lib/catalog";
import { products as demoProducts } from "@/lib/products";
import { mapMarketplaceProduct } from "@/lib/marketplace-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const pageSize = 24;
const slugify = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export type MarketplaceCategory = { name: string; slug: string };

export async function loadMarketplaceCatalog({ query = "", category = "", page = 1 }: { query?: string; category?: string; page?: number } = {}) {
  const term = query.trim().slice(0, 100);
  const selectedPage = Number.isInteger(page) && page > 0 ? page : 1;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const categories = [...new Set(demoProducts.map((item) => item.category))].map((name) => ({ name, slug: slugify(name) }));
    const categoryName = categories.find((item) => item.slug === category)?.name;
    const visible = filterProducts(demoProducts, term, categoryName ?? "Todos");
    return { products: visible, categories, source: "local" as const, error: null, query: term, category, page: 1, pages: 1 };
  }

  const categoryQuery = supabase.from("product_categories").select("name, slug").eq("active", true).order("sort_order").order("name");
  let productsQuery = supabase.from("marketplace_products").select("id, store_id, slug, name, description, listing_type, price_mode, price_brl, fulfillment_mode, stock_quantity, preparation_days, media, tags, color_theme, visual, digital_asset:digital_assets(personal_price_brl, commercial_price_brl), store:stores!inner(name, slug), category:product_categories!inner(name, slug)", { count: "exact" }).eq("catalog_status", "published").eq("store.status", "published");
  if (category) productsQuery = productsQuery.eq("category.slug", category);
  if (term) productsQuery = productsQuery.textSearch("search_document", term, { config: "portuguese", type: "websearch" });
  productsQuery = productsQuery.order("published_at", { ascending: false }).range((selectedPage - 1) * pageSize, selectedPage * pageSize - 1);

  const [categoryResult, productResult] = await Promise.all([categoryQuery, productsQuery]);
  if (categoryResult.error || productResult.error) {
    return { products: [], categories: [], source: "database" as const, error: "Não foi possível carregar os produtos. Confira a migração do marketplace e tente novamente.", query: term, category, page: selectedPage, pages: 0 };
  }
  const pages = Math.ceil((productResult.count ?? 0) / pageSize);
  if (selectedPage > pages && pages > 0) return loadMarketplaceCatalog({ query: term, category, page: pages });
  return {
    products: (productResult.data ?? []).map((row) => mapMarketplaceProduct(row as Record<string, unknown>)),
    categories: (categoryResult.data ?? []) as MarketplaceCategory[],
    source: "database" as const,
    error: null,
    query: term,
    category,
    page: pages === 0 ? 1 : selectedPage,
    pages,
  };
}

export type RecommendedStore = { id: string; name: string; slug: string; productCount: number; reviewCount: number; averageRating: number | null };

export async function loadRecommendedStores(): Promise<RecommendedStore[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_recommended_marketplace_stores");
  if (error) return [];
  return ((data ?? []) as { store_id: string; store_name: string; store_slug: string; published_product_count: number | string; review_count: number | string; average_rating: number | string | null }[])
    .flatMap((row) => {
      const productCount = Number(row.published_product_count);
      const reviewCount = Number(row.review_count);
      const rating = row.average_rating == null ? null : Number(row.average_rating);
      return row.store_id && row.store_name && row.store_slug && Number.isSafeInteger(productCount) && productCount > 0
        && Number.isSafeInteger(reviewCount) && reviewCount >= 0 && (rating == null || (Number.isFinite(rating) && rating >= 1 && rating <= 5))
        ? [{ id: row.store_id, name: row.store_name, slug: row.store_slug, productCount, reviewCount, averageRating: rating }]
        : [];
    });
}

export async function loadMarketplaceProduct(slug: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return demoProducts.find((product) => product.slug === slug) ?? null;
  const { data, error } = await supabase.from("marketplace_products").select("id, store_id, slug, name, description, listing_type, price_mode, price_brl, fulfillment_mode, stock_quantity, preparation_days, product_properties, media, tags, color_theme, visual, variants:marketplace_product_variants(id, variant_options, price_brl, stock_quantity), digital_asset:digital_assets(personal_price_brl, commercial_price_brl), store:stores!inner(name, slug), category:product_categories!inner(name, slug)").eq("slug", slug).eq("catalog_status", "published").eq("store.status", "published").maybeSingle();
  if (error || !data) return null;
  const product = mapMarketplaceProduct(data as Record<string, unknown>);
  if (product.listingType !== "digital" || !product.digitalAsset) return product;
  const admin = createSupabaseAdminClient();
  if (!admin) return product;
  const { data: asset } = await admin.from("digital_assets").select("preview_path").eq("product_id", product.id).maybeSingle();
  if (!asset?.preview_path) return product;
  const { data: preview } = await admin.storage.from("digital-assets").createSignedUrl(asset.preview_path, 600);
  return preview?.signedUrl ? { ...product, digitalAsset: { ...product.digitalAsset, previewUrl: preview.signedUrl } } : product;
}
