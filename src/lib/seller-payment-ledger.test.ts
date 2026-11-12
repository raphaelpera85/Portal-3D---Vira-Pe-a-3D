import { describe, expect, it } from "vitest";
import { summarizeSellerPayments } from "./seller-payment-ledger";

describe("summarizeSellerPayments", () => {
  it("sums only confirmed payments and keeps refunds visible in status counts", () => {
    expect(summarizeSellerPayments([
      { status: "paid", total_cents: 10_000, marketplace_fee_cents: 1_000 },
      { status: "paid", total_cents: "2500", marketplace_fee_cents: "250" },
      { status: "partially_refunded", total_cents: 5_000, marketplace_fee_cents: 500 },
      { status: "refunded", total_cents: 3_000, marketplace_fee_cents: 300 },
      { status: "pending", total_cents: 4_000, marketplace_fee_cents: 400 },
    ])).toEqual({ paidCount: 2, paidTotalCents: 12_500, marketplaceFeeCents: 1_250, beforeProviderFeesCents: 11_250, refundedCount: 1, partiallyRefundedCount: 1, pendingCount: 1 });
  });
});
