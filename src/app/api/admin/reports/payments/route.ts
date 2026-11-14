import { getUserWithRole } from "@/lib/auth-role.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { exportAdminPaymentReportCsv, getAdminPaymentReportRange } from "@/lib/admin-payment-report";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const pageSize = 1000;
const maxRows = 5000;
const select = "id, order_id, purchase_request_id, custom_print_request_id, designer_service_request_id, total_cents, marketplace_fee_cents, status, provider_status, provider_order_id, created_at, store:stores(name), refunds:seller_order_refunds(amount_cents, status, provider_status, created_at), chargebacks:seller_order_chargebacks(case_id, amount_cents, currency, case_status, documentation_status, created_at)";

export async function GET(request: Request) {
  const actor = await getUserWithRole("admin");
  if (!actor.user) return Response.json({ error: "authentication_required" }, { status: 401 });
  if (!actor.authorized) return Response.json({ error: "administrator_required" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const range = getAdminPaymentReportRange(params.get("from"), params.get("to"));
  if (!range) return Response.json({ error: "invalid_date_range", maximumDays: 31 }, { status: 400 });

  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: "report_unavailable" }, { status: 503 });
  const rows = [];
  for (let offset = 0; offset <= maxRows; offset += pageSize) {
    const { data, error } = await admin.from("seller_order_payments").select(select)
      .gte("created_at", range.fromTimestamp).lt("created_at", range.untilTimestamp)
      .order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
    if (error) return Response.json({ error: "report_unavailable" }, { status: 503 });
    rows.push(...(data ?? []));
    if (rows.length > maxRows) return Response.json({ error: "date_range_too_large", maximumRows: maxRows, maximumDays: 31 }, { status: 413 });
    if ((data?.length ?? 0) < pageSize) break;
  }

  return new Response(exportAdminPaymentReportCsv(rows, range.from, range.through), {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="pagamentos-virapeca-${range.from}-${range.through}.csv"`,
      "content-type": "text/csv; charset=utf-8",
    },
  });
}
