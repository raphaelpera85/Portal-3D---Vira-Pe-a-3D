import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  if (!base) return [];
  const fixedPages: MetadataRoute.Sitemap = ["", "/calculadora", "/catalogos", "/visualizador", "/lojas", "/designers"].map((path) => ({
    url: new URL(path, base).toString(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
  const supabase = await createSupabaseServerClient();
  if (!supabase) return fixedPages;

  const [productsResult, designersResult, storesResult] = await Promise.all([
    supabase.from("marketplace_products").select("slug, updated_at, media").eq("catalog_status", "published").order("published_at", { ascending: false }).limit(50000),
    supabase.from("designer_profiles").select("slug, updated_at").eq("status", "published").order("updated_at", { ascending: false }).limit(50000),
    supabase.from("stores").select("slug, updated_at").eq("status", "published").order("updated_at", { ascending: false }).limit(50000),
  ]);
  const data = productsResult.data ?? [];
  const products: MetadataRoute.Sitemap = data.map((product) => ({
    url: new URL(`/produtos/${encodeURIComponent(product.slug)}`, base).toString(),
    lastModified: product.updated_at,
    changeFrequency: "monthly",
    priority: 0.7,
    images: Array.isArray(product.media) ? product.media.filter((url): url is string => typeof url === "string" && url.startsWith("https://")) : undefined,
  }));
  const designers: MetadataRoute.Sitemap = (designersResult.data ?? []).map((designer) => ({
    url: new URL(`/designers/${encodeURIComponent(designer.slug)}`, base).toString(),
    lastModified: designer.updated_at,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  const stores: MetadataRoute.Sitemap = (storesResult.data ?? []).map((store) => ({
    url: new URL(`/lojas/${encodeURIComponent(store.slug)}`, base).toString(),
    lastModified: store.updated_at,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [...fixedPages, ...products, ...designers, ...stores];
}
