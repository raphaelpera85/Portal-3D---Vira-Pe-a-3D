"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { CirclePlus, Calculator, Trash2 } from "lucide-react";
import { calculatePrintPrice, MAX_BATCH_QUANTITY, MAX_PRODUCTION_COMPONENTS, type PrintCostInput, type ProductionComponent, type SalesChannel } from "@/lib/pricing";
import { deriveEquipmentRates, type EquipmentRateInput } from "@/lib/printer-equipment";
import { deleteMakerCalculation, saveMakerCalculation } from "@/app/calculadora/actions";
import { SlicerImageImporter } from "@/components/slicer-image-importer";
import type { parseSlicerOcrTexts } from "@/lib/slicer-ocr";

type FormFields = Record<keyof Omit<PrintCostInput, "additionalCosts" | "productionComponents" | "targetMarginPercent"> | "targetMarginPercent", string>;
type ChannelFields = Omit<SalesChannel, "feePercent" | "fixedFee"> & { feePercent: string; fixedFee: string };
type ExtraField = { id: string; name: string; amount: string };
type ProductionComponentFields = { id: string; equipmentId: string } & Omit<Record<keyof ProductionComponent, string>, "id">;
type CalculatorEquipment = EquipmentRateInput & { id: string; label: string };
type SavedCalculation = { id: string; title: string; createdAt: string; totalCostCents: number; unitCostCents: number; batchQuantity: number; snapshot: string };

const initialFields: FormFields = {
  batchQuantity: "1", batchFixedCost: "", filamentGrams: "", filamentPricePerKg: "", printHours: "", averagePowerWatts: "",
  energyPricePerKwh: "", machineCostPerHour: "", depreciationPerHour: "",
  maintenancePerHour: "", laborMinutes: "", laborRatePerHour: "", overheadPerUnit: "",
  failureReservePercent: "", targetMarginPercent: "",
};

const initialChannels: ChannelFields[] = [
  { id: "marketplace", name: "Marketplace", feePercent: "", fixedFee: "" },
  { id: "loja", name: "Loja própria", feePercent: "", fixedFee: "" },
  { id: "consignacao", name: "Consignação", feePercent: "", fixedFee: "" },
];

const money = (cents: number | null | undefined) => cents == null
  ? "—"
  : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const numberValue = (value: string) => value.trim() === "" ? 0 : Number(value.replace(",", "."));

function CostField({ label, suffix, hint, value, onChange, step = "any", min = 0, max, idSuffix = "" }: {
  label: string; suffix?: string; hint?: string; value: string; onChange: (value: string) => void; step?: string; min?: number; max?: number; idSuffix?: string;
}) {
  const id = `cost-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}${idSuffix ? `-${idSuffix}` : ""}`;
  return (
    <label className="price-field" htmlFor={id}>
      <span>{label}</span>
      <div className="price-input-wrap"><input id={id} type="number" min={min} max={max} step={step} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} /><small>{suffix}</small></div>
      {hint && <small className="price-field-hint">{hint}</small>}
    </label>
  );
}

export function PriceCalculator({ equipment = [], equipmentNotice = null, canSaveCalculations = false, canUseOcr = false, ocrConfigured = false, savedCalculations = [], savedCalculationsError = false }: {
  equipment?: CalculatorEquipment[]; equipmentNotice?: string | null; canSaveCalculations?: boolean; canUseOcr?: boolean; ocrConfigured?: boolean;
  savedCalculations?: SavedCalculation[]; savedCalculationsError?: boolean;
}) {
  const [fields, setFields] = useState(initialFields);
  const [extras, setExtras] = useState<ExtraField[]>([]);
  const [productionComponents, setProductionComponents] = useState<ProductionComponentFields[]>([]);
  const [channels, setChannels] = useState(initialChannels);
  const [calculationTitle, setCalculationTitle] = useState("");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [saveState, saveAction, saving] = useActionState(saveMakerCalculation, { message: "", success: false });
  const parsedChannels: SalesChannel[] = channels.map((channel) => ({
    ...channel,
    feePercent: numberValue(channel.feePercent),
    fixedFee: numberValue(channel.fixedFee),
  }));
  const input: PrintCostInput = {
    batchQuantity: numberValue(fields.batchQuantity),
    batchFixedCost: numberValue(fields.batchFixedCost),
    productionComponents: productionComponents.map(({ id, equipmentId, ...component }) => ({
      ...component,
      piecesPerProduct: numberValue(component.piecesPerProduct),
      filamentGrams: numberValue(component.filamentGrams),
      filamentPricePerKg: numberValue(component.filamentPricePerKg),
      printHours: numberValue(component.printHours),
      averagePowerWatts: numberValue(component.averagePowerWatts),
      energyPricePerKwh: numberValue(component.energyPricePerKwh),
      machineCostPerHour: numberValue(component.machineCostPerHour),
      depreciationPerHour: numberValue(component.depreciationPerHour),
      maintenancePerHour: numberValue(component.maintenancePerHour),
      laborMinutes: numberValue(component.laborMinutes),
      laborRatePerHour: numberValue(component.laborRatePerHour),
    })),
    filamentGrams: numberValue(fields.filamentGrams),
    filamentPricePerKg: numberValue(fields.filamentPricePerKg),
    printHours: numberValue(fields.printHours),
    averagePowerWatts: numberValue(fields.averagePowerWatts),
    energyPricePerKwh: numberValue(fields.energyPricePerKwh),
    machineCostPerHour: numberValue(fields.machineCostPerHour),
    depreciationPerHour: numberValue(fields.depreciationPerHour),
    maintenancePerHour: numberValue(fields.maintenancePerHour),
    laborMinutes: numberValue(fields.laborMinutes),
    laborRatePerHour: numberValue(fields.laborRatePerHour),
    overheadPerUnit: numberValue(fields.overheadPerUnit),
    failureReservePercent: numberValue(fields.failureReservePercent),
    targetMarginPercent: numberValue(fields.targetMarginPercent),
    additionalCosts: extras.map(({ name, amount }) => ({ name, amount: numberValue(amount) })),
  };
  const result = useMemo(() => calculatePrintPrice(input, parsedChannels), [fields, extras, productionComponents, channels]);
  const hasProductionCost = Boolean(result.breakdown?.totalCostCents);
  const hasCurrentValues = Object.entries(fields).some(([key, value]) => value !== "" && key !== "batchQuantity" && key !== "batchFixedCost") || extras.length > 0
    || productionComponents.length > 0
    || channels.some((channel) => channel.feePercent !== "" || channel.fixedFee !== "" || !initialChannels.some((initial) => initial.id === channel.id && initial.name === channel.name));

  function updateField(field: keyof FormFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  function updateChannel(id: string, field: "name" | "feePercent" | "fixedFee", value: string) {
    setChannels((current) => current.map((channel) => channel.id === id ? { ...channel, [field]: value } : channel));
  }

  function addExtra() {
    setExtras((current) => [...current, { id: crypto.randomUUID(), name: "", amount: "" }]);
  }

  function addProductionComponent() {
    setProductionComponents((current) => current.length >= MAX_PRODUCTION_COMPONENTS ? current : [...current, {
      id: crypto.randomUUID(), equipmentId: "", name: "", material: "", printer: "", piecesPerProduct: "1",
      filamentGrams: "", filamentPricePerKg: "", printHours: "", averagePowerWatts: "", energyPricePerKwh: "",
      machineCostPerHour: "", depreciationPerHour: "", maintenancePerHour: "", laborMinutes: "", laborRatePerHour: "",
    }]);
  }

  function updateProductionComponent(id: string, field: keyof ProductionComponentFields, value: string) {
    setProductionComponents((current) => current.map((component) => component.id === id ? { ...component, [field]: value } : component));
  }

  function selectComponentEquipment(componentId: string, equipmentId: string) {
    const selected = equipment.find((item) => item.id === equipmentId);
    updateProductionComponent(componentId, "equipmentId", equipmentId);
    if (!selected) return;
    const rates = deriveEquipmentRates(selected);
    setProductionComponents((current) => current.map((component) => component.id === componentId ? {
      ...component,
      printer: selected.label,
      ...(rates.averagePowerWatts == null ? {} : { averagePowerWatts: String(rates.averagePowerWatts) }),
      ...(rates.energyTariffPerKwh == null ? {} : { energyPricePerKwh: String(rates.energyTariffPerKwh) }),
      ...(rates.depreciationPerHour == null ? {} : { depreciationPerHour: String(rates.depreciationPerHour) }),
    } : component));
  }

  function addChannel() {
    setChannels((current) => [...current, { id: crypto.randomUUID(), name: "Novo canal", feePercent: "", fixedFee: "" }]);
  }

  function selectEquipment(id: string) {
    const selected = equipment.find((item) => item.id === id);
    if (!selected) return;
    setSelectedEquipmentId(id);
    const rates = deriveEquipmentRates(selected);
    setFields((current) => ({
      ...current,
      ...(rates.averagePowerWatts == null ? {} : { averagePowerWatts: String(rates.averagePowerWatts) }),
      ...(rates.energyTariffPerKwh == null ? {} : { energyPricePerKwh: String(rates.energyTariffPerKwh) }),
      ...(rates.depreciationPerHour == null ? {} : { depreciationPerHour: String(rates.depreciationPerHour) }),
    }));
  }

  function applyOcr(extraction: ReturnType<typeof parseSlicerOcrTexts>): boolean | null {
    if (extraction.filamentGrams == null && extraction.printHours == null) return false;
    if ((fields.filamentGrams !== "" || fields.printHours !== "") && !window.confirm("Preencher com os dados reconhecidos substituirá os valores atuais de peso e tempo. Continuar?")) return null;
    setFields((current) => ({
      ...current,
      ...(extraction.filamentGrams == null ? {} : { filamentGrams: String(extraction.filamentGrams) }),
      ...(extraction.printHours == null ? {} : { printHours: String(extraction.printHours) }),
    }));
    return true;
  }

  function duplicateCalculation(snapshot: string, title: string) {
    if (hasCurrentValues && !window.confirm("Abrir esta cópia substituirá os valores atuais da calculadora. Deseja continuar?")) return;
    try {
      const saved = JSON.parse(snapshot) as { input?: PrintCostInput; channels?: SalesChannel[] };
      if (!saved.input || !Array.isArray(saved.channels)) return;
      setFields(Object.fromEntries(Object.entries(saved.input).filter(([key]) => key !== "additionalCosts" && key !== "productionComponents").map(([key, value]) => [key, String(value)])) as FormFields);
      setExtras(saved.input.additionalCosts.map((item) => ({ id: crypto.randomUUID(), name: item.name, amount: String(item.amount) })));
      setProductionComponents((saved.input.productionComponents ?? []).map((component) => ({
        id: crypto.randomUUID(), equipmentId: "", ...Object.fromEntries(Object.entries(component).map(([key, value]) => [key, String(value)])),
      } as ProductionComponentFields)));
      setChannels(saved.channels.map((channel) => ({ ...channel, feePercent: String(channel.feePercent), fixedFee: String(channel.fixedFee) })));
      setCalculationTitle(`${title} (cópia)`.slice(0, 80));
      setSelectedEquipmentId("");
    } catch { /* Invalid saved data is ignored. */ }
  }

  const breakdown = result.breakdown;

  return (
    <section className="price-calculator shell" aria-label="Calculadora de custos de impressão 3D">
      <div className="price-intro">
        <div>
          <p className="eyebrow"><Calculator size={14} aria-hidden="true" /> PRECIFICAÇÃO MANUAL</p>
          <h1>Saiba quanto custa.<br /><em>Escolha quanto vale.</em></h1>
          <p className="price-intro-copy">Some material, máquina e trabalho. Compare canais usando as taxas reais que você informar.</p>
        </div>
        <div className="price-note"><span className="price-note-mark">01</span><p>O cálculo funciona sem OCR. Nenhuma taxa de plataforma é presumida.</p></div>
      </div>
      {equipmentNotice && <p className="auth-notice is-error" role="status">{equipmentNotice}</p>}
      <SlicerImageImporter enabled={canUseOcr} configured={ocrConfigured} onApply={applyOcr} />

      <div className="price-layout">
        <div className="price-forms">
          <section className="price-card">
            <div className="price-card-heading"><span className="price-step">01</span><div><h2>Lote e material</h2><p>Informe quantas peças saem desta execução. Consumo e tempo do fatiador são os totais do lote, sem multiplicação automática.</p></div></div>
            <div className="price-fields-grid">
              <CostField label="Peças prontas no lote" suffix="un." step="1" max={MAX_BATCH_QUANTITY} value={fields.batchQuantity} onChange={(value) => updateField("batchQuantity", value)} />
              <CostField label="Material consumido no lote" suffix="g" hint="Inclua o consumo da execução completa, com suportes e purga quando disponíveis." value={fields.filamentGrams} onChange={(value) => updateField("filamentGrams", value)} />
              <CostField label="Preço de compra" suffix="R$/kg" value={fields.filamentPricePerKg} onChange={(value) => updateField("filamentPricePerKg", value)} />
            </div>
          </section>

          <section className="price-card">
            <div className="price-card-heading"><span className="price-step">02</span><div><h2>Máquina e energia</h2><p>Use horas, potência e custos medidos para a execução completa do lote. O tempo da impressora é contado uma vez.</p></div></div>
            {equipment.length > 0 && <label className="equipment-calculator-select">Equipamento cadastrado<select value={selectedEquipmentId} onChange={(event) => selectEquipment(event.target.value)}><option value="">Sem equipamento (manter campos manuais)</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><small>Selecionar preenche apenas dados registrados; os campos continuam editáveis.</small></label>}
            <div className="price-fields-grid">
              <CostField label="Tempo de impressão" suffix="horas" value={fields.printHours} onChange={(value) => updateField("printHours", value)} />
              <CostField label="Potência média" suffix="W" hint="Use a média medida, não a potência nominal." value={fields.averagePowerWatts} onChange={(value) => updateField("averagePowerWatts", value)} />
              <CostField label="Tarifa de energia" suffix="R$/kWh" value={fields.energyPricePerKwh} onChange={(value) => updateField("energyPricePerKwh", value)} />
              <CostField label="Operação da máquina" suffix="R$/h" hint="Sem depreciação nem manutenção." value={fields.machineCostPerHour} onChange={(value) => updateField("machineCostPerHour", value)} />
              <CostField label="Depreciação" suffix="R$/h" value={fields.depreciationPerHour} onChange={(value) => updateField("depreciationPerHour", value)} />
              <CostField label="Manutenção rateada" suffix="R$/h" value={fields.maintenancePerHour} onChange={(value) => updateField("maintenancePerHour", value)} />
            </div>
            <div className="price-subheading"><h3>Outros arquivos e componentes impressos</h3><button type="button" className="price-add-button" onClick={addProductionComponent} disabled={productionComponents.length >= MAX_PRODUCTION_COMPONENTS}><CirclePlus size={15} /> Adicionar componente</button></div>
            <p className="price-field-hint">Cada componente representa o total de material, tempo e custos de todas as execuções necessárias para este lote. Informe no tempo total quantas execuções foram necessárias; não multiplicamos pelas peças.</p>
            {productionComponents.length > 0 && <div className="production-component-list">{productionComponents.map((component) => <article className="production-component-card" key={component.id}>
              <div className="production-component-heading"><strong>Componente de produção</strong><button type="button" aria-label={`Remover ${component.name || "componente"}`} onClick={() => setProductionComponents((current) => current.filter((item) => item.id !== component.id))}><Trash2 size={15} /></button></div>
              <div className="price-fields-grid production-component-identification">
                <label className="price-field"><span>Arquivo ou componente</span><div className="price-input-wrap"><input type="text" maxLength={80} value={component.name} onChange={(event) => updateProductionComponent(component.id, "name", event.target.value)} placeholder="Ex.: Tampa" /></div></label>
                <label className="price-field"><span>Material</span><div className="price-input-wrap"><input type="text" maxLength={80} value={component.material} onChange={(event) => updateProductionComponent(component.id, "material", event.target.value)} placeholder="Ex.: PETG" /></div></label>
                <label className="price-field"><span>Impressora</span><div className="price-input-wrap"><input type="text" maxLength={120} value={component.printer} onChange={(event) => updateProductionComponent(component.id, "printer", event.target.value)} placeholder="Ex.: Impressora B" /></div></label>
                <CostField label="Quantidade por produto final" suffix="un." step="1" max={MAX_BATCH_QUANTITY} value={component.piecesPerProduct} onChange={(value) => updateProductionComponent(component.id, "piecesPerProduct", value)} idSuffix={component.id} />
              </div>
              {equipment.length > 0 && <label className="equipment-calculator-select production-equipment-select">Equipamento cadastrado para este componente<select value={component.equipmentId} onChange={(event) => selectComponentEquipment(component.id, event.target.value)}><option value="">Informar custos manualmente</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><small>Preenche a impressora, potência, tarifa e depreciação conhecidos; os campos permanecem editáveis.</small></label>}
              <div className="price-fields-grid production-component-costs">
                <CostField label="Material consumido no componente" suffix="g" value={component.filamentGrams} onChange={(value) => updateProductionComponent(component.id, "filamentGrams", value)} idSuffix={component.id} />
                <CostField label="Preço do material" suffix="R$/kg" value={component.filamentPricePerKg} onChange={(value) => updateProductionComponent(component.id, "filamentPricePerKg", value)} idSuffix={component.id} />
                <CostField label="Tempo total das execuções" suffix="horas" value={component.printHours} onChange={(value) => updateProductionComponent(component.id, "printHours", value)} idSuffix={component.id} />
                <CostField label="Potência média" suffix="W" value={component.averagePowerWatts} onChange={(value) => updateProductionComponent(component.id, "averagePowerWatts", value)} idSuffix={component.id} />
                <CostField label="Tarifa de energia" suffix="R$/kWh" value={component.energyPricePerKwh} onChange={(value) => updateProductionComponent(component.id, "energyPricePerKwh", value)} idSuffix={component.id} />
                <CostField label="Operação da máquina" suffix="R$/h" value={component.machineCostPerHour} onChange={(value) => updateProductionComponent(component.id, "machineCostPerHour", value)} idSuffix={component.id} />
                <CostField label="Depreciação" suffix="R$/h" value={component.depreciationPerHour} onChange={(value) => updateProductionComponent(component.id, "depreciationPerHour", value)} idSuffix={component.id} />
                <CostField label="Manutenção rateada" suffix="R$/h" value={component.maintenancePerHour} onChange={(value) => updateProductionComponent(component.id, "maintenancePerHour", value)} idSuffix={component.id} />
                <CostField label="Mão de obra total" suffix="min" value={component.laborMinutes} onChange={(value) => updateProductionComponent(component.id, "laborMinutes", value)} idSuffix={component.id} />
                <CostField label="Valor da mão de obra" suffix="R$/h" value={component.laborRatePerHour} onChange={(value) => updateProductionComponent(component.id, "laborRatePerHour", value)} idSuffix={component.id} />
              </div>
              <p className="price-field-hint">Este componente exige {numberValue(component.piecesPerProduct) * (input.batchQuantity ?? 1)} unidade(s) no lote. O peso e o tempo acima são os totais já medidos para essas unidades.</p>
            </article>)}</div>}
          </section>

          <section className="price-card">
            <div className="price-card-heading"><span className="price-step">03</span><div><h2>Trabalho e outros custos</h2><p>Informe a mão de obra da execução, componentes por peça e um custo fixo único do lote.</p></div></div>
            <div className="price-fields-grid">
              <CostField label="Mão de obra do lote" suffix="min" value={fields.laborMinutes} onChange={(value) => updateField("laborMinutes", value)} />
              <CostField label="Valor da mão de obra" suffix="R$/h" value={fields.laborRatePerHour} onChange={(value) => updateField("laborRatePerHour", value)} />
              <CostField label="Custo rateado por peça" suffix="R$/peça" value={fields.overheadPerUnit} onChange={(value) => updateField("overheadPerUnit", value)} />
              <CostField label="Custo fixo do lote" suffix="R$/lote" value={fields.batchFixedCost} onChange={(value) => updateField("batchFixedCost", value)} />
              <CostField label="Reserva para falhas" suffix="%" value={fields.failureReservePercent} onChange={(value) => updateField("failureReservePercent", value)} />
            </div>
            <div className="price-subheading"><h3>Componentes por peça</h3><button type="button" className="price-add-button" onClick={addExtra}><CirclePlus size={15} /> Adicionar item</button></div>
            {extras.length === 0 ? <p className="price-empty-line">Ímãs, parafusos, tinta, embalagem e outros itens são multiplicados pela quantidade do lote.</p> : <div className="extra-costs-list">
              {extras.map((extra) => <div className="extra-cost-row" key={extra.id}>
                <label><span className="sr-only">Nome do componente</span><input type="text" placeholder="Ex.: ímãs" value={extra.name} onChange={(event) => setExtras((current) => current.map((item) => item.id === extra.id ? { ...item, name: event.target.value } : item))} /></label>
                <label><span className="sr-only">Custo do componente em reais</span><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="R$ 0,00" value={extra.amount} onChange={(event) => setExtras((current) => current.map((item) => item.id === extra.id ? { ...item, amount: event.target.value } : item))} /></label>
                <button type="button" aria-label={`Remover ${extra.name || "componente"}`} onClick={() => setExtras((current) => current.filter((item) => item.id !== extra.id))}><Trash2 size={15} /></button>
              </div>)}
            </div>}
          </section>

          <section className="price-card">
            <div className="price-card-heading"><span className="price-step">04</span><div><h2>Margem e canais</h2><p>Informe as condições que você paga em cada canal. O preço é calculado para atingir a margem após as taxas.</p></div></div>
            <div className="price-margin-field"><CostField label="Margem desejada sobre o preço" suffix="%" hint="Margem é lucro dividido pelo preço de venda; não é markup." value={fields.targetMarginPercent} onChange={(value) => updateField("targetMarginPercent", value)} /></div>
            <div className="price-channels">
              {channels.map((channel) => <div className="price-channel-row" key={channel.id}>
                <label><span className="sr-only">Nome do canal de venda</span><input type="text" value={channel.name} onChange={(event) => updateChannel(channel.id, "name", event.target.value)} /></label>
                <label><span>Taxa</span><span className="price-channel-input"><input type="number" min="0" max="99.99" step="0.01" inputMode="decimal" placeholder="0" value={channel.feePercent} onChange={(event) => updateChannel(channel.id, "feePercent", event.target.value)} /><small>%</small></span></label>
                <label><span>Fixa</span><span className="price-channel-input"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" value={channel.fixedFee} onChange={(event) => updateChannel(channel.id, "fixedFee", event.target.value)} /><small>R$</small></span></label>
                <button type="button" className="price-remove-channel" aria-label={`Remover canal ${channel.name}`} onClick={() => setChannels((current) => current.filter((item) => item.id !== channel.id))}><Trash2 size={15} /></button>
              </div>)}
            </div>
            <button type="button" className="price-add-button" onClick={addChannel}><CirclePlus size={15} /> Comparar outro canal</button>
            <p className="price-disclaimer">Confirme taxas e tarifas fixas nos termos vigentes do seu canal. O ViraPeça não preenche essas condições automaticamente.</p>
          </section>
        </div>

        <aside className="price-results" aria-live="polite">
          <div className="price-results-head"><span>RESUMO DO LOTE</span><Calculator size={18} aria-hidden="true" /></div>
          {result.errors.length > 0 && <div className="price-error" role="alert">{result.errors.map((error) => <p key={error}>{error}</p>)}</div>}
          <div className="price-total-cost"><span>Custo total do lote · {input.batchQuantity} {input.batchQuantity === 1 ? "peça" : "peças"}</span><strong>{hasProductionCost ? money(breakdown?.totalCostCents) : "—"}</strong></div>
          <p className="price-total-hint">{hasProductionCost ? `Custo unitário estimado: ${money(result.unitCostCents)}. O valor arredondado para cima protege o custo total do lote.` : "Preencha os custos da execução para ver a composição."}</p>
          <div className="price-breakdown">
            {[
              ["Material", breakdown?.materialCents], ["Energia", breakdown?.energyCents],
              ["Operação da máquina", breakdown?.machineCents], ["Depreciação", breakdown?.depreciationCents],
              ["Manutenção", breakdown?.maintenanceCents], ["Mão de obra", breakdown?.laborCents],
              ["Componentes adicionais", breakdown?.additionalCents], ["Custos fixos rateados", breakdown?.overheadCents],
              ["Custo fixo do lote", breakdown?.batchFixedCents], ["Reserva para falhas", breakdown?.failureReserveCents],
            ].map(([label, value]) => <div className="price-breakdown-row" key={String(label)}><span>{label}</span><strong>{hasProductionCost ? money(value as number) : "—"}</strong></div>)}
          </div>
          <div className="price-scenario-heading"><h2>Preço unitário por canal</h2><span>meta: {fields.targetMarginPercent ? `${fields.targetMarginPercent}%` : "—"}</span></div>
          <div className="price-scenario-list">
            {channels.map((channel) => {
              const scenario = result.channels.find((item) => item.id === channel.id);
              const ready = fields.targetMarginPercent !== "" && channel.feePercent !== "" && channel.fixedFee !== "";
              return <article className="price-scenario" key={channel.id}>
                <div className="price-scenario-top"><span>{channel.name || "Canal sem nome"}</span><strong>{ready && !result.errors.length ? money(scenario?.priceCents) : "—"}</strong></div>
                <p>{ready && scenario?.profitCents != null ? `Lucro ${money(scenario.profitCents)} · margem ${scenario.actualMarginPercent?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "Informe a margem e as taxas deste canal."}</p>
              </article>;
            })}
          </div>
          <p className="price-disclaimer">Estimativa manual: não inclui impostos, frete, tarifas não informadas ou custos de produção não preenchidos.</p>
        </aside>
      </div>

      <section className="price-history" aria-labelledby="price-history-title">
        <div className="price-history-heading"><div><p className="eyebrow">CÁLCULOS DA SUA LOJA</p><h2 id="price-history-title">Histórico salvo</h2><p>Snapshots preservam os valores usados no momento do cálculo.</p></div></div>
        {canSaveCalculations ? <>
          <form action={saveAction} className="price-save-form">
            <label htmlFor="calculation-title">Nome do cálculo<input id="calculation-title" name="title" value={calculationTitle} onChange={(event) => setCalculationTitle(event.target.value)} minLength={2} maxLength={80} required placeholder="Ex.: Suporte de mesa · PLA" /></label>
            <input type="hidden" name="snapshot" value={JSON.stringify({ input, channels: parsedChannels })} />
            <button className="button button-primary" type="submit" disabled={saving || !hasProductionCost || result.errors.length > 0}>{saving ? "Salvando…" : "Salvar cálculo"}</button>
            {saveState.message && <p className={saveState.success ? "auth-notice is-success" : "auth-notice is-error"} role="status">{saveState.message}</p>}
          </form>
          {savedCalculationsError ? <p className="auth-notice is-error" role="alert">Não foi possível carregar o histórico. Confira se a migração da calculadora está aplicada.</p> : savedCalculations.length === 0 ? <p className="price-history-empty">Os cálculos salvos aparecerão aqui.</p> : <div className="price-history-list">{savedCalculations.map((saved) => <article className="price-history-item" key={saved.id}>
            <div><strong>{saved.title}</strong><span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(saved.createdAt))} · {saved.batchQuantity} peças · lote {money(saved.totalCostCents)} · unidade {money(saved.unitCostCents)}</span></div>
            <div className="price-history-actions"><button className="button button-secondary" type="button" onClick={() => duplicateCalculation(saved.snapshot, saved.title)}>Abrir como cópia</button><form action={deleteMakerCalculation} onSubmit={(event) => { if (!window.confirm(`Excluir “${saved.title}” do histórico?`)) event.preventDefault(); }}><input type="hidden" name="calculationId" value={saved.id} /><button className="price-history-delete" type="submit">Excluir</button></form></div>
          </article>)}</div>}
        </> : <div className="price-history-locked"><p>Entre com uma conta de fabricante e loja aprovada para manter um histórico privado dos seus custos.</p><Link className="button button-secondary" href="/conta">Acessar conta</Link></div>}
      </section>
    </section>
  );
}
