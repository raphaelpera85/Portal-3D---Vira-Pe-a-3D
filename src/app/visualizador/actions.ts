"use server";

import { revalidatePath } from "next/cache";
import { getUserWithRole } from "@/lib/auth-role.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
