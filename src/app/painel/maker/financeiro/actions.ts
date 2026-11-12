"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { getMercadoPagoSellerAccessToken } from "@/lib/mercado-pago-access-token.server";
import { mapMercadoPagoOrderStatus } from "@/lib/mercado-pago-payments";
import { parseRefundAmountCents, prepareMercadoPagoRefund } from "@/lib/mercado-pago-refunds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function feedback(code: string): never {
  redirect(`/painel/maker/financeiro?resultado=${code}`);
}
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function finishRefund(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, refundId: string, status: "pending" | "processed" | "failed", providerStatus: string) {
  await admin.rpc("complete_seller_order_refund", {
    p_refund_id: refundId, p_status: status, p_provider_status: providerStatus.slice(0, 120),
  });
}

export async function refundSellerOrderPayment(formData: FormData): Promise<void> {
  const paymentId = formData.get("paymentId");
  const amount = formData.get("amount");
  const idempotencyKey = formData.get("idempotencyKey");
  if (typeof paymentId !== "string" || !uuidPattern.test(paymentId) || typeof amount !== "string"
    || typeof idempotencyKey !== "string" || !uuidPattern.test(idempotencyKey) || formData.get("confirmRefund") !== "yes") {
    feedback("reembolso-dados-invalidos");
  }

  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) feedback("reembolso-acesso-negado");
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) feedback("reembolso-acesso-negado");
  const { data: payment } = await actor.supabase.from("seller_order_payments")
    .select("id, store_id, total_cents, marketplace_fee_cents, provider_order_id, status")
    .eq("id", paymentId).eq("store_id", store.id).maybeSingle();
  if (!payment || !payment.provider_order_id || !["paid", "partially_refunded"].includes(payment.status)) feedback("reembolso-indisponivel");
  const amountCents = parseRefundAmountCents(amount, Number(payment.total_cents));
  if (!amountCents) feedback("reembolso-valor-invalido");

  const admin = createSupabaseAdminClient();
  if (!admin) feedback("reembolso-configurar");
  const { data: reservationData, error: reservationError } = await admin.rpc("reserve_seller_order_refund", {
    p_payment_id: payment.id, p_maker_id: actor.user.id, p_amount_cents: amountCents, p_idempotency_key: idempotencyKey,
  });
  if (reservationError) {
    const message = reservationError.message.includes("exceeds the remaining payment") ? "reembolso-valor-invalido"
      : reservationError.message.includes("awaiting provider confirmation") ? "reembolso-pendente" : "reembolso-indisponivel";
    feedback(message);
  }
  const reservation = Array.isArray(reservationData) ? reservationData[0] : reservationData;
  if (!reservation || typeof reservation.refund_id !== "string" || typeof reservation.refund_status !== "string"
    || typeof reservation.refund_idempotency_key !== "string") feedback("reembolso-indisponivel");
  if (reservation.refund_status === "processed") feedback("reembolso-enviado");
  if (reservation.refund_status === "failed") feedback("reembolso-falhou");

  let accessToken: string;
  try { accessToken = await getMercadoPagoSellerAccessToken(payment.store_id); }
  catch { await finishRefund(admin, reservation.refund_id, "pending", "seller_token_unavailable"); feedback("reembolso-pendente"); }

  const { data: connection, error: connectionError } = await admin.from("store_payment_connections")
    .select("provider_user_id").eq("store_id", payment.store_id).maybeSingle();
  if (connectionError || !connection) {
    await finishRefund(admin, reservation.refund_id, "pending", "seller_connection_unavailable");
    feedback("reembolso-pendente");
  }
  const expected = {
    id: payment.provider_order_id, paymentId: payment.id, sellerId: connection.provider_user_id,
    totalCents: Number(payment.total_cents), marketplaceFeeCents: Number(payment.marketplace_fee_cents),
  };

  let orderResponse: Response;
  try {
    orderResponse = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(payment.provider_order_id)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
    });
  } catch {
    await finishRefund(admin, reservation.refund_id, "pending", "provider_order_unavailable");
    feedback("reembolso-pendente");
  }
  if (!orderResponse.ok) {
    await finishRefund(admin, reservation.refund_id, orderResponse.status < 500 && orderResponse.status !== 429 ? "failed" : "pending", `provider_order_http_${orderResponse.status}`);
    feedback(orderResponse.status < 500 && orderResponse.status !== 429 ? "reembolso-falhou" : "reembolso-pendente");
  }
  const order = asObject(await orderResponse.json().catch(() => null));
  const prepared = prepareMercadoPagoRefund(order, expected, Number(reservation.refund_amount_cents), Number(reservation.refund_available_cents));
  if (!prepared) {
    await finishRefund(admin, reservation.refund_id, "failed", "provider_order_not_refundable");
    feedback("reembolso-indisponivel");
  }

  let providerResponse: Response;
  try {
    providerResponse = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(payment.provider_order_id)}/refund`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "X-Idempotency-Key": reservation.refund_idempotency_key,
        ...(prepared.body ? { "Content-Type": "application/json" } : {}) },
      ...(prepared.body ? { body: JSON.stringify(prepared.body) } : {}),
      signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
    });
  } catch {
    await finishRefund(admin, reservation.refund_id, "pending", "provider_refund_outcome_unknown");
    feedback("reembolso-pendente");
  }

  const refundOrder = asObject(await providerResponse.json().catch(() => null));
  const refundStatus = typeof refundOrder.status === "string" ? refundOrder.status : "";
  const statusDetail = typeof refundOrder.status_detail === "string" ? refundOrder.status_detail : "";
  const mappedStatus = mapMercadoPagoOrderStatus(refundStatus, statusDetail);
  if (providerResponse.ok && refundOrder.id === payment.provider_order_id
    && (mappedStatus === "partially_refunded" || mappedStatus === "refunded")) {
    const providerStatus = statusDetail ? `${refundStatus}:${statusDetail}` : refundStatus;
    const { error: completeError } = await admin.rpc("complete_seller_order_refund", {
      p_refund_id: reservation.refund_id, p_status: "processed", p_provider_status: providerStatus,
    });
    if (completeError) feedback("reembolso-pendente");
    const { error: paymentStatusError } = await admin.rpc("record_seller_order_payment_status", {
      p_payment_id: payment.id, p_provider_order_id: payment.provider_order_id,
      p_provider_status: providerStatus, p_status: mappedStatus,
    });
    if (paymentStatusError) feedback("reembolso-pendente");
    revalidatePath("/painel/maker/financeiro");
    revalidatePath("/painel/maker");
    revalidatePath("/orcamentos");
    feedback("reembolso-enviado");
  }

  if (!providerResponse.ok && providerResponse.status < 500 && providerResponse.status !== 429) {
    await finishRefund(admin, reservation.refund_id, "failed", `provider_refund_http_${providerResponse.status}`);
    feedback("reembolso-falhou");
  }
  await finishRefund(admin, reservation.refund_id, "pending", statusDetail ? `${refundStatus}:${statusDetail}` : "provider_refund_outcome_unknown");
  feedback("reembolso-pendente");
}
