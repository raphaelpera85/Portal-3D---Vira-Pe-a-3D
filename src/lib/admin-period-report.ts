export type AdminPeriodMetric = {
  window_days: number;
  paid_payment_count: number | string;
  gmv_cents: number | string;
  gross_marketplace_fee_cents: number | string;
  processed_refund_count: number | string;
  processed_refund_cents: number | string;
  confirmed_cancellation_count: number | string;
  chargeback_case_count: number | string;
};

function cell(value: string | number | bigint | null | undefined) {
  const text = String(value ?? "");
  const safe = typeof value === "string" && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function brlCents(value: number | string | undefined) {
  const cents = BigInt(value ?? 0);
  const hundred = BigInt(100);
  return `R$ ${new Intl.NumberFormat("pt-BR").format(cents / hundred)},${(cents % hundred).toString().padStart(2, "0")}`;
}

export function exportAdminPeriodReportCsv(metrics: AdminPeriodMetric[], generatedAt = new Date()) {
  const byDays = new Map(metrics.map((metric) => [metric.window_days, metric]));
  const values = (days: number) => byDays.get(days);
  const rows: Array<Array<string | number | bigint | null | undefined>> = [
    ["Relatório financeiro administrativo", "ViraPeça 3D"],
    ["Gerado em", new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(generatedAt)],
    ["Critério", "Janelas móveis até o momento da geração; pagamentos agrupados por criação e status atual; reembolsos e cancelamentos pela criação da solicitação, se processados."],
    ["Limite", "GMV e comissão são brutos, sem liquidação, tarifas do provedor ou receita líquida; não representam liquidação ou receita líquida."],
    [],
    ["Indicador", "7 dias", "30 dias"],
    ["Pagamentos confirmados", values(7)?.paid_payment_count ?? 0, values(30)?.paid_payment_count ?? 0],
    ["GMV bruto · sem frete", brlCents(values(7)?.gmv_cents), brlCents(values(30)?.gmv_cents)],
    ["Comissão bruta registrada", brlCents(values(7)?.gross_marketplace_fee_cents), brlCents(values(30)?.gross_marketplace_fee_cents)],
    ["Reembolsos processados · solicitações", values(7)?.processed_refund_count ?? 0, values(30)?.processed_refund_count ?? 0],
    ["Reembolsos processados · valor", brlCents(values(7)?.processed_refund_cents), brlCents(values(30)?.processed_refund_cents)],
    ["Cancelamentos confirmados", values(7)?.confirmed_cancellation_count ?? 0, values(30)?.confirmed_cancellation_count ?? 0],
    ["Contestações registradas", values(7)?.chargeback_case_count ?? 0, values(30)?.chargeback_case_count ?? 0],
  ];
  return `\uFEFFsep=;\r\n${rows.map((row) => row.map(cell).join(";")).join("\r\n")}`;
}
