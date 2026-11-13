import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { materials as localMaterials, nozzles as localNozzles, printers as localPrinters } from "@/lib/technical-catalog";
import { mapTechnicalCatalog, mergeTechnicalCatalogWithFallback } from "@/lib/technical-catalog-data";

export async function loadTechnicalCatalog() {
  const fallback = { printers: localPrinters, materials: localMaterials, nozzles: localNozzles };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ...fallback, source: "local" as const, error: null };

  const [printerResult, materialResult, nozzleResult, materialLinkResult, nozzleLinkResult] = await Promise.all([
    supabase.from("printer_models").select("*").eq("catalog_status", "published"),
    supabase.from("material_catalog").select("*").eq("catalog_status", "published"),
    supabase.from("nozzle_catalog").select("*").eq("catalog_status", "published"),
    supabase.from("printer_material_compatibility").select("*").eq("catalog_status", "published"),
    supabase.from("printer_nozzle_compatibility").select("*").eq("catalog_status", "published"),
  ]);
  const error = [printerResult, materialResult, nozzleResult, materialLinkResult, nozzleLinkResult].find((result) => result.error)?.error;
  const hasDatabaseRecords = [printerResult.data, materialResult.data, nozzleResult.data, materialLinkResult.data, nozzleLinkResult.data]
    .some((data) => (data?.length ?? 0) > 0);
  if (!error && !hasDatabaseRecords) {
    return { ...fallback, source: "local" as const, error: null };
  }

  const database = mapTechnicalCatalog(printerResult.data ?? [], materialResult.data ?? [], nozzleResult.data ?? [], materialLinkResult.data ?? [], nozzleLinkResult.data ?? []);
  return {
    ...mergeTechnicalCatalogWithFallback(database, fallback),
    source: hasDatabaseRecords ? "database" as const : "local" as const,
    error: error ? "Não foi possível consultar todo o catálogo. Combinamos os dados disponíveis com as referências locais; verifique se as migrações foram aplicadas." : null,
  };
}
