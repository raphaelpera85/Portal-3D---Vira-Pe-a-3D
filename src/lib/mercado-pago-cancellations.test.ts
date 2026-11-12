import { describe, expect, it } from "vitest";
import { getMercadoPagoOrderCancellationStatus } from "./mercado-pago-cancellations";

const expected = { id: "ord-1", paymentId: "payment-1", sellerId: "seller-1", totalCents: 10_000, marketplaceFeeCents: 1_000 };
const order = {
  id: "ord-1", external_reference: "payment-1", user_id: "seller-1", currency: "BRL", total_amount: "100.00",
  marketplace_fee: "10.00", status: "created", status_detail: "created",
};

describe("Mercado Pago order cancellation", () => {
  it("allows only validated orders that are still waiting for payment", () => {
    expect(getMercadoPagoOrderCancellationStatus(order, expected)).toBe("cancelable");
    expect(getMercadoPagoOrderCancellationStatus({ ...order, status: "action_required", status_detail: "waiting_payment" }, expected)).toBe("cancelable");
    expect(getMercadoPagoOrderCancellationStatus({ ...order, user_id: "other" }, expected)).toBe("mismatch");
  });

  it("recognizes an already-cancelled order and rejects other states", () => {
    expect(getMercadoPagoOrderCancellationStatus({ ...order, status: "canceled", status_detail: "canceled" }, expected)).toBe("cancelled");
    expect(getMercadoPagoOrderCancellationStatus({ ...order, status: "processed", status_detail: "accredited", total_paid_amount: "100.00" }, expected)).toBe("not_cancelable");
    expect(getMercadoPagoOrderCancellationStatus({ ...order, status: "processing", status_detail: "in_process" }, expected)).toBe("not_cancelable");
  });
});
