import { isMercadoPagoOrderForPayment } from "./mercado-pago-payments";

export function getMercadoPagoOrderCancellationStatus(orderValue: unknown, expected: {
  id: string; paymentId: string; sellerId: string; totalCents: number; marketplaceFeeCents: number;
}): "mismatch" | "cancelable" | "cancelled" | "not_cancelable" {
  if (!isMercadoPagoOrderForPayment(orderValue, expected)) return "mismatch";
  const order = orderValue as Record<string, unknown>;
  if (order.status === "canceled" || order.status === "cancelled") return "cancelled";
  return order.status === "created" || order.status === "action_required" ? "cancelable" : "not_cancelable";
}
