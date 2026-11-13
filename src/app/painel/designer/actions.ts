"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateProductQuoteOffer } from "@/lib/marketplace-validation";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDesignerServiceDeliveryPath, normalizeDesignerServiceDeliveryFiles, type DesignerDeliveryFile } from "@/lib/designer-service-delivery";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type DesignerServiceQuoteState = { message: string; success: boolean };

export async function submitDesignerServiceQuote(
  _previous: DesignerServiceQuoteState,
  formData: FormData,
): Promise<DesignerServiceQuoteState> {
  const requestId = formData.get("requestId");
  const offer = validateProductQuoteOffer({
    totalBrl: formData.get("totalBrl"),
    leadDays: formData.get("leadDays"),
    terms: formData.get("terms"),
  });
  if (typeof requestId !== "string" || !uuidPattern.test(requestId) || !offer || offer.terms.trim().length < 20) {
    return { message: "Informe um valor, prazo e escopo de entrega válidos.", success: false };
  }

  const actor = await getUserWithRole("designer");
  if (!actor.supabase || !actor.user) return { message: "Entre na conta para responder ao pedido.", success: false };
  if (!actor.authorized) return { message: "Esta conta não tem acesso ao painel de designers.", success: false };

  const { error } = await actor.supabase.rpc("submit_designer_service_quote", {
    p_request_id: requestId,
    p_amount_cents: Math.round(offer.totalBrl * 100),
    p_lead_days: offer.leadDays,
    p_notes: offer.terms,
  });
  if (error) return { message: "Não foi possível enviar a proposta. Confira se o pedido continua aberto.", success: false };

  revalidatePath("/painel/designer");
  revalidatePath("/conta/modelagem");
  return { message: "Proposta enviada ao comprador. Ele pode aceitar e pagar pelo checkout do portal.", success: true };
}

export async function advanceDesignerServiceWork(formData: FormData): Promise<void> {
  const requestId = formData.get("requestId");
  const nextStatus = formData.get("nextStatus");
  if (typeof requestId !== "string" || !uuidPattern.test(requestId)
    || nextStatus !== "in_progress") redirect("/painel/designer?resultado=modelagem-erro");
  const actor = await getUserWithRole("designer");
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("advance_designer_service_work", {
    p_request_id: requestId,
    p_next_status: nextStatus,
  });
  if (error) redirect("/painel/designer?resultado=modelagem-erro");
  revalidatePath("/painel/designer");
  revalidatePath("/conta/modelagem");
  redirect("/painel/designer?resultado=modelagem-iniciada");
}

const deliveryBucket = "designer-service-deliveries";
type DeliveryUpload = { name: string; size: number; extension: string; path: string };

async function getInProgressDesignerService(requestId: string) {
  if (!uuidPattern.test(requestId)) return null;
  const actor = await getUserWithRole("designer");
  if (!actor.supabase || !actor.user || !actor.authorized) return null;
  const { data: request } = await actor.supabase.from("designer_service_requests")
    .select("id, status, designer_profile_id").eq("id", requestId).eq("status", "in_progress").maybeSingle();
  if (!request) return null;
  const { data: profile } = await actor.supabase.from("designer_profiles").select("id")
    .eq("id", request.designer_profile_id).eq("user_id", actor.user.id).maybeSingle();
  return profile ? { actor, request } : null;
}

export type DesignerDeliveryUploadsResult = { success: true; uploads: (DeliveryUpload & { type?: string; token: string })[] } | { success: false; message: string };
export async function createDesignerServiceDeliveryUploads(requestId: string, files: DesignerDeliveryFile[]): Promise<DesignerDeliveryUploadsResult> {
  const normalized = normalizeDesignerServiceDeliveryFiles(files);
  if (!normalized) return { success: false, message: "Selecione de 1 a 10 arquivos 3D compatíveis, com até 50 MiB cada e 100 MiB no total." };
  const authorized = await getInProgressDesignerService(requestId);
  const admin = createSupabaseAdminClient();
  if (!authorized || !admin) return { success: false, message: "Este pedido não está disponível para envio ou o armazenamento privado não está configurado." };

  const uploads = normalized.map((file) => ({ ...file, path: `${requestId}/${randomUUID()}.${file.extension}` }));
  const signedUploads: (typeof uploads[number] & { token: string })[] = [];
  for (const upload of uploads) {
    const { data, error } = await admin.storage.from(deliveryBucket).createSignedUploadUrl(upload.path, { upsert: false });
    if (error || !data?.token) {
      await admin.storage.from(deliveryBucket).remove(uploads.map(({ path }) => path));
      return { success: false, message: "Não foi possível preparar o envio privado. Tente novamente." };
    }
    signedUploads.push({ ...upload, token: data.token });
  }
  const { error } = await admin.from("designer_service_delivery_uploads").insert(uploads.map(({ path, name, size, extension }) => ({
    storage_path: path, request_id: requestId, created_by: authorized.actor.user!.id, file_name: name, file_size: size, extension,
  })));
  if (error) {
    await admin.storage.from(deliveryBucket).remove(uploads.map(({ path }) => path));
    return { success: false, message: "Não foi possível registrar os arquivos temporários. Tente novamente." };
  }
  return { success: true, uploads: signedUploads };
}

export async function discardDesignerServiceDeliveryUploads(requestId: string, paths: string[]) {
  const authorized = await getInProgressDesignerService(requestId);
  const admin = createSupabaseAdminClient();
  if (!authorized || !admin || !Array.isArray(paths) || paths.length > 10
    || paths.some((path) => !isDesignerServiceDeliveryPath(requestId, path))) return;
  const { data: staged } = await admin.from("designer_service_delivery_uploads").select("storage_path")
    .eq("request_id", requestId).eq("created_by", authorized.actor.user!.id).in("storage_path", paths);
  const ownedPaths = (staged ?? []).map(({ storage_path }) => storage_path);
  if (ownedPaths.length) {
    const { error } = await admin.storage.from(deliveryBucket).remove(ownedPaths);
    if (!error) await admin.from("designer_service_delivery_uploads").delete().in("storage_path", ownedPaths)
      .eq("request_id", requestId).eq("created_by", authorized.actor.user!.id);
  }
}

export async function submitDesignerServiceDelivery(requestId: string, notes: string, files: DeliveryUpload[]) {
  const normalized = Array.isArray(files) ? normalizeDesignerServiceDeliveryFiles(files) : null;
  if (!uuidPattern.test(requestId) || typeof notes !== "string" || notes.length > 2000 || !normalized
    || files.some((file) => !isDesignerServiceDeliveryPath(requestId, file.path))) {
    return { success: false, message: "Confira as observações e os arquivos antes de enviar a entrega." };
  }
  const authorized = await getInProgressDesignerService(requestId);
  if (!authorized) return { success: false, message: "Este pedido não está mais disponível para entrega." };
  const { error } = await authorized.actor.supabase!.rpc("submit_designer_service_delivery", {
    p_request_id: requestId,
    p_notes: notes,
    p_files: files.map(({ path, name, size, extension }) => ({ path, name, size, extension })),
  });
  if (error) return { success: false, message: "A entrega não foi concluída. Os arquivos continuam disponíveis para tentar novamente." };
  revalidatePath("/painel/designer");
  revalidatePath("/conta/modelagem");
  return { success: true, message: "Entrega enviada ao comprador." };
}
