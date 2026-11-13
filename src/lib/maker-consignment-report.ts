import { summarizeConsignment, type ConsignmentMovement } from "./consignment";

export type MakerConsignmentReportItem = {
  id: string;
  establishment: string;
  product_name: string;
  unit_cost_brl: number | string;
  sale_price_brl: number | string;
  commission_percent: number | string;
  commission_fixed_fee_brl: number | string;
  created_at: string;
  movements: Array<{ movement_type: ConsignmentMovement["movementType"]; quantity: number }>;
};

export function buildMakerConsignmentReport(items: MakerConsignmentReportItem[]) {
  const lots = items.map((item) => ({
    item,
    report: summarizeConsignment({
      unitCostBrl: Number(item.unit_cost_brl),
      salePriceBrl: Number(item.sale_price_brl),
      commissionPercent: Number(item.commission_percent),
      commissionFixedFeeBrl: Number(item.commission_fixed_fee_brl),
    }, item.movements.map(({ movement_type, quantity }) => ({ movementType: movement_type, quantity }))),
  }));
  const establishments = new Map<string, ReturnType<typeof summarizeConsignment>>();
  for (const { item, report } of lots) {
    const total = establishments.get(item.establishment) ?? { delivered: 0, sold: 0, returned: 0, lost: 0, inStock: 0, grossSalesCents: 0, commissionCents: 0, receivableCents: 0, estimatedResultCents: 0 };
    for (const key of Object.keys(total) as Array<keyof typeof total>) total[key] += report[key];
    establishments.set(item.establishment, total);
  }
  return {
    establishments: [...establishments].map(([name, report]) => ({ name, ...report })),
    lots,
  };
}

function cell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  const safe = typeof value === "string" && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function brlCents(value: number) {
  const cents = BigInt(Math.round(value));
  const hundred = BigInt(100);
  const absolute = cents < 0 ? -cents : cents;
  return `${cents < 0 ? "-" : ""}R$ ${new Intl.NumberFormat("pt-BR").format(absolute / hundred)},${(absolute % hundred).toString().padStart(2, "0")}`;
}

export function exportMakerConsignmentReportCsv(storeName: string, report: ReturnType<typeof buildMakerConsignmentReport>, generatedAt = new Date()) {
  const rows: Array<Array<string | number | null | undefined>> = [
    ["Relatório de consignações", "ViraPeça 3D"],
    ["Loja", storeName],
    ["Gerado em", new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(generatedAt)],
    ["Critério", "Quantidades e valores são estimativas baseadas nos lotes e nas movimentações registradas manualmente; o valor a receber não representa confirmação de repasse."],
    [],
    ["Resumo por estabelecimento"],
    ["Estabelecimento", "Entregues", "Vendidas", "Devolvidas", "Perdidas", "Em estoque", "Venda bruta estimada", "Comissão estimada", "A receber estimado", "Resultado estimado"],
    ...report.establishments.map((item) => [item.name, item.delivered, item.sold, item.returned, item.lost, item.inStock, brlCents(item.grossSalesCents), brlCents(item.commissionCents), brlCents(item.receivableCents), brlCents(item.estimatedResultCents)]),
    [],
    ["Detalhes por lote"],
    ["Estabelecimento", "Produto", "Data inicial", "Entregues", "Vendidas", "Devolvidas", "Perdidas", "Em estoque", "Custo unitário", "Preço unitário", "Comissão (%)", "Taxa fixa/venda", "A receber estimado", "Resultado estimado"],
    ...report.lots.map(({ item, report: lot }) => [item.establishment, item.product_name, new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(item.created_at)), lot.delivered, lot.sold, lot.returned, lot.lost, lot.inStock, brlCents(Math.round(Number(item.unit_cost_brl) * 100)), brlCents(Math.round(Number(item.sale_price_brl) * 100)), item.commission_percent, brlCents(Math.round(Number(item.commission_fixed_fee_brl) * 100)), brlCents(lot.receivableCents), brlCents(lot.estimatedResultCents)]),
  ];
  return `\uFEFFsep=;\r\n${rows.map((row) => row.map(cell).join(";")).join("\r\n")}`;
}
