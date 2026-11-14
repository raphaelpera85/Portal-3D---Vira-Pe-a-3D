import { getUserWithRole } from "@/lib/auth-role.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { exportAdminPaymentReportCsv, getAdminPaymentReportRange } from "@/lib/admin-payment-report";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const pageSize = 1000;
const maxRows = 5000;
const maxChildRows = 10_000;
const childIdBatchSize = 100;
const select = "id, order_id, purchase_request_id, custom_print_request_id, designer_service_request_id, total_cents, marketplace_fee_cents, status, provider_status, provider_order_id, created_at, store:stores(name)";
type PaymentReportRow = Parameters<typeof exportAdminPaymentReportCsv>[0][number];

async function fetchCappedChildren<T>(
  paymentIds: string[],
  existingChildCount: number,
  fetchPage: (ids: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown | null }>,
) {
  const rows: T[] = [];
  for (let start = 0; start < paymentIds.length; start += childIdBatchSize) {
    const ids = paymentIds.slice(start, start + childIdBatchSize);
    let offset = 0;
    while (true) {
      const limit = Math.min(pageSize, maxChildRows - existingChildCount - rows.length + 1);
      const { data, error } = await fetchPage(ids, offset, offset + limit - 1);
      if (error) return { data: null, error, tooLarge: false };
      const batch = data ?? [];
      if (existingChildCount + rows.length + batch.length > maxChildRows) return { data: null, error: null, tooLarge: true };
      rows.push(...batch);
      if (batch.length < limit) break;
      offset += batch.length;
    }
  }
  return { data: rows, error: null, tooLarge: false };
}

export async function GET(request: Request) {
  const actor = await getUserWithRole("admin");
  if (!actor.user) return Response.json({ error: "authentication_required" }, { status: 401 });
  if (!actor.authorized) return Response.json({ error: "administrator_required" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const range = getAdminPaymentReportRange(params.get("from"), params.get("to"));
  if (!range) return Response.json({ error: "invalid_date_range", maximumDays: 31 }, { status: 400 });

  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: "report_unavailable" }, { status: 503 });
  const rows: Array<Omit<PaymentReportRow, "refunds" | "chargebacks">> = [];
  for (let offset = 0; offset <= maxRows; offset += pageSize) {
    const { data, error } = await admin.from("seller_order_payments").select(select)
      .gte("created_at", range.fromTimestamp).lt("created_at", range.untilTimestamp)
      .order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
    if (error) return Response.json({ error: "report_unavailable" }, { status: 503 });
    rows.push(...(data ?? []));
    if (rows.length > maxRows) return Response.json({ error: "date_range_too_large", maximumRows: maxRows, maximumDays: 31 }, { status: 413 });
    if ((data?.length ?? 0) < pageSize) break;
  }

  const paymentIds = rows.map((row) => row.id);
  const refundsResult = await fetchCappedChildren(paymentIds, 0, (ids, from, to) => admin.from("seller_order_refunds")
    .select("payment_id, amount_cents, status, provider_status, created_at").in("payment_id", ids)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to));
  if (refundsResult.tooLarge) return Response.json({ error: "report_history_too_large", maximumRows: maxChildRows }, { status: 413 });
  if (refundsResult.error) return Response.json({ error: "report_unavailable" }, { status: 503 });
  const refundRows = refundsResult.data ?? [];
  const chargebacksResult = await fetchCappedChildren(paymentIds, refundRows.length, (ids, from, to) => admin.from("seller_order_chargebacks")
    .select("payment_id, case_id, amount_cents, currency, case_status, documentation_status, created_at").in("payment_id", ids)
    .order("created_at", { ascending: false }).order("case_id", { ascending: false }).range(from, to));
  if (chargebacksResult.tooLarge) return Response.json({ error: "report_history_too_large", maximumRows: maxChildRows }, { status: 413 });
  if (chargebacksResult.error) return Response.json({ error: "report_unavailable" }, { status: 503 });
  const chargebackRows = chargebacksResult.data ?? [];
  const refundsByPayment = new Map<string, PaymentReportRow["refunds"]>();
  for (const refund of refundRows) {
    const items = refundsByPayment.get(refund.payment_id) ?? [];
    items.push({ amount_cents: refund.amount_cents, status: refund.status, provider_status: refund.provider_status, created_at: refund.created_at });
    refundsByPayment.set(refund.payment_id, items);
  }
  const chargebacksByPayment = new Map<string, PaymentReportRow["chargebacks"]>();
  for (const chargeback of chargebackRows) {
    const items = chargebacksByPayment.get(chargeback.payment_id) ?? [];
    items.push({ case_id: chargeback.case_id, amount_cents: chargeback.amount_cents, currency: chargeback.currency, case_status: chargeback.case_status, documentation_status: chargeback.documentation_status, created_at: chargeback.created_at });
    chargebacksByPayment.set(chargeback.payment_id, items);
  }
  const reportRows: PaymentReportRow[] = rows.map((payment) => ({
    ...payment,
    refunds: refundsByPayment.get(payment.id) ?? [],
    chargebacks: chargebacksByPayment.get(payment.id) ?? [],
  }));

  return new Response(exportAdminPaymentReportCsv(reportRows, range.from, range.through), {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="pagamentos-virapeca-${range.from}-${range.through}.csv"`,
      "content-type": "text/csv; charset=utf-8",
    },
  });
}
