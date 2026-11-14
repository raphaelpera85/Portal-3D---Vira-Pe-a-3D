import { getUserWithRole } from "@/lib/auth-role.server";
import { normalizeCatalogOptionSearch, type CatalogOptionKind } from "@/lib/catalog-options";

export const dynamic = "force-dynamic";
const pageSize = 50;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") as CatalogOptionKind | null;
  const query = normalizeCatalogOptionSearch(params.get("q") ?? "");
  const rawOffset = params.get("offset") ?? "0";
  const offset = /^\d{1,7}$/.test(rawOffset) ? Number(rawOffset) : NaN;
  if (!kind || !["printer", "material", "nozzle"].includes(kind) || query === null
    || !Number.isSafeInteger(offset) || offset > 500_000) {
    return Response.json({ error: "invalid_catalog_search" }, { status: 400 });
  }

  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) return Response.json({ error: "unauthorized" }, { status: 401 });
  const pattern = `%${query}%`;
  const select = kind === "printer"
    ? actor.supabase.from("printer_models").select("id, manufacturer, model, variant, catalog_status", { count: "exact" })
    : kind === "material"
      ? actor.supabase.from("material_catalog").select("id, manufacturer, product, catalog_status", { count: "exact" })
      : actor.supabase.from("nozzle_catalog").select("id, manufacturer, model, diameter_mm, catalog_status", { count: "exact" });
  const filtered = query ? kind === "printer"
    ? select.or(`manufacturer.ilike.${pattern},model.ilike.${pattern},variant.ilike.${pattern}`)
    : kind === "material"
      ? select.or(`manufacturer.ilike.${pattern},product.ilike.${pattern}`)
      : select.or(`manufacturer.ilike.${pattern},model.ilike.${pattern},interface.ilike.${pattern}`)
    : select;
  const ordered = kind === "printer"
    ? filtered.order("manufacturer").order("model").order("id")
    : kind === "material"
      ? filtered.order("manufacturer").order("product").order("id")
      : filtered.order("manufacturer").order("model").order("diameter_mm").order("id");
  const { data, count, error } = await ordered.range(offset, offset + pageSize - 1);
  if (error) return Response.json({ error: "catalog_search_failed" }, { status: 500 });
  const options = (data ?? []).map((row) => ({
    id: row.id,
    label: "variant" in row
      ? `${row.manufacturer} ${row.model} · ${row.variant} (${row.catalog_status})`
      : "product" in row
        ? `${row.manufacturer} · ${row.product} (${row.catalog_status})`
        : `${row.manufacturer} · ${row.model} · ${row.diameter_mm} mm (${row.catalog_status})`,
  }));
  return Response.json({ options, total: count ?? 0 }, { headers: { "Cache-Control": "private, no-store" } });
}
