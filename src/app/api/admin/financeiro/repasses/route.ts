import { getUserWithRole } from "@/lib/auth-role.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listReleaseReportPaymentReferences, reconcileReleaseReportCsv } from "@/lib/mercado-pago-release-reconciliation";
import { fetchInChunks } from "@/lib/fetch-in-chunks";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const maxFileBytes = 1_000_000;
const maxRequestBytes = 1_100_000;
const maxPayments = 5_000;
const privateHeaders = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  const actor = await getUserWithRole("admin");
  if (!actor.user) return Response.json({ error: "authentication_required" }, { status: 401, headers: privateHeaders });
  if (!actor.authorized) return Response.json({ error: "administrator_required" }, { status: 403, headers: privateHeaders });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    return Response.json({ error: "report_too_large", maximumBytes: maxFileBytes }, { status: 413, headers: privateHeaders });
  }

  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "invalid_report" }, { status: 400, headers: privateHeaders }); }
  const file = form.get("report");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv") || file.size === 0) {
    return Response.json({ error: "invalid_report" }, { status: 400, headers: privateHeaders });
  }
  if (file.size > maxFileBytes) return Response.json({ error: "report_too_large", maximumBytes: maxFileBytes }, { status: 413, headers: privateHeaders });

  const csv = await file.text();
  const references = listReleaseReportPaymentReferences(csv);
  if (!references || !reconcileReleaseReportCsv(csv, [])) return Response.json({ error: "invalid_report" }, { status: 400, headers: privateHeaders });
  if (references.length > maxPayments) return Response.json({ error: "report_too_large", maximumPayments: maxPayments }, { status: 413, headers: privateHeaders });

  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: "report_unavailable" }, { status: 503, headers: privateHeaders });
  const payments = await fetchInChunks(references, (ids) => admin.from("seller_order_payments")
    .select("id, order_id, total_cents, marketplace_fee_cents, status").in("id", ids));
  if (payments.error) return Response.json({ error: "report_unavailable" }, { status: 503, headers: privateHeaders });

  const result = reconcileReleaseReportCsv(csv, payments.data ?? []);
  if (!result) return Response.json({ error: "invalid_report" }, { status: 400, headers: privateHeaders });
  return Response.json(result, { headers: privateHeaders });
}
