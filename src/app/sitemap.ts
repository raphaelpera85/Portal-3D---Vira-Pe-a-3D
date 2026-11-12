import type { MetadataRoute } from "next";
import { modelShowcase } from "@/lib/model-showcase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const sitemapLimit = 50_000;
const pageSize = 1_000;

async function fetchRowsInPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
  limit: number,
) {
  const rows: T[] = [];
  for (let from = 0; from < limit; from += pageSize) {
    const { data } = await fetchPage(from, Math.min(from + pageSize - 1, limit - 1));
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  if (!base) return [];
  const fixedPages: MetadataRoute.Sitemap = ["", "/calculadora", "/catalogos", "/modelos", "/visualizador", "/lojas", "/designers"].map((path) => ({
    url: new URL(path, base).toString(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
  const modelPages: MetadataRoute.Sitemap = modelShowcase.map((model) => ({
    url: new URL(`/modelos/${encodeURIComponent(model.id)}`, base).toString(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [...fixedPages, ...modelPages];

  // Paginate within the database API row cap and keep the sitemap below Google's 50,000-URL limit.
  let remaining = Math.max(0, sitemapLimit - fixedPages.length - modelPages.length);
  const products = await fetchRowsInPages(
    (from, to) => supabase.from("marketplace_products").select("slug, updated_at, media")
      .eq("catalog_status", "published").order("slug").range(from, to), remaining,
  );
  remaining -= products.length;
  const designers = await fetchRowsInPages(
    (from, to) => supabase.from("designer_profiles").select("slug, updated_at")
      .eq("status", "published").order("slug").range(from, to), remaining,
  );
  remaining -= designers.length;
  const stores = await fetchRowsInPages(
    (from, to) => supabase.from("stores").select("slug, updated_at")
      .eq("status", "published").order("slug").range(from, to), remaining,
  );

  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: new URL(`/produtos/${encodeURIComponent(product.slug)}`, base).toString(),
    lastModified: product.updated_at,
    changeFrequency: "monthly",
    priority: 0.7,
    images: Array.isArray(product.media) ? product.media.filter((url): url is string => typeof url === "string" && url.startsWith("https://")) : undefined,
  }));
  const designerPages: MetadataRoute.Sitemap = designers.map((designer) => ({
    url: new URL(`/designers/${encodeURIComponent(designer.slug)}`, base).toString(),
    lastModified: designer.updated_at,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  const storePages: MetadataRoute.Sitemap = stores.map((store) => ({
    url: new URL(`/lojas/${encodeURIComponent(store.slug)}`, base).toString(),
    lastModified: store.updated_at,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [...fixedPages, ...modelPages, ...productPages, ...designerPages, ...storePages];
}
