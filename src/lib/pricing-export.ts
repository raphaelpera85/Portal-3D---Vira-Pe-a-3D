import type { PrintCostInput, SalesChannel } from "@/lib/pricing";
import type { calculatePrintPrice } from "@/lib/pricing";

type CalculationResult = ReturnType<typeof calculatePrintPrice>;

function cell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  const safe = typeof value === "string" && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function decimal(value: number | null | undefined) {
  return value == null ? "" : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function money(cents: number | null | undefined) {
  return cents == null ? "" : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function exportPrintCalculationCsv(
  title: string,
  input: PrintCostInput,
  channels: SalesChannel[],
  result: CalculationResult,
  createdAt = new Date(),
) {
  if (result.errors.length || !result.breakdown || result.unitCostCents == null) {
    throw new Error("Não há um cálculo válido para exportar.");
  }

  const rows: Array<Array<string | number | null | undefined>> = [
    ["Relatório de custos e preços", "ViraPeça 3D"],
    ["Cálculo", title],
    ["Gerado em", new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(createdAt)],
    ["Quantidade do lote", input.batchQuantity ?? 1],
    ["Material", input.material],
    ["Custo total do lote (R$)", money(result.breakdown.totalCostCents)],
    ["Custo unitário estimado (R$)", money(result.unitCostCents)],
    [input.pricingMode === "markup" ? "Markup desejado (%)" : "Margem desejada (%)", decimal(input.pricingMode === "markup" ? input.targetMarkupPercent : input.targetMarginPercent)],
    [],
    ["Composição de custos", "Total do lote (R$)"],
    ["Material", money(result.breakdown.materialCents)],
    ...(input.filamentCosts?.length ? [
      ["Custo por cor/material", "Massa (g)", "Preço (R$/kg)", "Subtotal (R$)"],
      ...input.filamentCosts.map((item, index) => [
        `${item.name || `Filamento ${index + 1}`}${item.color ? ` · ${item.color}` : ""}`,
        decimal(item.grams), decimal(item.pricePerKg), money(Math.round(item.grams * item.pricePerKg / 1000 * 100)),
      ]),
    ] : []),
    ["Energia", money(result.breakdown.energyCents)],
    ["Operação da máquina", money(result.breakdown.machineCents)],
    ["Depreciação", money(result.breakdown.depreciationCents)],
    ["Manutenção", money(result.breakdown.maintenanceCents)],
    ["Mão de obra", money(result.breakdown.laborCents)],
    ["Componentes adicionais", money(result.breakdown.additionalCents)],
    ["Custos fixos rateados", money(result.breakdown.overheadCents)],
    ["Custo fixo do lote", money(result.breakdown.batchFixedCents)],
    ["Reserva para falhas", money(result.breakdown.failureReserveCents)],
    [],
    ["Canais de venda", "Taxa (%)", "Taxa fixa (R$)", "Logística por peça (R$)", "Taxa calculada (R$)", "Preço unitário (R$)", "Lucro unitário (R$)", "Margem alcançada (%)"],
    ...channels.map((channel) => {
      const price = result.channels.find((item) => item.id === channel.id);
      return [channel.name, decimal(channel.feePercent), money(price?.fixedFeeCents), money(price?.logisticsCostCents), money(price?.feeCents), money(price?.priceCents), money(price?.profitCents), decimal(price?.actualMarginPercent)];
    }),
    ...(input.additionalCosts.length ? [[], ["Itens adicionais", "Custo por unidade (R$)"], ...input.additionalCosts.map((item) => [item.name, decimal(item.amount)])] : []),
    ...(input.productionComponents?.length ? [[], ["Componentes de produção", "Material", "Impressora", "Unidades por produto", "Material do lote (g)", "Impressão do lote (h)"]] : []),
    ...(input.productionComponents ?? []).map((item) => [item.name, item.material, item.printer, item.piecesPerProduct, decimal(item.filamentGrams), decimal(item.printHours)]),
  ];

  return `\uFEFFsep=;\r\n${rows.map((row) => row.map(cell).join(";")).join("\r\n")}`;
}
