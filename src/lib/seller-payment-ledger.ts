type SellerPaymentSummaryInput = { status: string; total_cents: number | string; marketplace_fee_cents: number | string };

export function summarizeSellerPayments(payments: SellerPaymentSummaryInput[]) {
  const statusCount = (status: string) => payments.filter((payment) => payment.status === status).length;
  const paid = payments.filter((payment) => payment.status === "paid");
  const paidTotalCents = paid.reduce((sum, payment) => sum + Number(payment.total_cents), 0);
  const marketplaceFeeCents = paid.reduce((sum, payment) => sum + Number(payment.marketplace_fee_cents), 0);
  return {
    paidCount: paid.length,
    paidTotalCents,
    marketplaceFeeCents,
    beforeProviderFeesCents: paidTotalCents - marketplaceFeeCents,
    refundedCount: statusCount("refunded"),
    partiallyRefundedCount: statusCount("partially_refunded"),
    chargedBackCount: statusCount("charged_back"),
    pendingCount: statusCount("pending") + statusCount("creating"),
  };
}
