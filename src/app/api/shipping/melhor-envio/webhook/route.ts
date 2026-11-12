import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readLimitedBody(request: Request, limit = 16_384) {
  if (Number(request.headers.get("content-length")) > limit || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export async function POST(request: Request) {
  const secret = process.env.ME_CLIENT_SECRET;
  const signature = request.headers.get("x-me-signature") ?? "";
  const body = await readLimitedBody(request);
  if (!secret || !body || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return Response.json({ error: "Invalid webhook" }, { status: 400 });
  const expected = createHmac("sha256", secret).update(body).digest();
  const received = Buffer.from(signature, "base64");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return Response.json({ error: "Invalid signature" }, { status: 401 });
  let payload: unknown;
  try { payload = JSON.parse(body.toString("utf8")); } catch { return Response.json({ error: "Invalid payload" }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || !("event" in payload) || !("data" in payload)) return Response.json({ error: "Invalid payload" }, { status: 400 });
  const event = payload as { event: unknown; data: unknown };
  if (typeof event.event !== "string" || !event.event.startsWith("order.") || !event.data || typeof event.data !== "object") return Response.json({ error: "Invalid event" }, { status: 400 });
  const data = event.data as Record<string, unknown>;
  if (typeof data.id !== "string" || data.id.length > 120 || typeof data.user_id !== "string" && typeof data.user_id !== "number"
    || typeof data.status !== "string" || data.status.length > 80) return Response.json({ error: "Invalid event data" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: "Webhook unavailable" }, { status: 503 });
  const { data: label } = await admin.from("seller_order_shipping_labels").select("id, order_id, store_id, status, tracking_code")
    .eq("provider_order_id", data.id).maybeSingle();
  if (!label) return Response.json({ received: true });
  const { data: connection } = await admin.from("store_melhor_envio_connections").select("provider_user_id")
    .eq("store_id", label.store_id).maybeSingle();
  if (!connection || connection.provider_user_id !== String(data.user_id)) return Response.json({ error: "Unknown sender" }, { status: 401 });

  const trackingCode = typeof data.tracking === "string" && /^[^\u0000-\u001f\u007f]{1,100}$/.test(data.tracking)
    ? data.tracking : label.tracking_code;
  const trackingUrl = typeof data.tracking_url === "string" && data.tracking_url.length <= 2048
    && /^https:\/\/[A-Za-z0-9.-]+(?:\/[^\s]*)?$/.test(data.tracking_url) ? data.tracking_url : null;
  const providerStatus = data.status.toLowerCase();
  const proposedStatus = providerStatus === "paid" || providerStatus === "released" ? "paid"
    : providerStatus === "generated" || providerStatus === "ready-to-print" ? "generated"
    : providerStatus === "posted" ? "posted" : providerStatus === "delivered" ? "delivered"
    : providerStatus === "cancelled" ? "cancelled" : label.status;
  const progress: Record<string, number> = { creating: 0, carted: 1, checkout_started: 2, checkout_uncertain: 2, paid: 3, generating: 4, generated: 5, posted: 6, delivered: 7 };
  const mappedStatus = label.status === "delivered" || label.status === "cancelled" ? label.status
    : proposedStatus === "cancelled" || (progress[proposedStatus] ?? -1) >= (progress[label.status] ?? -1) ? proposedStatus : label.status;
  const { error: labelError } = await admin.from("seller_order_shipping_labels").update({
    provider_status: providerStatus, status: mappedStatus, tracking_code: trackingCode,
    tracking_url: trackingUrl, updated_at: new Date().toISOString(),
  }).eq("id", label.id);
  if (labelError) return Response.json({ error: "Could not update shipment" }, { status: 500 });

  const { data: order } = await admin.from("seller_purchase_orders").select("shipment_status, shipping_tracking_code, shipping_tracking_url, shipping_shipped_at, shipping_delivered_at")
    .eq("id", label.order_id).maybeSingle();
  if (order && trackingCode && (providerStatus === "posted" || providerStatus === "delivered")) {
    const nextStatus = providerStatus === "delivered" ? "delivered" : order.shipment_status === "awaiting_shipment" ? "shipped" : order.shipment_status;
    if (["shipped", "delivered"].includes(nextStatus)) {
      const now = new Date().toISOString();
      const { error } = await admin.from("seller_purchase_orders").update({
        shipment_status: nextStatus, shipping_tracking_code: trackingCode, shipping_tracking_url: trackingUrl ?? order.shipping_tracking_url,
        shipping_shipped_at: order.shipping_shipped_at ?? now,
        shipping_delivered_at: nextStatus === "delivered" ? order.shipping_delivered_at ?? now : null,
        updated_at: now,
      }).eq("id", label.order_id).in("shipment_status", ["awaiting_shipment", "shipped"]);
      if (error) return Response.json({ error: "Could not update order" }, { status: 500 });
    }
  }
  return Response.json({ received: true });
}
