import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { materials as localMaterials, nozzles as localNozzles, printers as localPrinters } from "@/lib/technical-catalog";
import { mapTechnicalCatalog } from "@/lib/technical-catalog-data";

export async function loadTechnicalCatalog() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ...{ printers: localPrinters, materials: localMaterials, nozzles: localNozzles }, source: "local" as const, error: null };

  const [printerResult, materialResult, nozzleResult, materialLinkResult, nozzleLinkResult] = await Promise.all([
    supabase.from("printer_models").select("*").eq("catalog_status", "published"),
    supabase.from("material_catalog").select("*").eq("catalog_status", "published"),
    supabase.from("nozzle_catalog").select("*").eq("catalog_status", "published"),
    supabase.from("printer_material_compatibility").select("*").eq("catalog_status", "published"),
    supabase.from("printer_nozzle_compatibility").select("*").eq("catalog_status", "published"),
  ]);
  const error = [printerResult, materialResult, nozzleResult, materialLinkResult, nozzleLinkResult].find((result) => result.error)?.error;
  if (error) return { printers: [], materials: [], nozzles: [], source: "database" as const, error: "Não foi possível carregar o catálogo. Verifique se a migração técnica foi aplicada e se as tabelas estão acessíveis." };

  if (![printerResult.data, materialResult.data, nozzleResult.data, materialLinkResult.data, nozzleLinkResult.data].some((data) => (data?.length ?? 0) > 0)) {
    return { printers: localPrinters, materials: localMaterials, nozzles: localNozzles, source: "local" as const, error: null };
  }

  return {
    ...mapTechnicalCatalog(printerResult.data ?? [], materialResult.data ?? [], nozzleResult.data ?? [], materialLinkResult.data ?? [], nozzleLinkResult.data ?? []),
    source: "database" as const,
    error: null,
  };
}
