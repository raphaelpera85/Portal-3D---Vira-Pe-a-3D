import { describe, expect, it } from "vitest";
import { parseRefundAmountCents, prepareMercadoPagoRefund } from "./mercado-pago-refunds";

const expected = { id: "ord-1", paymentId: "payment-1", sellerId: "seller-1", totalCents: 10_000, marketplaceFeeCents: 1_000 };
const paidOrder = {
  id: "ord-1", external_reference: "payment-1", user_id: "seller-1", currency: "BRL", total_amount: "100.00",
  marketplace_fee: "10.00", total_paid_amount: "100.00", status: "processed", status_detail: "accredited",
  transactions: { payments: [{ id: "txn-1", amount: "100.00", status: "processed" }] },
};

describe("Mercado Pago refunds", () => {
  it("parses only positive decimal currency amounts within the available balance", () => {
    expect(parseRefundAmountCents("12.3", 1_230)).toBe(1_230);
    expect(parseRefundAmountCents("0", 1_000)).toBeNull();
    expect(parseRefundAmountCents("12.345", 2_000)).toBeNull();
    expect(parseRefundAmountCents("1,00", 2_000)).toBeNull();
    expect(parseRefundAmountCents("10.01", 1_000)).toBeNull();
  });

  it("omits the body for a full refund and sends the validated transaction for a partial refund", () => {
    expect(prepareMercadoPagoRefund(paidOrder, expected, 10_000, 10_000)).toEqual({ body: undefined, refundCents: 10_000 });
    expect(prepareMercadoPagoRefund(paidOrder, expected, 2_500, 8_000)).toEqual({
      body: { transactions: [{ id: "txn-1", amount: "25.00" }] }, refundCents: 2_500,
    });
    expect(prepareMercadoPagoRefund(paidOrder, expected, 8_000, 8_000)).toEqual({
      body: { transactions: [{ id: "txn-1", amount: "80.00" }] }, refundCents: 8_000,
    });
  });

  it("rejects mismatched seller, terminal order, invalid transaction, and excess amounts", () => {
    expect(prepareMercadoPagoRefund({ ...paidOrder, user_id: "other" }, expected, 100, 10_000)).toBeNull();
    expect(prepareMercadoPagoRefund({ ...paidOrder, status_detail: "refunded" }, expected, 100, 10_000)).toBeNull();
    expect(prepareMercadoPagoRefund({ ...paidOrder, transactions: { payments: [{ amount: "100.00", status: "processed" }] } }, expected, 100, 10_000)).toBeNull();
    expect(prepareMercadoPagoRefund(paidOrder, expected, 10_001, 10_000)).toBeNull();
    expect(prepareMercadoPagoRefund(paidOrder, expected, 2_500, 2_000)).toBeNull();
  });
});
