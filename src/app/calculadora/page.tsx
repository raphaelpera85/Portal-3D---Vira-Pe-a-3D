import type { Metadata } from "next";
import Link from "next/link";
import { PriceCalculator } from "@/components/price-calculator";
import { SiteHeader } from "@/components/site-header";
import { getSiteUrl } from "@/lib/site-url";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateCalculationToSave } from "@/lib/saved-calculation";

export const metadata: Metadata = {
  title: "Calculadora de impressão 3D | ViraPeça 3D",
  description: "Calcule custos de produção e compare preços por canal de venda com taxas informadas por você.",
  ...(getSiteUrl() ? { alternates: { canonical: "/calculadora" } } : {}),
};

export const dynamic = "force-dynamic";

export default async function CalculatorPage() {
  const actor = await getUserWithRole("maker");
  const canUseOcr = Boolean(actor.supabase && actor.user && actor.authorized);
  const ocrConfigured = Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY);
  let equipment: Array<{ id: string; label: string; purchasePriceBrl: number | string | null; residualValueBrl: number | string | null; usefulLifeHours: number | string | null; averagePowerWatts: number | string | null; energyTariffPerKwh: number | string | null }> = [];
  let equipmentNotice: string | null = null;
  let canSaveCalculations = false;
  let savedCalculations: Array<{ id: string; title: string; createdAt: string; totalCostCents: number; unitCostCents: number; batchQuantity: number; snapshot: string }> = [];
  let savedCalculationsError = false;
  if (actor.supabase && actor.user && actor.authorized) {
    const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
    if (store) {
      canSaveCalculations = true;
      const [{ data, error }, history] = await Promise.all([
        actor.supabase.from("maker_printers")
          .select("id, manufacturer_snapshot, model_snapshot, nickname, purchase_price_brl, residual_value_brl, useful_life_hours, measured_average_power_w, energy_tariff_per_kwh")
          .eq("store_id", store.id).neq("operational_status", "inactive").order("nickname"),
        actor.supabase.from("maker_cost_calculations").select("id, title, input_snapshot, created_at")
          .eq("store_id", store.id).order("created_at", { ascending: false }).limit(20),
      ]);
      if (error) equipmentNotice = "Não foi possível carregar seus equipamentos. A calculadora manual continua disponível.";
      equipment = (data ?? []).map((printer) => ({
        id: printer.id, label: `${printer.nickname} · ${printer.manufacturer_snapshot} ${printer.model_snapshot}`,
        purchasePriceBrl: printer.purchase_price_brl, residualValueBrl: printer.residual_value_brl,
        usefulLifeHours: printer.useful_life_hours, averagePowerWatts: printer.measured_average_power_w,
        energyTariffPerKwh: printer.energy_tariff_per_kwh,
      }));
      savedCalculationsError = Boolean(history.error);
      savedCalculations = (history.data ?? []).flatMap((row) => {
        const validated = validateCalculationToSave(row.title, JSON.stringify(row.input_snapshot));
        return validated.calculation ? [{
          id: row.id, title: row.title, createdAt: row.created_at,
          totalCostCents: validated.calculation.result.breakdown.totalCostCents,
          unitCostCents: validated.calculation.result.unitCostCents ?? 0,
          batchQuantity: validated.calculation.input.batchQuantity ?? 1,
          snapshot: JSON.stringify({ input: validated.calculation.input, channels: validated.calculation.channels }),
        }] : [];
      });
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="calculator-page">
        <div className="calculator-page-back shell"><Link className="viewer-back-link" href="/">← Voltar para o início</Link><span>FERRAMENTA PARA MAKERS</span></div>
        <PriceCalculator equipment={equipment} equipmentNotice={equipmentNotice} canSaveCalculations={canSaveCalculations} canUseOcr={canUseOcr} ocrConfigured={ocrConfigured} savedCalculations={savedCalculations} savedCalculationsError={savedCalculationsError} />
      </main>
      <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Custos claros para produzir com confiança.</p><span>© 2026 ViraPeça 3D</span></div></footer>
    </>
  );
}
