import { getUserWithRole } from "@/lib/auth-role.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { exportAdminPeriodReportCsv } from "@/lib/admin-period-report";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await getUserWithRole("admin");
  if (!actor.user) return Response.json({ error: "authentication_required" }, { status: 401 });
  if (!actor.authorized) return Response.json({ error: "administrator_required" }, { status: 403 });

  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: "report_unavailable" }, { status: 503 });
  const { data, error } = await admin.rpc("get_admin_marketplace_period_metrics");
  if (error) return Response.json({ error: "report_unavailable" }, { status: 503 });

  return new Response(exportAdminPeriodReportCsv(data ?? []), {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": 'attachment; filename="relatorio-financeiro-administrativo-virapeca.csv"',
      "content-type": "text/csv; charset=utf-8",
    },
  });
}
