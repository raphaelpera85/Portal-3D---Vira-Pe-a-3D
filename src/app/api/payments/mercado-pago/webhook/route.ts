import { getMercadoPagoSellerAccessToken } from "@/lib/mercado-pago-access-token.server";
import { isMercadoPagoOrderForPayment, mapMercadoPagoOrderStatus, verifyMercadoPagoWebhookSignature } from "@/lib/mercado-pago-payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

const asObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export async function POST(request: Request) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  const admin = createSupabaseAdminClient();
  if (!secret || !admin) return Response.json({ error: "payment_webhook_not_configured" }, { status: 503 });
  const url = new URL(request.url);
  const eventType = url.searchParams.get("type");
  if (eventType && !["order", "orders_v2"].includes(eventType)) return new Response(null, { status: 200 });
  const orderId = url.searchParams.get("data.id");
  const signature = request.headers.get("x-signature") ?? "";
  const requestId = request.headers.get("x-request-id") ?? "";
  if (!orderId || !/^[a-zA-Z0-9_-]{1,100}$/.test(orderId)
    || !verifyMercadoPagoWebhookSignature(signature, requestId, orderId, secret)) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  const { data: payment, error: paymentError } = await admin.from("seller_order_payments")
    .select("id, store_id, buyer_id, total_cents, marketplace_fee_cents, provider_order_id")
    .eq("provider_order_id", orderId).maybeSingle();
  if (paymentError) return Response.json({ error: "payment_lookup_failed" }, { status: 503 });
  if (!payment) return new Response(null, { status: 200 });
  const { data: connection, error: connectionError } = await admin.from("store_payment_connections")
    .select("provider_user_id").eq("store_id", payment.store_id).maybeSingle();
  if (connectionError) return Response.json({ error: "seller_connection_lookup_failed" }, { status: 503 });
  if (!connection) return new Response(null, { status: 200 });

  let accessToken: string;
  try { accessToken = await getMercadoPagoSellerAccessToken(payment.store_id); }
  catch { return Response.json({ error: "seller_token_unavailable" }, { status: 503 }); }
  let providerResponse: Response;
  try {
    providerResponse = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
    });
  } catch {
    return Response.json({ error: "provider_unavailable" }, { status: 503 });
  }
  if (!providerResponse.ok) return Response.json({ error: "provider_order_unavailable" }, { status: 503 });
  const providerOrder = asObject(await providerResponse.json().catch(() => null));
  if (!isMercadoPagoOrderForPayment(providerOrder, {
    id: orderId, paymentId: payment.id, sellerId: connection.provider_user_id,
    totalCents: Number(payment.total_cents), marketplaceFeeCents: Number(payment.marketplace_fee_cents),
  })) {
    return new Response(null, { status: 200 });
  }

  const providerStatus = typeof providerOrder.status === "string" ? providerOrder.status : "";
  const statusDetail = typeof providerOrder.status_detail === "string" ? providerOrder.status_detail : "";
  const mappedStatus = mapMercadoPagoOrderStatus(providerStatus, statusDetail);
  if (!mappedStatus) return new Response(null, { status: 200 });
  const { error } = await admin.rpc("record_seller_order_payment_status", {
    p_payment_id: payment.id,
    p_provider_order_id: orderId,
    p_provider_status: statusDetail ? `${providerStatus}:${statusDetail}` : providerStatus,
    p_status: mappedStatus,
  });
  if (error) return Response.json({ error: "payment_status_write_failed" }, { status: 503 });
  return new Response(null, { status: 200 });
}
