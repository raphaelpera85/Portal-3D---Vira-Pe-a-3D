import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterProducts } from "@/lib/catalog";
import { products as demoProducts, type Product } from "@/lib/products";
import { mapMarketplaceProduct, orderProductsByIds } from "@/lib/marketplace-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFavoriteProductRecommendations } from "@/lib/favorite-product-recommendations";

const pageSize = 24;
const slugify = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export type MarketplaceCategory = { id: string; name: string; slug: string; parent_id: string | null };
export type MarketplaceSort = "newest" | "popular";

export async function loadMarketplaceCatalog({ query = "", category = "", page = 1, sort = "newest" }: { query?: string; category?: string; page?: number; sort?: MarketplaceSort } = {}) {
  const term = query.trim().slice(0, 100);
  const selectedPage = Number.isInteger(page) && page > 0 ? page : 1;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const categories = [...new Set(demoProducts.map((item) => item.category))].map((name) => ({ id: slugify(name), name, slug: slugify(name), parent_id: null }));
    const categoryName = categories.find((item) => item.slug === category)?.name;
    const visible = filterProducts(demoProducts, term, categoryName ?? "Todos");
    return { products: visible, categories, source: "local" as const, error: null, query: term, category, page: 1, pages: 1, sort };
  }

  const categoryQuery = supabase.from("product_categories").select("id, name, slug, parent_id").eq("active", true).order("sort_order").order("name");
  let productsQuery = supabase.from("marketplace_products").select("id, store_id, slug, name, description, listing_type, price_mode, price_brl, fulfillment_mode, stock_quantity, preparation_days, media, video_url, tags, color_theme, visual, digital_asset:digital_assets(personal_price_brl, commercial_price_brl), store:stores!inner(name, slug), category:product_categories!inner(name, slug)", { count: "exact" }).eq("catalog_status", "published").eq("store.status", "published");
  if (category) productsQuery = productsQuery.eq("category.slug", category);
  if (term) productsQuery = productsQuery.textSearch("search_document", term, { config: "portuguese", type: "websearch" });
  if (sort === "popular") {
    const [{ data: ranking, error: rankingError }, categoryResult] = await Promise.all([
      supabase.rpc("get_marketplace_best_sellers", {
        p_category_slug: category || null,
        p_search: term || null,
        p_page: selectedPage,
        p_page_size: pageSize,
      }),
      categoryQuery,
    ]);
    if (categoryResult.error || rankingError) {
      return { products: [], categories: [], source: "database" as const, error: "Não foi possível carregar os produtos. Confira a migration de mais vendidos e tente novamente.", query: term, category, page: selectedPage, pages: 0, sort };
    }
    const rows = (ranking ?? []) as { product_id: string | null; total_count: number | string }[];
    const productIds = rows.flatMap(({ product_id }) => product_id ? [product_id] : []);
    const count = Number(rows[0]?.total_count ?? 0);
    const pages = Math.ceil(count / pageSize);
    if (selectedPage > pages && pages > 0) return loadMarketplaceCatalog({ query: term, category, page: pages, sort });
    if (productIds.length) productsQuery = productsQuery.in("id", productIds);
    else return { products: [], categories: (categoryResult.data ?? []) as MarketplaceCategory[], source: "database" as const, error: null, query: term, category, page: 1, pages: 0, sort };
    const { data: productRows, error: productError } = await productsQuery;
    if (productError) return { products: [], categories: [], source: "database" as const, error: "Não foi possível carregar os produtos. Tente novamente.", query: term, category, page: selectedPage, pages: 0, sort };
    const products = (productRows ?? []).map((row) => mapMarketplaceProduct(row as Record<string, unknown>));
    return { products: orderProductsByIds(products, productIds), categories: (categoryResult.data ?? []) as MarketplaceCategory[], source: "database" as const, error: null, query: term, category, page: selectedPage, pages, sort };
  }

  productsQuery = productsQuery.order("published_at", { ascending: false }).range((selectedPage - 1) * pageSize, selectedPage * pageSize - 1);
  const [categoryResult, productResult] = await Promise.all([categoryQuery, productsQuery]);
  if (categoryResult.error || productResult.error) {
    return { products: [], categories: [], source: "database" as const, error: "Não foi possível carregar os produtos. Confira a migração do marketplace e tente novamente.", query: term, category, page: selectedPage, pages: 0, sort };
  }
  const pages = Math.ceil((productResult.count ?? 0) / pageSize);
  if (selectedPage > pages && pages > 0) return loadMarketplaceCatalog({ query: term, category, page: pages, sort });
  return {
    products: (productResult.data ?? []).map((row) => mapMarketplaceProduct(row as Record<string, unknown>)),
    categories: (categoryResult.data ?? []) as MarketplaceCategory[],
    source: "database" as const,
    error: null,
    query: term,
    category,
    page: pages === 0 ? 1 : selectedPage,
    pages,
    sort,
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

export async function loadFavoriteProductRecommendations(favorites: Product[]) {
  const categories = [...new Set(favorites.filter(({ demo }) => !demo).map(({ category }) => category).filter(Boolean))];
  if (!categories.length) return [];

  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("marketplace_products")
    .select("id, store_id, slug, name, description, listing_type, price_mode, price_brl, fulfillment_mode, stock_quantity, preparation_days, product_properties, media, video_url, tags, color_theme, visual, variants:marketplace_product_variants(id, variant_options, price_brl, stock_quantity), digital_asset:digital_assets(personal_price_brl, commercial_price_brl), store:stores!inner(name, slug), category:product_categories!inner(name, slug, active)")
    .in("category.name", categories).eq("catalog_status", "published").eq("store.status", "published").eq("category.active", true)
    .order("published_at", { ascending: false }).limit(100);
  if (error) return [];

  const candidates = (data ?? []).map((row) => mapMarketplaceProduct(row as Record<string, unknown>));
  return getFavoriteProductRecommendations(favorites, candidates);
}

export async function loadMarketplaceProduct(slug: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return demoProducts.find((product) => product.slug === slug) ?? null;
  const { data, error } = await supabase.from("marketplace_products").select("id, store_id, slug, name, description, listing_type, price_mode, price_brl, fulfillment_mode, stock_quantity, preparation_days, product_properties, media, video_url, tags, color_theme, visual, variants:marketplace_product_variants(id, variant_options, price_brl, stock_quantity), digital_asset:digital_assets(personal_price_brl, commercial_price_brl), store:stores!inner(name, slug), category:product_categories!inner(name, slug)").eq("slug", slug).eq("catalog_status", "published").eq("store.status", "published").maybeSingle();
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
