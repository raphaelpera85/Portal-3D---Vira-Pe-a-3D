import "server-only";
import type { ShowcaseModel } from "./model-showcase";
import { modelShowcaseCategories } from "./model-showcase";
import { createSupabaseServerClient } from "./supabase/server";
import { fetchAllPages } from "./pagination";

type CreatorModelRow = {
  id: string; name: string; category_slug: string; asset_path: string; tags: string[];
  creator_name: string; source_url: string | null; created_at: string;
};

function toShowcaseModel(row: CreatorModelRow): ShowcaseModel | null {
  const category = modelShowcaseCategories.find(({ slug }) => slug === row.category_slug);
  if (!category || !/^models\/[a-z0-9]+(?:-[a-z0-9]+)*\.3mf$/.test(row.asset_path)
    || !/^[a-f0-9]{12}$/.test(row.id) || !Array.isArray(row.tags)) return null;
  return {
    id: row.id, name: row.name, category: category.name, categorySlug: category.slug,
    image: "/modelos/modelo-sem-imagem.svg", filePath: row.asset_path, tags: row.tags,
    creatorName: row.creator_name, sourceUrl: row.source_url ?? undefined,
  };
}

export async function loadPublishedCreatorModels(): Promise<ShowcaseModel[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await fetchAllPages((from, to) => supabase.from("creator_model_submissions")
    .select("id, name, category_slug, asset_path, tags, creator_name, source_url, created_at")
    .eq("review_status", "published").order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to));
  return error ? [] : (data ?? []).flatMap((row) => {
    const model = toShowcaseModel(row as CreatorModelRow);
    return model ? [model] : [];
  });
}

export async function loadPublishedCreatorModel(id: string): Promise<ShowcaseModel | null> {
  if (!/^[a-f0-9]{12}$/.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("creator_model_submissions")
    .select("id, name, category_slug, asset_path, tags, creator_name, source_url, created_at")
    .eq("id", id).eq("review_status", "published").maybeSingle();
  return error || !data ? null : toShowcaseModel(data as CreatorModelRow);
}
