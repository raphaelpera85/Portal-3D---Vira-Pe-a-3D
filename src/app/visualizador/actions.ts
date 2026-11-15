"use server";

import { revalidatePath } from "next/cache";
import { getUserWithRole } from "@/lib/auth-role.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { prepareModelUploadFiles, type ModelUploadFile } from "@/lib/model-upload";
import { getModelFormat } from "@/lib/model-file";

const buyerModelBucket = "buyer-models";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BuyerModelUploadPreparation =
  | { success: true; uploads: Array<{ path: string; storageName: string; token: string }> }
  | { success: false; message: string };

export async function prepareBuyerModelUpload(bundleId: string, modelName: string, files: ModelUploadFile[]): Promise<BuyerModelUploadPreparation> {
  if (!uuidPattern.test(bundleId) || typeof modelName !== "string" || !Array.isArray(files)
    || files.some((file) => !file || typeof file.name !== "string" || typeof file.storage_name !== "string"
      || !Number.isSafeInteger(file.size) || file.size < 1)) return { success: false, message: "Conjunto de arquivos inválido." };
  const prepared = prepareModelUploadFiles(files.map(({ name, size }) => ({ name, size, type: "application/octet-stream" })));
  if (prepared.error || !prepared.files || JSON.stringify(prepared.files) !== JSON.stringify(files)
    || prepared.files.find((file) => getModelFormat(file.name))?.name !== modelName) {
    return { success: false, message: "Selecione um modelo válido e arquivos associados de até 20 MiB." };
  }

  const actor = await getUserWithRole("buyer");
  const admin = createSupabaseAdminClient();
  if (!actor.supabase || !actor.user || !actor.authorized || !admin) {
    return { success: false, message: "Entre em uma conta de comprador para salvar modelos privados." };
  }

  const totalBytes = prepared.files.reduce((sum, file) => sum + file.size, 0);
  const { error: reserveError } = await actor.supabase.rpc("reserve_buyer_model_upload", {
    p_bundle_id: bundleId, p_model_name: modelName, p_total_bytes: totalBytes, p_files: prepared.files,
  });
  if (reserveError) return { success: false, message: "Limite de cinco conjuntos em 24 horas atingido ou reserva indisponível. Tente novamente mais tarde." };

  const signedUploads = await Promise.all(prepared.files.map(async (file) => {
    const path = `${actor.user!.id}/${bundleId}/${file.storage_name}`;
    const { data, error } = await admin.storage.from(buyerModelBucket).createSignedUploadUrl(path, { upsert: false });
    return error || !data?.token ? null : { path, storageName: file.storage_name, token: data.token };
  }));
  if (signedUploads.some((upload) => !upload)) {
    await actor.supabase.rpc("release_buyer_model_upload_reservation", { p_bundle_id: bundleId });
    return { success: false, message: "Não foi possível preparar o envio privado dos arquivos." };
  }
  return { success: true, uploads: signedUploads as Array<{ path: string; storageName: string; token: string }> };
}

export async function releaseBuyerModelUploadReservation(bundleId: string) {
  if (!uuidPattern.test(bundleId)) return;
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) return;
  await actor.supabase.rpc("release_buyer_model_upload_reservation", { p_bundle_id: bundleId });
}

export async function deleteBuyerModelUpload(uploadId: string) {
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) return { success: false, message: "Entre em uma conta de comprador para excluir o modelo." };
  const admin = createSupabaseAdminClient();
  if (!admin) return { success: false, message: "A exclusão segura de arquivos não está configurada." };
  const { data: upload } = await actor.supabase.from("buyer_model_uploads").select("bundle_id, files").eq("id", uploadId).eq("buyer_id", actor.user.id).maybeSingle();
  if (!upload) return { success: false, message: "O modelo não está disponível para exclusão." };
  const { error } = await actor.supabase.rpc("delete_buyer_model_upload", { p_upload_id: uploadId });
  if (error) return { success: false, message: "Não foi possível excluir: o modelo pode estar vinculado a uma solicitação ativa." };
  const paths = (upload.files as { storage_name: string }[]).map(({ storage_name }) => `${actor.user!.id}/${upload.bundle_id}/${storage_name}`);
  const { error: storageError } = await admin.storage.from("buyer-models").remove(paths);
  revalidatePath("/visualizador");
  return storageError
    ? { success: false, message: "O registro foi excluído, mas alguns arquivos privados não puderam ser removidos. Tente novamente mais tarde." }
    : { success: true, message: "Conjunto excluído da biblioteca." };
}
