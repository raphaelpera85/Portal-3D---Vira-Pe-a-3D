import "server-only";
import type { ShowcaseModel } from "./model-showcase";
import { modelShowcaseCategories } from "./model-showcase";
import { createSupabaseServerClient } from "./supabase/server";
import { createSupabaseAdminClient } from "./supabase/admin";
import { fetchAllPages } from "./pagination";
import { isCreatorModelUploadPath } from "./creator-model-upload";

type CreatorModelRow = {
  id: string; name: string; category_slug: string; asset_path: string | null; tags: string[];
  creator_name: string; source_url: string | null; created_at: string;
};

function toShowcaseModel(row: CreatorModelRow): ShowcaseModel | null {
  const category = modelShowcaseCategories.find(({ slug }) => slug === row.category_slug);
  if (!category || (row.asset_path !== null && !/^models\/[a-z0-9]+(?:-[a-z0-9]+)*\.3mf$/.test(row.asset_path))
    || !/^[a-f0-9]{12}$/.test(row.id) || !Array.isArray(row.tags)) return null;
  return {
    id: row.id, name: row.name, category: category.name, categorySlug: category.slug,
    image: "/modelos/modelo-sem-imagem.svg", filePath: row.asset_path ?? "", tags: row.tags,
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
  if (error || !data) return null;
  const model = toShowcaseModel(data as CreatorModelRow);
  if (!model || data.asset_path !== null) return model;
  const admin = createSupabaseAdminClient();
  if (!admin) return model;
  const { data: upload, error: uploadError } = await admin.from("creator_model_submissions")
    .select("storage_path, file_name, submitted_by").eq("id", data.id).eq("review_status", "published").maybeSingle();
  if (uploadError || !upload?.storage_path || typeof upload.file_name !== "string"
    || !isCreatorModelUploadPath(upload.submitted_by, upload.storage_path, data.id)) return model;
  const [preview, download] = await Promise.all([
    admin.storage.from("creator-model-uploads").createSignedUrl(upload.storage_path, 3600),
    admin.storage.from("creator-model-uploads").createSignedUrl(upload.storage_path, 3600, { download: upload.file_name }),
  ]);
  return {
    ...model,
    ...(preview.error || !preview.data?.signedUrl ? {} : { assetUrl: preview.data.signedUrl }),
    ...(download.error || !download.data?.signedUrl ? {} : { downloadUrl: download.data.signedUrl }),
  };
}
