import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { calculateMarketplaceFeeCents, customPrintOfferPaymentItem, formatMercadoPagoAmount, isMercadoPagoCheckoutUrl, isMercadoPagoOrderForPayment, mapMercadoPagoOrderStatus, mercadoPagoAmountToCents, parseMercadoPagoOrderResponse, verifyMercadoPagoWebhookSignature } from "./mercado-pago-payments";

describe("Mercado Pago payment helpers", () => {
  it("calculates a configurable marketplace fee in integer cents", () => {
    expect(calculateMarketplaceFeeCents(10_001, 12.5)).toBe(1_250);
    expect(calculateMarketplaceFeeCents(1, 50)).toBe(0);
    expect(() => calculateMarketplaceFeeCents(100, -1)).toThrow();
    expect(() => calculateMarketplaceFeeCents(0, 10)).toThrow();
  });

  it("accepts only HTTPS checkout URLs on Mercado Pago domains", () => {
    expect(isMercadoPagoCheckoutUrl("https://www.mercadopago.com.br/checkout/v1/redirect?id=1")).toBe(true);
    expect(isMercadoPagoCheckoutUrl("http://www.mercadopago.com.br/checkout")).toBe(false);
    expect(isMercadoPagoCheckoutUrl("https://mercadopago.com.br.attacker.example/checkout")).toBe(false);
    expect(isMercadoPagoCheckoutUrl("https://user:pass@mercadopago.com.br/checkout")).toBe(false);
  });

  it("formats cents and validates the provider checkout response before redirecting", () => {
    expect(formatMercadoPagoAmount(12_345)).toBe("123.45");
    expect(() => formatMercadoPagoAmount(0)).toThrow();
    expect(parseMercadoPagoOrderResponse({ id: "ord-1", checkout_url: "https://www.mercadopago.com.br/checkout?id=1" }))
      .toEqual({ id: "ord-1", checkoutUrl: "https://www.mercadopago.com.br/checkout?id=1" });
    expect(parseMercadoPagoOrderResponse({ id: "ord-1", checkout_url: "https://attacker.example/checkout" })).toBeNull();
  });

  it("builds a payment item only from the accepted offer belonging to the winning store", () => {
    const request = {
      status: "accepted", winning_store_id: "store-winner", model_name: "Miniatura", offers: [
        { status: "closed", store_id: "store-other", total_brl: "80.00" },
        { status: "accepted", store_id: "store-winner", total_brl: "125.50" },
      ],
    };
    expect(customPrintOfferPaymentItem(request)).toEqual({ name: "Impressão personalizada — Miniatura", unitCents: 12_550, quantity: 1 });
    expect(customPrintOfferPaymentItem({ ...request, winning_store_id: "store-other" })).toBeNull();
    expect(customPrintOfferPaymentItem({ ...request, status: "offered" })).toBeNull();
    expect(customPrintOfferPaymentItem({ ...request, offers: [{ status: "accepted", store_id: "store-winner", total_brl: "0" }] })).toBeNull();
    expect(customPrintOfferPaymentItem({ ...request, offers: undefined, offer: [{ status: "accepted", store_id: "store-winner", total_brl: 125.5 }] }))
      .toEqual({ name: "Impressão personalizada — Miniatura", unitCents: 12_550, quantity: 1 });
  });

  it("maps only terminal provider states used by the verified webhook", () => {
    expect(mapMercadoPagoOrderStatus("processed")).toBe("paid");
    expect(mapMercadoPagoOrderStatus("action_required")).toBe("pending");
    expect(mapMercadoPagoOrderStatus("processing")).toBe("pending");
    expect(mapMercadoPagoOrderStatus("failed")).toBe("failed");
    expect(mapMercadoPagoOrderStatus("canceled")).toBe("cancelled");
    expect(mapMercadoPagoOrderStatus("refunded")).toBe("refunded");
    expect(mapMercadoPagoOrderStatus("processed", "partially_refunded")).toBe("partially_refunded");
    expect(mapMercadoPagoOrderStatus("charged_back", "in_process")).toBe("charged_back");
    expect(mapMercadoPagoOrderStatus("charged_back", "settled")).toBe("charged_back");
    expect(mapMercadoPagoOrderStatus("charged_back", "reimbursed")).toBe("charged_back");
    expect(mapMercadoPagoOrderStatus("expired")).toBe("expired");
    expect(mapMercadoPagoOrderStatus("unknown_status")).toBeNull();
  });

  it("matches a fetched Mercado Pago order against the persisted seller, payment and exact BRL totals", () => {
    const expected = { id: "ord-1", paymentId: "payment-1", sellerId: "seller-1", totalCents: 10_000, marketplaceFeeCents: 1_000 };
    const order = { id: "ord-1", external_reference: "payment-1", user_id: "seller-1", currency: "BRL", total_amount: "100.00", marketplace_fee: "10.00", total_paid_amount: "100.00", status: "processed" };
    expect(isMercadoPagoOrderForPayment(order, expected)).toBe(true);
    expect(isMercadoPagoOrderForPayment({ ...order, user_id: "other-seller" }, expected)).toBe(false);
    expect(isMercadoPagoOrderForPayment({ ...order, total_amount: "100.01" }, expected)).toBe(false);
    expect(isMercadoPagoOrderForPayment({ ...order, total_paid_amount: "99.99" }, expected)).toBe(false);
    expect(mercadoPagoAmountToCents("100.001")).toBeNull();
  });

  it("validates the signed webhook manifest in constant-time comparison", () => {
    const id = "ORD01TEST";
    const requestId = "request-123";
    const timestamp = "1742505638683";
    const secret = "webhook-secret";
    const manifest = `id:${id};request-id:${requestId};ts:${timestamp};`;
    const signature = createHmac("sha256", secret).update(manifest).digest("hex");
    expect(verifyMercadoPagoWebhookSignature(`ts=${timestamp},v1=${signature}`, requestId, id, secret)).toBe(true);
    expect(verifyMercadoPagoWebhookSignature(`ts=${timestamp},v1=${signature}`, "other-request", id, secret)).toBe(false);
    expect(verifyMercadoPagoWebhookSignature("invalid", requestId, id, secret)).toBe(false);
  });
});
