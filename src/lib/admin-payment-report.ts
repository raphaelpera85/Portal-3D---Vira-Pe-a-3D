const DAY_MS = 86_400_000;

export function getAdminPaymentReportRange(start: string | null, end: string | null, now = new Date()) {
  const validDate = (value: string | null): value is string => !!value
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  const fallbackEnd = now.toISOString().slice(0, 10);
  const through = end ?? fallbackEnd;
  if (!validDate(through)) return null;
  const from = start ?? new Date(Date.parse(`${through}T00:00:00.000Z`) - 6 * DAY_MS).toISOString().slice(0, 10);
  if (!validDate(from)) return null;
  const days = (Date.parse(`${through}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS + 1;
  if (days < 1 || days > 31) return null;
  return { from, through, fromTimestamp: `${from}T00:00:00.000Z`, untilTimestamp: new Date(Date.parse(`${through}T00:00:00.000Z`) + DAY_MS).toISOString() };
}

type AdminPaymentRow = {
  id: string; order_id: string | null; purchase_request_id: string | null; custom_print_request_id: string | null;
  designer_service_request_id: string | null; total_cents: number | string; marketplace_fee_cents: number | string;
  status: string; provider_status: string | null; provider_order_id: string | null; created_at: string;
  store: { name: string } | { name: string }[] | null;
  refunds: Array<{ amount_cents: number | string; status: string; provider_status: string | null; created_at: string }> | null;
  chargebacks: Array<{ case_id: string; amount_cents: number | string; currency: string; case_status: string; documentation_status: string; created_at: string }> | null;
};

function cell(value: string | number | bigint | null | undefined) {
  const text = String(value ?? "");
  const safe = typeof value === "string" && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function brlCents(value: number | string | bigint) {
  const cents = BigInt(value);
  const hundred = BigInt(100);
  return `R$ ${new Intl.NumberFormat("pt-BR").format(cents / hundred)},${(cents % hundred).toString().padStart(2, "0")}`;
}

export function exportAdminPaymentReportCsv(rows: AdminPaymentRow[], from: string, through: string) {
  const csvRows: Array<Array<string | number | bigint | null | undefined>> = [
    ["Extrato detalhado de pagamentos", "ViraPeça 3D"],
    ["Período de criação", from, through],
    ["Critério", "Registros internos por data de criação; valores brutos. Não representam liquidação, tarifa final ou repasse do Mercado Pago."],
    [],
    ["Criado em (UTC)", "Loja", "Pagamento", "Pedido", "Origem", "ID Mercado Pago", "Status interno", "Status Mercado Pago", "Valor cobrado", "Comissão ViraPeça", "Após comissão (antes das tarifas)", "Reembolsos registrados", "Contestações registradas"],
    ...rows.map((row) => {
      const store = Array.isArray(row.store) ? row.store[0] : row.store;
      const origin = row.designer_service_request_id ? "Modelagem" : row.custom_print_request_id ? "Impressão personalizada"
        : row.purchase_request_id ? "Compra direta" : row.order_id ? "Pedido do carrinho" : "Outra origem";
      const refunds = (row.refunds ?? []).map((refund) => `${refund.status}: ${brlCents(refund.amount_cents)}${refund.provider_status ? ` (${refund.provider_status})` : ""}`).join(" | ");
      const chargebacks = (row.chargebacks ?? []).map((item) => `${item.case_status}: ${item.case_id}, ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: item.currency }).format(Number(item.amount_cents) / 100)}, documentos ${item.documentation_status}`).join(" | ");
      return [row.created_at, store?.name ?? "", row.id, row.order_id, origin, row.provider_order_id, row.status, row.provider_status,
        brlCents(row.total_cents), brlCents(row.marketplace_fee_cents), brlCents(BigInt(row.total_cents) - BigInt(row.marketplace_fee_cents)), refunds, chargebacks];
    }),
  ];
  return `\uFEFFsep=;\r\n${csvRows.map((row) => row.map(cell).join(";")).join("\r\n")}`;
}

