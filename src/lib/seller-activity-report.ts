const DAY_MS = 24 * 60 * 60 * 1000;

export const sellerOrderReportStatuses = [
  { status: "pending", label: "Aguardando decisão" },
  { status: "accepted", label: "Aceitos" },
  { status: "declined", label: "Recusados" },
] as const;

export type SellerActivityPeriodCounts = { sevenDays: number; thirtyDays: number };
export type SellerActivityCounts = {
  orders: Record<(typeof sellerOrderReportStatuses)[number]["status"], SellerActivityPeriodCounts>;
  productQuotes: SellerActivityPeriodCounts;
  productPurchases: SellerActivityPeriodCounts;
  customPrints: SellerActivityPeriodCounts;
};

export function getSellerActivityReportWindows(now: Date = new Date()) {
  return {
    sevenDays: new Date(now.getTime() - 7 * DAY_MS).toISOString(),
    thirtyDays: new Date(now.getTime() - 30 * DAY_MS).toISOString(),
    through: now.toISOString(),
  };
}

export function buildSellerActivityReportRows(counts: SellerActivityCounts) {
  const orderRows = sellerOrderReportStatuses.map(({ status, label }) => ({ label, ...counts.orders[status] }));
  return [
    {
      label: "Pedidos do carrinho",
      sevenDays: orderRows.reduce((total, row) => total + row.sevenDays, 0),
      thirtyDays: orderRows.reduce((total, row) => total + row.thirtyDays, 0),
    },
    ...orderRows,
    { label: "Orçamentos de produtos", ...counts.productQuotes },
    { label: "Pedidos diretos de produtos", ...counts.productPurchases },
    { label: "Solicitações de impressão", ...counts.customPrints },
  ];
}
