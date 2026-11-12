import { createHmac, timingSafeEqual } from "node:crypto";

export function calculateMarketplaceFeeCents(totalCents: number, percent: number) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 1 || !Number.isFinite(percent) || percent < 0 || percent >= 100) {
    throw new Error("Invalid marketplace fee inputs");
  }
  const fee = Math.floor(totalCents * percent / 100);
  if (fee >= totalCents) throw new Error("Marketplace fee must be less than the order total");
  return fee;
}

export function isMercadoPagoCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && (url.hostname === "mercadopago.com.br" || url.hostname.endsWith(".mercadopago.com.br"));
  } catch {
    return false;
  }
}

export function verifyMercadoPagoWebhookSignature(signature: string, requestId: string, dataId: string, secret: string) {
  const parts = new Map(signature.split(",").map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, value.join("=")];
  }));
  const timestamp = parts.get("ts");
  const digest = parts.get("v1");
  if (!timestamp || !/^\d+$/.test(timestamp) || !digest || !/^[a-f\d]{64}$/i.test(digest)
    || !requestId || !dataId || !secret) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  return timingSafeEqual(Buffer.from(digest, "hex"), expected);
}

export function formatMercadoPagoAmount(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 1) throw new Error("Invalid Mercado Pago amount");
  return (cents / 100).toFixed(2);
}

export function customPrintOfferPaymentItem(value: unknown) {
  const request = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const offers = Array.isArray(request.offers) ? request.offers : Array.isArray(request.offer) ? request.offer : request.offer ? [request.offer] : [];
  const acceptedOffers = offers.filter((offer) => {
    if (!offer || typeof offer !== "object" || Array.isArray(offer)) return false;
    const row = offer as Record<string, unknown>;
    return row.status === "accepted" && row.store_id === request.winning_store_id;
  }) as Record<string, unknown>[];
  const modelName = typeof request.model_name === "string" ? request.model_name.trim().slice(0, 190) : "";
  const totalCents = acceptedOffers.length === 1 ? mercadoPagoAmountToCents(acceptedOffers[0].total_brl) : null;
  if (request.status !== "accepted" || !modelName || !request.winning_store_id || totalCents === null || totalCents < 1) return null;
  return { name: `Impressão personalizada — ${modelName}`, unitCents: totalCents, quantity: 1 };
}

export function parseMercadoPagoOrderResponse(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const order = value as Record<string, unknown>;
  return typeof order.id === "string" && order.id.length > 0 && order.id.length <= 100 && typeof order.checkout_url === "string"
    && isMercadoPagoCheckoutUrl(order.checkout_url)
    ? { id: order.id, checkoutUrl: order.checkout_url }
    : null;
}

export function mercadoPagoAmountToCents(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const formatted = String(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(formatted)) return null;
  const [whole, fraction = ""] = formatted.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function isMercadoPagoOrderForPayment(value: unknown, expected: {
  id: string; paymentId: string; sellerId: string; totalCents: number; marketplaceFeeCents: number;
}) {
  if (!value || typeof value !== "object") return false;
  const order = value as Record<string, unknown>;
  const feeCents = mercadoPagoAmountToCents(order.marketplace_fee);
  if (order.id !== expected.id || order.external_reference !== expected.paymentId || String(order.user_id) !== expected.sellerId
    || order.currency !== "BRL" || mercadoPagoAmountToCents(order.total_amount) !== expected.totalCents
    || (order.marketplace_fee !== undefined && feeCents !== expected.marketplaceFeeCents)) return false;
  if (order.status === "processed" && !["refunded", "partially_refunded"].includes(String(order.status_detail))
    && (mercadoPagoAmountToCents(order.total_paid_amount) ?? 0) < expected.totalCents) return false;
  return true;
}

export function mapMercadoPagoOrderStatus(status: string, detail = ""): "paid" | "pending" | "failed" | "expired" | "cancelled" | "refunded" | "partially_refunded" | "charged_back" | null {
  if (status === "charged_back") return "charged_back";
  if (status === "processed" && detail === "refunded") return "refunded";
  if (status === "processed" && detail === "partially_refunded") return "partially_refunded";
  if (status === "processed") return "paid";
  if (["created", "processing", "action_required"].includes(status)) return "pending";
  if (status === "expired") return "expired";
  if (["cancelled", "canceled"].includes(status)) return "cancelled";
  if (status === "failed") return "failed";
  if (status === "refunded") return "refunded";
  return null;
}
