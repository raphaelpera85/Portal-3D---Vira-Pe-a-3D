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

function cell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  const safe = typeof value === "string" && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function exportSellerActivityReportCsv(
  storeName: string,
  rows: ReturnType<typeof buildSellerActivityReportRows>,
  createdAt = new Date(),
) {
  const csvRows: Array<Array<string | number | null | undefined>> = [
    ["Relatório de atividade da loja", "ViraPeça 3D"],
    ["Loja", storeName],
    ["Gerado em", new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(createdAt)],
    ["Períodos", "7 e 30 dias anteriores à geração"],
    ["Critério", "Contagens usam a data de criação e o status atual; não representam receita ou pagamentos confirmados."],
    [],
    ["Tipo e situação", "7 dias", "30 dias"],
    ...rows.map((row) => [row.label, row.sevenDays, row.thirtyDays]),
  ];
  return `\uFEFFsep=;\r\n${csvRows.map((row) => row.map(cell).join(";")).join("\r\n")}`;
}
