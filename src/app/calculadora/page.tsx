import type { Metadata } from "next";
import Link from "next/link";
import { PriceCalculator, type CalculatorProduct } from "@/components/price-calculator";
import { SiteHeader } from "@/components/site-header";
import { getSiteUrl } from "@/lib/site-url";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateCalculationToSave, type CalculationOrigin, type SavedSlicerMetrics } from "@/lib/saved-calculation";
import { readPrintProfileColors } from "@/lib/print-profile-colors";
import { loadTechnicalCatalog } from "@/lib/technical-catalog.server";
import { getShowcaseModel } from "@/lib/model-showcase";

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
  let products: CalculatorProduct[] = [];
  let profiles: Array<{ id: string; name: string; productId: string | null; quantity: number; materialName: string; printHours: number | null; materialGrams: number | null; materialByColor: Array<{ color: string; grams: number | null; lengthMeters: number | null }>; equipmentId: string | null; kind?: "maker" | "model"; modelMetrics?: SavedSlicerMetrics }> = [];
  let equipmentNotice: string | null = null;
  let productNotice: string | null = null;
  let profileNotice: string | null = null;
  let canSaveCalculations = false;
  let calculationStoreId: string | null = null;
  let sourceAttachmentsError = false;
  let savedCalculations: Array<{ id: string; title: string; createdAt: string; totalCostCents: number; unitCostCents: number; batchQuantity: number; productId: string | null; productName: string | null; productUrl: string | null; priceTargetId: string | null; priceTargetName: string | null; compatibilityNozzleLabels: string[]; printerId: string | null; printerName: string | null; profileId: string | null; profileName: string | null; slicer: SavedSlicerMetrics | null; origin: CalculationOrigin; snapshot: string; attachments: { name: string; url: string; sizeBytes: number }[] }> = [];
  let savedCalculationsError = false;
  if (actor.supabase && actor.user && actor.authorized) {
    const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
    if (store) {
      calculationStoreId = store.id;
      canSaveCalculations = true;
      const [{ data, error }, history, productResult, profileResult, modelProfileResult] = await Promise.all([
        actor.supabase.from("maker_printers")
          .select("id, catalog_model_id, manufacturer_snapshot, model_snapshot, nickname, purchase_price_brl, residual_value_brl, useful_life_hours, accumulated_hours, measured_average_power_w, energy_tariff_per_kwh")
          .eq("store_id", store.id).neq("operational_status", "inactive").order("nickname"),
        actor.supabase.from("maker_cost_calculations").select("id, title, input_snapshot, product_id, printer_id, profile_id, created_at")
          .eq("store_id", store.id).order("created_at", { ascending: false }).limit(20),
        actor.supabase.from("marketplace_products").select("id, name, slug, catalog_status, listing_type, price_mode, price_brl, product_properties, variants:marketplace_product_variants(id, variant_options, price_brl)")
          .eq("store_id", store.id).order("name"),
        actor.supabase.from("maker_print_profiles").select("id, product_id, profile_name, quantity, material_snapshot, print_hours, material_grams, material_by_color, maker_printer_id")
          .eq("store_id", store.id).order("profile_name"),
        actor.supabase.from("visible_model_print_profiles").select("id, model_slug, profile_name, quantity, material_snapshot, slicer_metrics")
          .eq("is_owner", true).order("profile_name"),
      ]);
      if (error) equipmentNotice = "Não foi possível carregar seus equipamentos. A calculadora manual continua disponível.";
      if (productResult.error) productNotice = "Não foi possível carregar os produtos desta loja para vinculá-los ao cálculo.";
      if (profileResult.error || modelProfileResult.error) profileNotice = "Não foi possível carregar todos os perfis de impressão para vinculá-los ao cálculo.";
      const attachmentsByCalculation = new Map<string, { name: string; url: string; sizeBytes: number }[]>();
      if (history.data?.length) {
        const attachments = await actor.supabase.from("maker_cost_calculation_attachments")
          .select("calculation_id, storage_path, file_name, size_bytes").eq("store_id", store.id)
          .in("calculation_id", history.data.map((row) => row.id));
        if (attachments.error) sourceAttachmentsError = true;
        else {
          const signed = await Promise.all((attachments.data ?? []).map(async (attachment) => {
            const sizeBytes = Number(attachment.size_bytes);
            if (typeof attachment.file_name !== "string" || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1) return null;
            const result = await actor.supabase!.storage.from("maker-calculation-sources").createSignedUrl(attachment.storage_path, 3600, { download: attachment.file_name });
            if (result.error || !result.data?.signedUrl) { sourceAttachmentsError = true; return null; }
            return { calculationId: attachment.calculation_id, name: attachment.file_name, url: result.data.signedUrl, sizeBytes };
          }));
          for (const attachment of signed) if (attachment) {
            attachmentsByCalculation.set(attachment.calculationId, [...(attachmentsByCalculation.get(attachment.calculationId) ?? []), {
              name: attachment.name, url: attachment.url, sizeBytes: attachment.sizeBytes,
            }]);
          }
        }
      }
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
      products = (productResult.data ?? []).map((product) => {
        const properties = product.product_properties && typeof product.product_properties === "object" && !Array.isArray(product.product_properties)
          ? product.product_properties as Record<string, unknown> : {};
        const options = properties.variant_options;
        const hasVariants = options !== null && typeof options === "object" && !Array.isArray(options) && Object.keys(options).length > 0;
        const priceMode = product.price_mode as CalculatorProduct["priceMode"];
        const listingType = product.listing_type as CalculatorProduct["listingType"];
        const published = product.catalog_status === "published";
        const priceBrl = product.price_brl == null ? null : Number(product.price_brl);
        const variants = Array.isArray(product.variants) ? product.variants.flatMap((variant: Record<string, unknown>) => {
          const options = variant.variant_options && typeof variant.variant_options === "object" && !Array.isArray(variant.variant_options)
            ? variant.variant_options as Record<string, unknown> : null;
          const variantPrice = Number(variant.price_brl);
          return typeof variant.id === "string" && options && Object.values(options).every((value) => typeof value === "string")
            && Number.isFinite(variantPrice) && variantPrice > 0
            ? [{ id: variant.id, options: options as Record<string, string>, priceBrl: variantPrice }]
            : [];
        }) : [];
        return {
          id: product.id, name: product.name, slug: product.slug, published, listingType, priceMode, priceBrl, variants,
          canApplyPrice: (product.catalog_status === "draft" || published) && listingType === "physical"
            && (hasVariants ? priceMode === "fixed" && variants.length > 0 : (priceMode === "fixed" || priceMode === "from") && Number.isFinite(priceBrl) && (priceBrl ?? 0) > 0),
        };
      });
      const makerProfiles = (profileResult.data ?? []).map((profile) => ({
        id: profile.id, name: profile.profile_name, productId: profile.product_id, quantity: profile.quantity,
        materialName: profile.material_snapshot, printHours: profile.print_hours == null ? null : Number(profile.print_hours),
        materialGrams: profile.material_grams == null ? null : Number(profile.material_grams),
        materialByColor: readPrintProfileColors(profile.material_by_color), equipmentId: profile.maker_printer_id, kind: "maker" as const,
      }));
      const modelProfiles = (modelProfileResult.data ?? []).flatMap((profile) => {
        const model = getShowcaseModel(profile.model_slug);
        const metrics = profile.slicer_metrics as SavedSlicerMetrics;
        return model && metrics && Array.isArray(metrics.filaments) ? [{
          id: `model:${profile.id}`, name: `${model.name} · ${profile.profile_name}`, productId: null, quantity: profile.quantity,
          materialName: profile.material_snapshot, printHours: metrics.printHours, materialGrams: metrics.filamentGrams,
          materialByColor: metrics.filaments.flatMap((item) => item.color && /^#[0-9a-f]{6}$/i.test(item.color) && (item.grams != null || item.lengthMeters != null) ? [{ color: item.color, grams: item.grams, lengthMeters: item.lengthMeters }] : []),
          equipmentId: null, kind: "model" as const, modelMetrics: metrics,
        }] : [];
      });
      profiles = [...makerProfiles, ...modelProfiles];
      savedCalculationsError = Boolean(history.error);
      savedCalculations = (history.data ?? []).flatMap((row) => {
        const validated = validateCalculationToSave(row.title, JSON.stringify(row.input_snapshot), row.product_id, row.printer_id, row.profile_id);
        if (!validated.calculation) return [];
        const linkedProduct = products.find((product) => product.id === validated.calculation.productId);
        const priceTargetProduct = products.find((product) => product.id === validated.calculation.priceTargetId
          || product.variants.some((variant) => variant.id === validated.calculation.priceTargetId));
        const priceTargetVariant = priceTargetProduct?.variants.find((variant) => variant.id === validated.calculation.priceTargetId);
        const compatibilityChecks = [validated.calculation.compatibilityNozzles.main, ...validated.calculation.compatibilityNozzles.components];
        const compatibilityNozzleLabels = compatibilityChecks.flatMap((check, index) => check.nozzleId ? [
          `${index === 0 ? "Execução principal" : validated.calculation.input.productionComponents?.[index - 1]?.name || `Componente ${index}`} · ${catalog.nozzles.find((nozzle) => nozzle.id === check.nozzleId)?.name ?? "bico não disponível no catálogo"}`,
        ] : []);
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
          priceTargetId: validated.calculation.priceTargetId,
          priceTargetName: priceTargetProduct ? `${priceTargetProduct.name}${priceTargetVariant ? ` · ${Object.entries(priceTargetVariant.options).map(([name, value]) => `${name}: ${value}`).join(" · ")}` : ""}` : null,
          compatibilityNozzleLabels,
          printerId: validated.calculation.printerId,
          printerName: linkedPrinter?.label ?? null,
          profileId: validated.calculation.profileId,
          profileName: linkedProfile?.name ?? null,
          slicer: validated.calculation.slicer,
          origin: validated.calculation.origin,
          attachments: attachmentsByCalculation.get(row.id) ?? [],
          snapshot: JSON.stringify({ input: validated.calculation.input, channels: validated.calculation.channels, slicer: validated.calculation.slicer, origin: validated.calculation.origin, priceTargetId: validated.calculation.priceTargetId, compatibilityNozzles: validated.calculation.compatibilityNozzles }),
        }];
      });
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="calculator-page">
        <div className="calculator-page-back shell"><Link className="viewer-back-link" href="/">← Voltar para o início</Link><span>FERRAMENTA PARA MAKERS</span></div>
        <PriceCalculator equipment={equipment.map((item) => ({ ...item, catalogPrinter: catalog.printers.find((printer) => printer.id === item.catalogPrinterId) ?? null }))} products={products} profiles={profiles} materials={catalog.materials} nozzles={catalog.nozzles} materialNotice={catalog.error} equipmentNotice={equipmentNotice} productNotice={productNotice} profileNotice={profileNotice} canSaveCalculations={canSaveCalculations} canUseOcr={canUseOcr} ocrConfigured={ocrConfigured} savedCalculations={savedCalculations} savedCalculationsError={savedCalculationsError} storeId={calculationStoreId} sourceAttachmentsError={sourceAttachmentsError} />
      </main>
      <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Custos claros para produzir com confiança.</p><span>© 2026 ViraPeça 3D</span></div></footer>
    </>
  );
}
