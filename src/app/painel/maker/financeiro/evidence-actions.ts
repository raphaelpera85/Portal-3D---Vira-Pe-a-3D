"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getUserWithRole } from "@/lib/auth-role.server";
import { getMercadoPagoSellerAccessToken } from "@/lib/mercado-pago-access-token.server";
import { isChargebackEvidenceBytes, isChargebackEvidencePath, sanitizeChargebackEvidenceFilename, validateChargebackEvidence } from "@/lib/chargeback-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bucket = "chargeback-evidence";
const caseIdPattern = /^\d{1,30}$/;
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
type EvidenceFileInput = { name: string; type: string; size: number };
type EvidenceUpload = EvidenceFileInput & { path: string; token: string };
type EvidenceUploadInput = EvidenceFileInput & { path: string };
type EvidenceResult = { success: true; message: string } | { success: false; message: string };
type EvidenceUploadsResult = { success: true; message: string; idempotencyKey: string; uploads: EvidenceUpload[] }
  | { success: false; message: string };

async function getAuthorizedChargeback(caseId: string) {
  if (typeof caseId !== "string" || !caseIdPattern.test(caseId)) return null;
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) return null;
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) return null;
  const { data: chargeback } = await actor.supabase.from("seller_order_chargebacks")
    .select("case_id, documentation_status").eq("case_id", caseId).eq("store_id", store.id).maybeSingle();
  if (!chargeback) return null;
  return { actor, store, chargeback };
}

export async function createChargebackEvidenceUploads(caseId: string, files: EvidenceFileInput[]): Promise<EvidenceUploadsResult> {
  if (!Array.isArray(files) || validateChargebackEvidence(files)) return { success: false, message: "Selecione até 10 arquivos JPG, PNG ou PDF, totalizando no máximo 10 MB." };
  const authorized = await getAuthorizedChargeback(caseId);
  if (!authorized) return { success: false, message: "Esta contestação não está disponível para esta loja." };
  if (authorized.chargeback.documentation_status !== "pending") return { success: false, message: "O prazo de envio foi encerrado ou os documentos já foram enviados." };
  const admin = createSupabaseAdminClient();
  if (!admin) return { success: false, message: "O armazenamento privado ainda não está configurado." };

  const uploads: EvidenceUpload[] = [];
  for (const file of files) {
    const extension = file.name.split(".").at(-1)!.toLowerCase();
    const path = `${authorized.store.id}/${caseId}/${randomUUID()}.${extension}`;
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path, { upsert: false });
    if (error || !data?.token) {
      if (uploads.length) await admin.storage.from(bucket).remove(uploads.map((upload) => upload.path));
      return { success: false, message: "Não foi possível preparar o envio privado. Tente novamente." };
    }
    uploads.push({ ...file, path, token: data.token });
  }
  const { error: stagingError } = await admin.from("seller_order_chargeback_evidence_uploads").insert(uploads.map(({ path, name, type, size }) => ({
    object_path: path, case_id: caseId, store_id: authorized.store.id, file_name: name, mime_type: type, file_size: size,
  })));
  if (stagingError) {
    await admin.storage.from(bucket).remove(uploads.map((upload) => upload.path));
    return { success: false, message: "Não foi possível registrar os arquivos temporários. Tente novamente." };
  }
  return { success: true, message: "", idempotencyKey: randomUUID(), uploads };
}

export async function discardChargebackEvidenceUploads(caseId: string, paths: string[]): Promise<void> {
  const authorized = await getAuthorizedChargeback(caseId);
  const admin = createSupabaseAdminClient();
  if (!authorized || !admin || !Array.isArray(paths) || paths.length > 10
    || paths.some((path) => typeof path !== "string" || !isChargebackEvidencePath(path, authorized.store.id, caseId))) return;
  const { error } = await admin.storage.from(bucket).remove(paths);
  if (!error) await admin.from("seller_order_chargeback_evidence_uploads").delete().in("object_path", paths)
    .eq("case_id", caseId).eq("store_id", authorized.store.id);
}

export async function submitChargebackEvidence(caseId: string, idempotencyKey: string, uploads: EvidenceUploadInput[]): Promise<EvidenceResult> {
  const keyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof idempotencyKey !== "string" || !keyPattern.test(idempotencyKey) || !Array.isArray(uploads)
    || uploads.some((upload) => !upload || typeof upload.path !== "string")) {
    return { success: false, message: "Os comprovantes selecionados são inválidos ou excedem os limites aceitos." };
  }
  const files = uploads.map(({ name, type, size }) => ({ name, type, size }));
  if (validateChargebackEvidence(files)) return { success: false, message: "Os comprovantes selecionados são inválidos ou excedem os limites aceitos." };
  const authorized = await getAuthorizedChargeback(caseId);
  if (!authorized) return { success: false, message: "Esta contestação não está disponível para esta loja." };
  if (authorized.chargeback.documentation_status !== "pending") return { success: false, message: "Esta contestação já não aceita novos documentos." };
  const paths = uploads.map((file) => file.path);
  if (uploads.some((file) => !isChargebackEvidencePath(file.path, authorized.store.id, caseId)) || new Set(paths).size !== paths.length) {
    return { success: false, message: "Os arquivos temporários não correspondem a esta contestação." };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return { success: false, message: "O serviço de documentos ainda não está configurado." };
  const { data: stagedFiles, error: stagingError } = await admin.from("seller_order_chargeback_evidence_uploads")
    .select("object_path, file_name, mime_type, file_size").eq("case_id", caseId).eq("store_id", authorized.store.id).in("object_path", paths);
  if (stagingError || !stagedFiles || stagedFiles.length !== uploads.length
    || uploads.some((upload) => !stagedFiles.some((staged) => staged.object_path === upload.path
      && staged.file_name === upload.name && staged.mime_type === upload.type && Number(staged.file_size) === upload.size))) {
    return { success: false, message: "Prepare novamente os arquivos antes de enviá-los." };
  }
  const { data: connection, error: connectionError } = await admin.from("store_payment_connections")
    .select("provider_user_id").eq("store_id", authorized.store.id).maybeSingle();
  if (connectionError || !connection || !/^\d{1,30}$/.test(connection.provider_user_id)) return { success: false, message: "Conecte novamente a conta Mercado Pago da loja." };

  let accessToken: string;
  try { accessToken = await getMercadoPagoSellerAccessToken(authorized.store.id); }
  catch { return { success: false, message: "Não foi possível acessar a conta Mercado Pago conectada." }; }
  const caseUrl = `https://api.mercadopago.com/v1/chargebacks/${caseId}`;
  let caseResponse: Response;
  try {
    caseResponse = await fetch(caseUrl, { headers: { Authorization: `Bearer ${accessToken}`, "X-Caller-Id": connection.provider_user_id },
      signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error" });
  } catch { return { success: false, message: "O Mercado Pago não respondeu. Seus arquivos continuam prontos para tentar novamente." }; }
  if (!caseResponse.ok) return { success: false, message: "Não foi possível confirmar a situação da contestação no Mercado Pago." };
  const remoteCase = asObject(await caseResponse.json().catch(() => null));
  if (remoteCase.id !== caseId || remoteCase.documentation_status !== "pending") {
    const status = typeof remoteCase.documentation_status === "string" ? remoteCase.documentation_status : "";
    if (["pending", "review_pending", "valid", "invalid", "not_supplied", "not_applicable"].includes(status)) {
      await admin.from("seller_order_chargebacks").update({ documentation_status: status, updated_at: new Date().toISOString() })
        .eq("case_id", caseId).eq("store_id", authorized.store.id);
    }
    const { error: cleanupError } = await admin.storage.from(bucket).remove(paths);
    if (!cleanupError) await admin.from("seller_order_chargeback_evidence_uploads").delete().in("object_path", paths);
    return { success: false, message: "O Mercado Pago informa que esta contestação já não aceita documentos." };
  }
  const deadline = typeof remoteCase.date_documentation_deadline === "string" ? Date.parse(remoteCase.date_documentation_deadline) : NaN;
  if (Number.isFinite(deadline) && deadline <= Date.now()) {
    const { error: cleanupError } = await admin.storage.from(bucket).remove(paths);
    if (!cleanupError) await admin.from("seller_order_chargeback_evidence_uploads").delete().in("object_path", paths);
    return { success: false, message: "O prazo indicado pelo Mercado Pago para esta contestação já terminou." };
  }
  const formData = new FormData();
  let totalBytes = 0;
  for (const file of uploads) {
    const { data, error } = await admin.storage.from(bucket).download(file.path);
    if (error || !data || data.size !== file.size) return { success: false, message: "Um comprovante enviado não está disponível. Prepare os arquivos novamente." };
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (!isChargebackEvidenceBytes(file.type, bytes)) return { success: false, message: "Um arquivo não corresponde ao formato informado. Remova-o e selecione um JPEG, PNG ou PDF válido." };
    totalBytes += bytes.byteLength;
    if (totalBytes > 10 * 1024 * 1024) return { success: false, message: "O conjunto de comprovantes excede 10 MB." };
    formData.append("file", new Blob([bytes], { type: file.type }), sanitizeChargebackEvidenceFilename(file.name));
  }

  let providerResponse: Response;
  try {
    providerResponse = await fetch(`${caseUrl}/documentation`, { method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "X-Caller-Id": connection.provider_user_id, "X-Idempotency-Key": idempotencyKey },
      body: formData, signal: AbortSignal.timeout(20000), cache: "no-store", redirect: "error" });
  } catch { return { success: false, message: "Não foi possível confirmar o envio. Reenvie o mesmo conjunto para repetir com segurança." }; }
  if (!providerResponse.ok) return { success: false, message: "O Mercado Pago não aceitou os comprovantes. Confira os arquivos e tente novamente." };

  const now = new Date().toISOString();
  const { error: updateError } = await admin.from("seller_order_chargebacks").update({
    documentation_status: "review_pending", documents_sent_at: now, documents_count: files.length, provider_updated_at: now, updated_at: now,
  }).eq("case_id", caseId).eq("store_id", authorized.store.id).eq("documentation_status", "pending");
  const { error: cleanupError } = await admin.storage.from(bucket).remove(paths);
  if (!cleanupError) await admin.from("seller_order_chargeback_evidence_uploads").delete().in("object_path", paths);
  revalidatePath("/painel/maker/financeiro");
  return { success: true, message: updateError
    ? "Os comprovantes foram enviados ao Mercado Pago. Atualize a tela para sincronizar o status."
    : "Comprovantes enviados ao Mercado Pago e encaminhados para análise." };
}
