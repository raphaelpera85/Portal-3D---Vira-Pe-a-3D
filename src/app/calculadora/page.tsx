import type { Metadata } from "next";
import Link from "next/link";
import { PriceCalculator } from "@/components/price-calculator";
import { SiteHeader } from "@/components/site-header";
import { getSiteUrl } from "@/lib/site-url";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateCalculationToSave, type SavedSlicerMetrics } from "@/lib/saved-calculation";
import { readPrintProfileColors } from "@/lib/print-profile-colors";
import { loadTechnicalCatalog } from "@/lib/technical-catalog.server";

export const metadata: Metadata = {
  title: "Calculadora de impressão 3D | ViraPeça 3D",
  description: "Calcule custos de produção e compare preços por canal de venda com taxas informadas por você.",
  ...(getSiteUrl() ? { alternates: { canonical: "/calculadora" } } : {}),
};

export const dynamic = "force-dynamic";

export default async function CalculatorPage() {
  const [actor, catalog] = await Promise.all([getUserWithRole("maker"), loadTechnicalCatalog()]);
  const canUseOcr = Boolean(actor.supabase && actor.user && actor.authorized);
  const ocrConfigured = Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY);
  let equipment: Array<{ id: string; label: string; purchasePriceBrl: number | string | null; residualValueBrl: number | string | null; usefulLifeHours: number | string | null; averagePowerWatts: number | string | null; energyTariffPerKwh: number | string | null; maintenanceCostBrl: number | null; accumulatedHours: number | string; catalogPrinterId: string | null }> = [];
  let products: Array<{ id: string; name: string; slug: string; published: boolean }> = [];
  let profiles: Array<{ id: string; name: string; productId: string; quantity: number; materialName: string; printHours: number | null; materialGrams: number | null; materialByColor: Array<{ color: string; grams: number }>; equipmentId: string | null }> = [];
  let equipmentNotice: string | null = null;
  let productNotice: string | null = null;
  let profileNotice: string | null = null;
  let canSaveCalculations = false;
  let savedCalculations: Array<{ id: string; title: string; createdAt: string; totalCostCents: number; unitCostCents: number; batchQuantity: number; productId: string | null; productName: string | null; productUrl: string | null; printerId: string | null; printerName: string | null; profileId: string | null; profileName: string | null; slicer: SavedSlicerMetrics | null; snapshot: string }> = [];
  let savedCalculationsError = false;
  if (actor.supabase && actor.user && actor.authorized) {
    const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
    if (store) {
      canSaveCalculations = true;
      const [{ data, error }, history, productResult, profileResult] = await Promise.all([
        actor.supabase.from("maker_printers")
          .select("id, catalog_model_id, manufacturer_snapshot, model_snapshot, nickname, purchase_price_brl, residual_value_brl, useful_life_hours, accumulated_hours, measured_average_power_w, energy_tariff_per_kwh")
          .eq("store_id", store.id).neq("operational_status", "inactive").order("nickname"),
        actor.supabase.from("maker_cost_calculations").select("id, title, input_snapshot, product_id, printer_id, profile_id, created_at")
          .eq("store_id", store.id).order("created_at", { ascending: false }).limit(20),
        actor.supabase.from("marketplace_products").select("id, name, slug, catalog_status")
          .eq("store_id", store.id).order("name"),
        actor.supabase.from("maker_print_profiles").select("id, product_id, profile_name, quantity, material_snapshot, print_hours, material_grams, material_by_color, maker_printer_id")
          .eq("store_id", store.id).order("profile_name"),
      ]);
      if (error) equipmentNotice = "Não foi possível carregar seus equipamentos. A calculadora manual continua disponível.";
      if (productResult.error) productNotice = "Não foi possível carregar os produtos desta loja para vinculá-los ao cálculo.";
      if (profileResult.error) profileNotice = "Não foi possível carregar os perfis desta loja para vinculá-los ao cálculo.";
      const maintenanceCosts = new Map<string, number>();
      const printerIds = (data ?? []).map((printer) => printer.id);
      for (let offset = 0; printerIds.length > 0; offset += 1000) {
        const { data: events, error: maintenanceError } = await actor.supabase.from("printer_maintenance_events")
          .select("printer_id, cost_brl").in("printer_id", printerIds).range(offset, offset + 999);
        if (maintenanceError) {
          maintenanceCosts.clear();
          equipmentNotice = "Não foi possível carregar o histórico de manutenção para sugerir uma taxa média; informe-a manualmente.";
          break;
        }
        for (const event of events ?? []) maintenanceCosts.set(event.printer_id, (maintenanceCosts.get(event.printer_id) ?? 0) + Number(event.cost_brl));
        if ((events?.length ?? 0) < 1000) break;
      }
      equipment = (data ?? []).map((printer) => ({
        id: printer.id, label: `${printer.nickname} · ${printer.manufacturer_snapshot} ${printer.model_snapshot}`,
        purchasePriceBrl: printer.purchase_price_brl, residualValueBrl: printer.residual_value_brl,
        usefulLifeHours: printer.useful_life_hours, averagePowerWatts: printer.measured_average_power_w,
        energyTariffPerKwh: printer.energy_tariff_per_kwh, maintenanceCostBrl: maintenanceCosts.get(printer.id) ?? null,
        accumulatedHours: printer.accumulated_hours, catalogPrinterId: printer.catalog_model_id,
      }));
      products = (productResult.data ?? []).map((product) => ({ id: product.id, name: product.name, slug: product.slug, published: product.catalog_status === "published" }));
      profiles = (profileResult.data ?? []).map((profile) => ({
        id: profile.id, name: profile.profile_name, productId: profile.product_id, quantity: profile.quantity,
        materialName: profile.material_snapshot, printHours: profile.print_hours == null ? null : Number(profile.print_hours),
        materialGrams: profile.material_grams == null ? null : Number(profile.material_grams),
        materialByColor: readPrintProfileColors(profile.material_by_color), equipmentId: profile.maker_printer_id,
      }));
      savedCalculationsError = Boolean(history.error);
      savedCalculations = (history.data ?? []).flatMap((row) => {
        const validated = validateCalculationToSave(row.title, JSON.stringify(row.input_snapshot), row.product_id, row.printer_id, row.profile_id);
        if (!validated.calculation) return [];
        const linkedProduct = products.find((product) => product.id === validated.calculation.productId);
        const linkedPrinter = equipment.find((item) => item.id === validated.calculation.printerId);
        const linkedProfile = profiles.find((item) => item.id === validated.calculation.profileId);
        return [{
          id: row.id, title: row.title, createdAt: row.created_at,
          totalCostCents: validated.calculation.result.breakdown.totalCostCents,
          unitCostCents: validated.calculation.result.unitCostCents ?? 0,
          batchQuantity: validated.calculation.input.batchQuantity ?? 1,
          productId: validated.calculation.productId,
          productName: linkedProduct?.name ?? null,
          productUrl: linkedProduct?.published ? `/produtos/${linkedProduct.slug}` : null,
          printerId: validated.calculation.printerId,
          printerName: linkedPrinter?.label ?? null,
          profileId: validated.calculation.profileId,
          profileName: linkedProfile?.name ?? null,
          slicer: validated.calculation.slicer,
          snapshot: JSON.stringify({ input: validated.calculation.input, channels: validated.calculation.channels, slicer: validated.calculation.slicer }),
        }];
      });
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="calculator-page">
        <div className="calculator-page-back shell"><Link className="viewer-back-link" href="/">← Voltar para o início</Link><span>FERRAMENTA PARA MAKERS</span></div>
        <PriceCalculator equipment={equipment.map((item) => ({ ...item, catalogPrinter: catalog.printers.find((printer) => printer.id === item.catalogPrinterId) ?? null }))} products={products} profiles={profiles} materials={catalog.materials} materialNotice={catalog.error} equipmentNotice={equipmentNotice} productNotice={productNotice} profileNotice={profileNotice} canSaveCalculations={canSaveCalculations} canUseOcr={canUseOcr} ocrConfigured={ocrConfigured} savedCalculations={savedCalculations} savedCalculationsError={savedCalculationsError} />
      </main>
      <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Custos claros para produzir com confiança.</p><span>© 2026 ViraPeça 3D</span></div></footer>
    </>
  );
}
