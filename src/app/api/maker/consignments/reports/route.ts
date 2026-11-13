import { getUserWithRole } from "@/lib/auth-role.server";
import { buildMakerConsignmentReport, exportMakerConsignmentReportCsv } from "@/lib/maker-consignment-report";
import { loadMakerConsignmentItems } from "@/lib/maker-consignment-report.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await getUserWithRole("maker");
  if (!actor.user) return Response.json({ error: "authentication_required" }, { status: 401 });
  if (!actor.supabase) return Response.json({ error: "report_unavailable" }, { status: 503 });
  if (!actor.authorized) return Response.json({ error: "maker_account_required" }, { status: 403 });

  const { data: store, error: storeError } = await actor.supabase.from("stores")
    .select("id, name").eq("owner_user_id", actor.user.id).maybeSingle();
  if (storeError) return Response.json({ error: "report_unavailable" }, { status: 503 });
  if (!store) return Response.json({ error: "store_not_found" }, { status: 404 });

  const loaded = await loadMakerConsignmentItems(actor.supabase, store.id);
  if (loaded.error) return Response.json({ error: "report_unavailable" }, { status: 503 });
  const report = buildMakerConsignmentReport(loaded.items);
  return new Response(exportMakerConsignmentReportCsv(store.name, report), {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": 'attachment; filename="relatorio-consignacoes-virapeca.csv"',
      "content-type": "text/csv; charset=utf-8",
    },
  });
}
