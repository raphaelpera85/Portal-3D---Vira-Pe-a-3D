import "server-only";

import { getMercadoPagoSellerAccessToken } from "@/lib/mercado-pago-access-token.server";
import { isMercadoPagoOrderForPayment, mapMercadoPagoOrderStatus } from "@/lib/mercado-pago-payments";
import { prepareMercadoPagoRefundRetry } from "@/lib/mercado-pago-refunds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const asObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
type ReconcileResult = "processed" | "failed" | "deferred";

async function finishRefund(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, refundId: string, status: "processed" | "failed", providerStatus: string) {
  const { error } = await admin.rpc("complete_seller_order_refund", {
    p_refund_id: refundId, p_status: status, p_provider_status: providerStatus.slice(0, 120),
  });
  return !error;
}

async function reconcileRefund(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, refund: {
  id: string; payment_id: string; amount_cents: number; idempotency_key: string;
}): Promise<ReconcileResult> {
  try {
    const { data: payment, error: paymentError } = await admin.from("seller_order_payments")
      .select("id, store_id, total_cents, marketplace_fee_cents, provider_order_id")
      .eq("id", refund.payment_id).maybeSingle();
    if (paymentError || !payment?.provider_order_id) return "deferred";
    const { data: refunds, error: refundsError } = await admin.from("seller_order_refunds")
      .select("amount_cents, status").eq("payment_id", payment.id);
    if (refundsError || !refunds) return "deferred";
    const amountCents = Number(refund.amount_cents);
    const reservedCents = refunds.filter((item) => item.status === "pending" || item.status === "processed")
      .reduce((sum, item) => sum + Number(item.amount_cents), 0);
    const availableCents = Number(payment.total_cents) - reservedCents + amountCents;
    if (!Number.isSafeInteger(amountCents) || !Number.isSafeInteger(availableCents) || amountCents < 1 || amountCents > availableCents) return "deferred";
    const { data: connection, error: connectionError } = await admin.from("store_payment_connections")
      .select("provider_user_id").eq("store_id", payment.store_id).maybeSingle();
    if (connectionError || !connection) return "deferred";
    const accessToken = await getMercadoPagoSellerAccessToken(payment.store_id);
    const expected = {
      id: payment.provider_order_id, paymentId: payment.id, sellerId: connection.provider_user_id,
      totalCents: Number(payment.total_cents), marketplaceFeeCents: Number(payment.marketplace_fee_cents),
    };
    const orderUrl = `https://api.mercadopago.com/v1/orders/${encodeURIComponent(payment.provider_order_id)}`;
    const orderResponse = await fetch(orderUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
    });
    if (!orderResponse.ok) {
      if (orderResponse.status < 500 && orderResponse.status !== 409 && orderResponse.status !== 429) {
        return await finishRefund(admin, refund.id, "failed", `reconcile_order_http_${orderResponse.status}`) ? "failed" : "deferred";
      }
      return "deferred";
    }
    const order = asObject(await orderResponse.json().catch(() => null));
    if (!isMercadoPagoOrderForPayment(order, expected) || order.status === "charged_back") return "deferred";
    const prepared = prepareMercadoPagoRefundRetry(order, expected, amountCents, availableCents);
    if (!prepared) return "deferred";

    const providerResponse = await fetch(`${orderUrl}/refund`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "X-Idempotency-Key": refund.idempotency_key,
        ...(prepared.body ? { "Content-Type": "application/json" } : {}) },
      ...(prepared.body ? { body: JSON.stringify(prepared.body) } : {}),
      signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
    });
    const result = asObject(await providerResponse.json().catch(() => null));
    const providerStatus = typeof result.status === "string" && typeof result.status_detail === "string"
      ? `${result.status}:${result.status_detail}` : typeof result.status === "string" ? result.status : "reconciliation_outcome_unknown";
    const mappedStatus = typeof result.status === "string" ? mapMercadoPagoOrderStatus(result.status, typeof result.status_detail === "string" ? result.status_detail : "") : null;
    if (providerResponse.ok && result.id === payment.provider_order_id && ["partially_refunded", "refunded"].includes(mappedStatus ?? "")) {
      const { error } = await admin.rpc("record_seller_order_payment_status", {
        p_payment_id: payment.id, p_provider_order_id: payment.provider_order_id,
        p_provider_status: providerStatus.slice(0, 80), p_status: mappedStatus,
      });
      if (error) return "deferred";
      return await finishRefund(admin, refund.id, "processed", providerStatus) ? "processed" : "deferred";
    }
    if (providerResponse.status === 409 || providerResponse.status === 429 || providerResponse.status >= 500) return "deferred";
    if (providerResponse.status < 500) return await finishRefund(admin, refund.id, "failed", `reconcile_refund_http_${providerResponse.status}`) ? "failed" : "deferred";
    return "deferred";
  } catch {
    return "deferred";
  }
}

export async function reconcilePendingSellerRefunds() {
  const admin = createSupabaseAdminClient();
  if (!admin) return { scanned: 0, processed: 0, failed: 0, deferred: 0, error: "payment_service_not_configured" };
  const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data, error } = await admin.from("seller_order_refunds")
    .select("id, payment_id, amount_cents, idempotency_key")
    .eq("status", "pending").lt("updated_at", staleBefore).order("updated_at").limit(8);
  if (error) return { scanned: 0, processed: 0, failed: 0, deferred: 0, error: "refund_queue_unavailable" };
  let processed = 0;
  let failed = 0;
  let deferred = 0;
  for (let index = 0; index < (data ?? []).length; index += 4) {
    const results = await Promise.all((data ?? []).slice(index, index + 4).map((refund) => reconcileRefund(admin, refund)));
    processed += results.filter((result) => result === "processed").length;
    failed += results.filter((result) => result === "failed").length;
    deferred += results.filter((result) => result === "deferred").length;
  }
  return { scanned: data?.length ?? 0, processed, failed, deferred };
}
