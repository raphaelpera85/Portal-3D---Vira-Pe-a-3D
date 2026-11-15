"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUnregisteredGitModelAssets } from "@/lib/creator-model-assets";
import { validateCreatorModelDetails, validateCreatorModelSubmission } from "@/lib/creator-model-input";
import { isCreatorModelPreviewPath, isCreatorModelUploadPath, normalizeCreatorModelPreview, normalizeCreatorModelUpload } from "@/lib/creator-model-upload";
import { modelShowcase } from "@/lib/model-showcase";
import { getUserWithRole } from "@/lib/auth-role.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const creatorModelBucket = "creator-model-uploads";

export type CreatorModelUploadResult = { success: true; message: string } | { success: false; message: string };
export type CreatorModelUploadPreparation = { success: true; upload: { id: string; path: string; name: string; size: number; token: string; preview: { path: string; token: string; contentType: string } | null } } | { success: false; message: string };

async function getCreatorModelSubmissionActor() {
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) return null;
  const { data: store } = await actor.supabase.from("stores").select("id, status")
    .eq("owner_user_id", actor.user.id).maybeSingle();
  return store?.status === "published" ? { actor, store } : null;
}

export async function prepareCreatorModelUpload(values: Record<string, string>, rawFile: { name: string; size: number; type?: string }, rawPreviewFile: { name: string; size: number; type?: string } | null = null): Promise<CreatorModelUploadPreparation> {
  if (!values || typeof values !== "object" || Array.isArray(values)) return { success: false, message: "Confira os dados e selecione um arquivo 3MF válido de até 50 MiB." };
  const details = validateCreatorModelDetails({ ...values, rightsConfirmed: values.rightsConfirmed === "true" ? "on" : values.rightsConfirmed });
  const file = normalizeCreatorModelUpload(rawFile);
  const preview = rawPreviewFile ? normalizeCreatorModelPreview(rawPreviewFile) : null;
  if (!details || !file || (rawPreviewFile && !preview)) return { success: false, message: "Confira os dados, o arquivo 3MF e a capa opcional." };
  const authorized = await getCreatorModelSubmissionActor();
  const admin = createSupabaseAdminClient();
  if (!authorized || !admin) return { success: false, message: "Entre em uma conta de vendedor com loja publicada para enviar modelos." };

  const id = randomBytes(6).toString("hex");
  const path = `${authorized.actor.user!.id}/${id}.3mf`;
  const previewPath = preview ? `${authorized.actor.user!.id}/${id}-preview.${preview.extension}` : null;
  const { error: insertError } = await admin.from("creator_model_submissions").insert({
    id, store_id: authorized.store.id, submitted_by: authorized.actor.user!.id, ...details,
    asset_path: null, storage_path: path, file_name: file.name, file_size_bytes: file.size,
    preview_path: previewPath, preview_size_bytes: preview?.size ?? null, preview_content_type: preview?.contentType ?? null,
    rights_confirmed_at: new Date().toISOString(), review_status: "uploading",
  });
  if (insertError) return { success: false, message: insertError.code === "23505" ? "Este arquivo já foi enviado." : "Não foi possível preparar o cadastro do modelo." };

  const [{ data, error }, previewUpload] = await Promise.all([
    admin.storage.from(creatorModelBucket).createSignedUploadUrl(path, { upsert: false }),
    previewPath ? admin.storage.from(creatorModelBucket).createSignedUploadUrl(previewPath, { upsert: false }) : Promise.resolve({ data: null, error: null }),
  ]);
  if (error || !data?.token || (previewPath && (previewUpload.error || !previewUpload.data?.token))) {
    await admin.from("creator_model_submissions").delete().eq("id", id).eq("submitted_by", authorized.actor.user!.id);
    return { success: false, message: "Não foi possível preparar o envio privado do arquivo." };
  }
  return { success: true, upload: { id, path, name: file.name, size: file.size, token: data.token,
    preview: previewPath && preview && previewUpload.data?.token ? { path: previewPath, token: previewUpload.data.token, contentType: preview.contentType } : null } };
}

export async function finalizeCreatorModelUpload(id: string): Promise<CreatorModelUploadResult> {
  if (!/^[a-f0-9]{12}$/.test(id)) return { success: false, message: "Cadastro de modelo inválido." };
  const authorized = await getCreatorModelSubmissionActor();
  const admin = createSupabaseAdminClient();
  if (!authorized || !admin) return { success: false, message: "Sua loja não está autorizada a concluir este envio." };
  const { data: row, error: rowError } = await admin.from("creator_model_submissions")
    .select("storage_path, file_name, file_size_bytes, review_status, preview_path, preview_size_bytes, preview_content_type, submitted_by").eq("id", id)
    .eq("submitted_by", authorized.actor.user!.id).maybeSingle();
  if (rowError || !row || row.review_status !== "uploading" || !row.storage_path
    || !isCreatorModelUploadPath(authorized.actor.user!.id, row.storage_path, id)) {
    return { success: false, message: "Este envio não está disponível para finalizar." };
  }
  const [modelInfo, previewInfo] = await Promise.all([
    admin.storage.from(creatorModelBucket).info(row.storage_path),
    row.preview_path && isCreatorModelPreviewPath(authorized.actor.user!.id, row.preview_path, id)
      ? admin.storage.from(creatorModelBucket).info(row.preview_path) : Promise.resolve(null),
  ]);
  if (modelInfo.error || !modelInfo.data || Number(modelInfo.data.size) !== Number(row.file_size_bytes)
    || (row.preview_path && (!previewInfo || previewInfo.error || !previewInfo.data || Number(previewInfo.data.size) !== Number(row.preview_size_bytes)))
    || (!row.preview_path && (row.preview_size_bytes != null || row.preview_content_type != null))) {
    return { success: false, message: "O arquivo não chegou completo ao armazenamento. Tente enviá-lo novamente." };
  }
  const { data, error } = await admin.from("creator_model_submissions").update({ review_status: "pending" })
    .eq("id", id).eq("submitted_by", authorized.actor.user!.id).eq("review_status", "uploading").select("id").maybeSingle();
  if (error || !data) return { success: false, message: "Não foi possível enviar o modelo para revisão." };
  revalidatePath("/admin/modelos");
  revalidatePath("/painel/maker");
  return { success: true, message: "Modelo enviado para revisão. Após a aprovação, ele aparece na coleção pública." };
}

export async function discardCreatorModelUpload(id: string) {
  if (!/^[a-f0-9]{12}$/.test(id)) return;
  const actor = await getUserWithRole("maker");
  const admin = createSupabaseAdminClient();
  if (!actor.supabase || !actor.user || !actor.authorized || !admin) return;
  const { data: row } = await admin.from("creator_model_submissions").select("storage_path, preview_path, review_status")
    .eq("id", id).eq("submitted_by", actor.user.id).maybeSingle();
  if (!row || row.review_status !== "uploading" || !row.storage_path || !isCreatorModelUploadPath(actor.user.id, row.storage_path, id)
    || (row.preview_path && !isCreatorModelPreviewPath(actor.user.id, row.preview_path, id))) return;
  const { error } = await admin.storage.from(creatorModelBucket).remove([row.storage_path, ...(row.preview_path ? [row.preview_path] : [])]);
  if (error) return;
  await admin.from("creator_model_submissions").delete().eq("id", id).eq("submitted_by", actor.user.id).eq("review_status", "uploading");
}

export async function submitCreatorModel(formData: FormData): Promise<never> {
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const [storeResult, existingResult] = await Promise.all([
    actor.supabase.from("stores").select("id, status").eq("owner_user_id", actor.user.id).maybeSingle(),
    actor.supabase.from("creator_model_submissions").select("asset_path").eq("submitted_by", actor.user.id),
  ]);
  const store = storeResult.data;
  if (storeResult.error || !store || store.status !== "published" || existingResult.error) redirect("/painel/maker?resultado=modelo-erro#modelos-3d");
  const staticAssets = modelShowcase.flatMap((model) => [model.filePath, ...(model.downloads ?? []).map(({ filePath }) => filePath)]);
  const availableAssets = getUnregisteredGitModelAssets([...(existingResult.data ?? []).map((row) => row.asset_path), ...staticAssets]);
  const input = validateCreatorModelSubmission(Object.fromEntries(formData), availableAssets);
  if (!input) redirect("/painel/maker?resultado=modelo-invalido#modelos-3d");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/painel/maker?resultado=modelo-erro#modelos-3d");
  const { error } = await admin.from("creator_model_submissions").insert({
    id: randomBytes(6).toString("hex"), store_id: store.id, submitted_by: actor.user.id,
    ...input, rights_confirmed_at: new Date().toISOString(), review_status: "pending",
  });
  if (error) redirect(`/painel/maker?resultado=${error.code === "23505" ? "modelo-duplicado" : "modelo-erro"}#modelos-3d`);
  revalidatePath("/admin");
  revalidatePath("/admin/modelos");
  redirect("/painel/maker?resultado=modelo-enviado#modelos-3d");
}
