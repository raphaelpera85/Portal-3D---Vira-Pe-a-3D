import { formatMercadoPagoAmount, isMercadoPagoOrderForPayment, mercadoPagoAmountToCents } from "./mercado-pago-payments";

export function parseRefundAmountCents(value: unknown, availableCents: number) {
  if (typeof value !== "string" || !Number.isSafeInteger(availableCents) || availableCents < 1
    || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) return null;
  const amountCents = mercadoPagoAmountToCents(value);
  return amountCents !== null && amountCents > 0 && amountCents <= availableCents ? amountCents : null;
}

export function prepareMercadoPagoRefund(orderValue: unknown, expected: {
  id: string; paymentId: string; sellerId: string; totalCents: number; marketplaceFeeCents: number;
}, refundCents: number, availableCents: number) {
  if (!Number.isSafeInteger(refundCents) || refundCents < 1 || !Number.isSafeInteger(availableCents)
    || refundCents > availableCents || !isMercadoPagoOrderForPayment(orderValue, expected)) return null;
  const order = orderValue as Record<string, unknown>;
  if (order.status !== "processed" || order.status_detail === "refunded") return null;
  const transactions = order.transactions && typeof order.transactions === "object" && !Array.isArray(order.transactions)
    ? order.transactions as Record<string, unknown> : {};
  const payments = Array.isArray(transactions.payments) ? transactions.payments : [];
  if (payments.length !== 1 || !payments[0] || typeof payments[0] !== "object" || Array.isArray(payments[0])) return null;
  const payment = payments[0] as Record<string, unknown>;
  if (typeof payment.id !== "string" || !payment.id || payment.id.length > 100 || payment.status !== "processed") return null;
  const paidCents = mercadoPagoAmountToCents(payment.amount) ?? expected.totalCents;
  if (paidCents < refundCents) return null;
  const fullRefund = refundCents === expected.totalCents && availableCents === expected.totalCents;
  return {
    body: fullRefund ? undefined : { transactions: [{ id: payment.id, amount: formatMercadoPagoAmount(refundCents) }] },
    refundCents,
  };
}

export function prepareMercadoPagoRefundRetry(orderValue: unknown, expected: {
  id: string; paymentId: string; sellerId: string; totalCents: number; marketplaceFeeCents: number;
}, refundCents: number, availableCents: number) {
  const prepared = prepareMercadoPagoRefund(orderValue, expected, refundCents, availableCents);
  if (prepared) return prepared;
  if (!Number.isSafeInteger(refundCents) || refundCents < 1 || !Number.isSafeInteger(availableCents)
    || refundCents > availableCents || !isMercadoPagoOrderForPayment(orderValue, expected)) return null;
  const order = orderValue as Record<string, unknown>;
  if (!["refunded", "partially_refunded"].includes(String(order.status))) return null;
  const transactions = order.transactions && typeof order.transactions === "object" && !Array.isArray(order.transactions)
    ? order.transactions as Record<string, unknown> : {};
  const payments = Array.isArray(transactions.payments) ? transactions.payments : [];
  if (payments.length !== 1 || !payments[0] || typeof payments[0] !== "object" || Array.isArray(payments[0])) return null;
  const payment = payments[0] as Record<string, unknown>;
  if (typeof payment.id !== "string" || !payment.id || payment.id.length > 100
    || !["processed", "refunded"].includes(String(payment.status))) return null;
  const fullRefund = refundCents === expected.totalCents && availableCents === expected.totalCents;
  return {
    body: fullRefund ? undefined : { transactions: [{ id: payment.id, amount: formatMercadoPagoAmount(refundCents) }] },
    refundCents,
  };
}
