"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { CirclePlus, Calculator, Trash2 } from "lucide-react";
import { calculatePrintPrice, MAX_BATCH_QUANTITY, MAX_PRODUCTION_COMPONENTS, type PrintCostInput, type ProductionComponent, type SalesChannel } from "@/lib/pricing";
import { exportPrintCalculationCsv } from "@/lib/pricing-export";
import { deriveEquipmentRates, type EquipmentRateInput } from "@/lib/printer-equipment";
import { evaluateMaterialCompatibility, type CatalogPrinter } from "@/lib/compatibility";
import type { MaterialEntry } from "@/lib/technical-catalog";
import { deleteMakerCalculation, saveMakerCalculation } from "@/app/calculadora/actions";
import { SlicerImageImporter } from "@/components/slicer-image-importer";
import type { parseSlicerOcrTexts } from "@/lib/slicer-ocr";

type FormFields = Record<keyof Omit<PrintCostInput, "additionalCosts" | "productionComponents" | "pricingMode">, string>;
type ChannelFields = Omit<SalesChannel, "feePercent" | "fixedFee"> & { feePercent: string; fixedFee: string };
type ExtraField = { id: string; name: string; amount: string };
type ProductionComponentFields = { id: string; equipmentId: string } & Omit<Record<keyof ProductionComponent, string>, "id">;
type CalculatorEquipment = EquipmentRateInput & { id: string; label: string; catalogPrinter?: CatalogPrinter | null };
type CalculatorProduct = { id: string; name: string; slug: string; published: boolean };
type CalculatorProfile = { id: string; name: string };
type CalculatorMaterial = MaterialEntry;
type SavedCalculation = { id: string; title: string; createdAt: string; totalCostCents: number; unitCostCents: number; batchQuantity: number; productId: string | null; productName: string | null; productUrl: string | null; printerId: string | null; printerName: string | null; profileId: string | null; profileName: string | null; snapshot: string };

const initialFields: FormFields = {
  batchQuantity: "1", batchFixedCost: "", material: "", filamentGrams: "", filamentPricePerKg: "", printHours: "", averagePowerWatts: "",
  energyPricePerKwh: "", machineCostPerHour: "", depreciationPerHour: "",
  maintenancePerHour: "", laborMinutes: "", laborRatePerHour: "", overheadPerUnit: "",
  failureReservePercent: "", targetMarginPercent: "", targetMarkupPercent: "",
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
const materialLabel = (material?: CalculatorMaterial) => material ? `${material.brand} · ${material.name} (${material.family})` : "";
const compatibilityText = { compatible: "Compatível", conditional: "Compatível com condições", incompatible: "Incompatível", unverified: "Não verificado" };

function MaterialCompatibilityNote({ equipmentId, materialName, equipment, materials }: {
  equipmentId: string; materialName: string; equipment: CalculatorEquipment[]; materials: CalculatorMaterial[];
}) {
  if (!equipmentId) return null;
  const selectedEquipment = equipment.find((item) => item.id === equipmentId);
  if (!selectedEquipment) return null;
  const material = materials.find((item) => materialLabel(item) === materialName);
  const evaluation = selectedEquipment.catalogPrinter && material
    ? evaluateMaterialCompatibility(selectedEquipment.catalogPrinter, material)
    : null;
  const status = evaluation?.status ?? "unverified";
  const message = !material
    ? "Selecione um material do catálogo para conferir os dados técnicos; materiais informados manualmente não são verificados."
    : !selectedEquipment.catalogPrinter
      ? "Este equipamento não está vinculado a um modelo publicado no catálogo."
      : null;

  return <div className={`calculator-compatibility is-${status}`} role="status">
    <strong>Material e impressora: {compatibilityText[status]}</strong>
    <small>A avaliação não inclui o bico instalado.</small>
    {message ? <p>{message}</p> : <ul>{evaluation?.checks.map((check) => <li key={check.key}>{check.label}: {check.detail}</li>)}</ul>}
  </div>;
}

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

export function PriceCalculator({ equipment = [], products = [], profiles = [], materials = [], materialNotice = null, equipmentNotice = null, productNotice = null, profileNotice = null, canSaveCalculations = false, canUseOcr = false, ocrConfigured = false, savedCalculations = [], savedCalculationsError = false }: {
  equipment?: CalculatorEquipment[]; equipmentNotice?: string | null; canSaveCalculations?: boolean; canUseOcr?: boolean; ocrConfigured?: boolean;
  products?: CalculatorProduct[]; productNotice?: string | null; profiles?: CalculatorProfile[]; profileNotice?: string | null;
  materials?: CalculatorMaterial[]; materialNotice?: string | null;
  savedCalculations?: SavedCalculation[]; savedCalculationsError?: boolean;
}) {
  const [fields, setFields] = useState(initialFields);
  const [extras, setExtras] = useState<ExtraField[]>([]);
  const [productionComponents, setProductionComponents] = useState<ProductionComponentFields[]>([]);
  const [channels, setChannels] = useState(initialChannels);
  const [pricingMode, setPricingMode] = useState<"margin" | "markup">("margin");
  const [calculationTitle, setCalculationTitle] = useState("");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
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
    material: fields.material.trim(),
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
    targetMarginPercent: pricingMode === "margin" ? numberValue(fields.targetMarginPercent) : 0,
    targetMarkupPercent: pricingMode === "markup" ? numberValue(fields.targetMarkupPercent) : 0,
    pricingMode,
    additionalCosts: extras.map(({ name, amount }) => ({ name, amount: numberValue(amount) })),
  };
  const result = useMemo(() => calculatePrintPrice(input, parsedChannels), [fields, extras, productionComponents, channels, pricingMode]);
  const hasProductionCost = Boolean(result.breakdown?.totalCostCents);
  const hasCurrentValues = Object.entries(fields).some(([key, value]) => value !== "" && key !== "batchQuantity" && key !== "batchFixedCost") || extras.length > 0
    || productionComponents.length > 0
    || channels.some((channel) => channel.feePercent !== "" || channel.fixedFee !== "" || !initialChannels.some((initial) => initial.id === channel.id && initial.name === channel.name))
    || pricingMode !== "margin";

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
    if (!selected) {
      setProductionComponents((current) => current.map((component) => component.id === componentId ? { ...component, equipmentId: "", maintenancePerHour: "" } : component));
      return;
    }
    const rates = deriveEquipmentRates(selected);
    setProductionComponents((current) => current.map((component) => component.id === componentId ? {
      ...component,
      equipmentId,
      printer: selected.label,
      ...(rates.averagePowerWatts == null ? {} : { averagePowerWatts: String(rates.averagePowerWatts) }),
      ...(rates.energyTariffPerKwh == null ? {} : { energyPricePerKwh: String(rates.energyTariffPerKwh) }),
      ...(rates.depreciationPerHour == null ? {} : { depreciationPerHour: String(rates.depreciationPerHour) }),
      maintenancePerHour: rates.maintenancePerHour == null ? "" : String(rates.maintenancePerHour),
    } : component));
  }

  function addChannel() {
    setChannels((current) => [...current, { id: crypto.randomUUID(), name: "Novo canal", feePercent: "", fixedFee: "" }]);
  }

  function selectEquipment(id: string) {
    const selected = equipment.find((item) => item.id === id);
    if (!selected) {
      setSelectedEquipmentId("");
      setFields((current) => ({ ...current, maintenancePerHour: "" }));
      return;
    }
    setSelectedEquipmentId(id);
    const rates = deriveEquipmentRates(selected);
    setFields((current) => ({
      ...current,
      ...(rates.averagePowerWatts == null ? {} : { averagePowerWatts: String(rates.averagePowerWatts) }),
      ...(rates.energyTariffPerKwh == null ? {} : { energyPricePerKwh: String(rates.energyTariffPerKwh) }),
      ...(rates.depreciationPerHour == null ? {} : { depreciationPerHour: String(rates.depreciationPerHour) }),
      maintenancePerHour: rates.maintenancePerHour == null ? "" : String(rates.maintenancePerHour),
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

  function duplicateCalculation(snapshot: string, title: string, productId: string | null, printerId: string | null, profileId: string | null) {
    if (hasCurrentValues && !window.confirm("Abrir esta cópia substituirá os valores atuais da calculadora. Deseja continuar?")) return;
    try {
      const saved = JSON.parse(snapshot) as { input?: PrintCostInput; channels?: SalesChannel[] };
      if (!saved.input || !Array.isArray(saved.channels)) return;
      setFields({ ...initialFields, ...Object.fromEntries(Object.entries(saved.input).filter(([key]) => key !== "additionalCosts" && key !== "productionComponents" && key !== "pricingMode").map(([key, value]) => [key, String(value)])) } as FormFields);
      setPricingMode(saved.input.pricingMode === "markup" ? "markup" : "margin");
      setExtras(saved.input.additionalCosts.map((item) => ({ id: crypto.randomUUID(), name: item.name, amount: String(item.amount) })));
      setProductionComponents((saved.input.productionComponents ?? []).map((component) => ({
        id: crypto.randomUUID(), equipmentId: "", ...Object.fromEntries(Object.entries(component).map(([key, value]) => [key, String(value)])),
      } as ProductionComponentFields)));
      setChannels(saved.channels.map((channel) => ({ ...channel, feePercent: String(channel.feePercent), fixedFee: String(channel.fixedFee) })));
      setCalculationTitle(`${title} (cópia)`.slice(0, 80));
      setSelectedEquipmentId(printerId ?? "");
      setSelectedProductId(productId ?? "");
      setSelectedProfileId(profileId ?? "");
    } catch { /* Invalid saved data is ignored. */ }
  }

  const breakdown = result.breakdown;
  const canExport = hasProductionCost && Boolean(breakdown) && result.errors.length === 0;

  function downloadCsv() {
    if (!canExport) return;
    const csv = exportPrintCalculationCsv(calculationTitle.trim() || fields.material.trim() || "Cálculo ViraPeça 3D", input, parsedChannels, result);
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${(calculationTitle.trim() || fields.material.trim() || "calculo-virapeca-3d").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "calculo-virapeca-3d"}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

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
              {materials.length > 0 && <label className="price-field"><span>Material do catálogo técnico</span><select value={materials.find((item) => materialLabel(item) === fields.material)?.id ?? ""} onChange={(event) => updateField("material", materialLabel(materials.find((item) => item.id === event.target.value)))}>
                <option value="">Selecionar ou informar manualmente</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.brand} · {item.name} ({item.family}){item.process === "resin" ? " · resina" : " · filamento"}</option>)}
              </select></label>}
              {materialNotice && <p className="price-field-hint" role="status">Catálogo indisponível. A identificação do material pode ser informada manualmente.</p>}
              <label className="price-field"><span>Filamento ou resina</span><div className="price-input-wrap"><input type="text" maxLength={120} value={fields.material} onChange={(event) => updateField("material", event.target.value)} placeholder="Ex.: PLA, marca e cor" /></div></label>
              <CostField label="Material consumido no lote" suffix="g" hint="Inclua o consumo da execução completa, com suportes e purga quando disponíveis." value={fields.filamentGrams} onChange={(value) => updateField("filamentGrams", value)} />
              <CostField label="Preço de compra" suffix="R$/kg" hint="Informe seu preço de compra; o catálogo não presume um valor." value={fields.filamentPricePerKg} onChange={(value) => updateField("filamentPricePerKg", value)} />
            </div>
          </section>

          <section className="price-card">
            <div className="price-card-heading"><span className="price-step">02</span><div><h2>Máquina e energia</h2><p>Use horas, potência e custos medidos para a execução completa do lote. O tempo da impressora é contado uma vez.</p></div></div>
            {equipment.length > 0 && <label className="equipment-calculator-select">Equipamento cadastrado<select value={selectedEquipmentId} onChange={(event) => selectEquipment(event.target.value)}><option value="">Sem equipamento (manter campos manuais)</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><small>Selecionar preenche dados conhecidos; o equipamento fica vinculado ao salvar e os campos continuam editáveis.</small></label>}
            <MaterialCompatibilityNote equipmentId={selectedEquipmentId} materialName={fields.material} equipment={equipment} materials={materials} />
            <div className="price-fields-grid">
              <CostField label="Tempo de impressão" suffix="horas" value={fields.printHours} onChange={(value) => updateField("printHours", value)} />
              <CostField label="Potência média" suffix="W" hint="Use a média medida, não a potência nominal." value={fields.averagePowerWatts} onChange={(value) => updateField("averagePowerWatts", value)} />
              <CostField label="Tarifa de energia" suffix="R$/kWh" value={fields.energyPricePerKwh} onChange={(value) => updateField("energyPricePerKwh", value)} />
              <CostField label="Operação da máquina" suffix="R$/h" hint="Sem depreciação nem manutenção." value={fields.machineCostPerHour} onChange={(value) => updateField("machineCostPerHour", value)} />
              <CostField label="Depreciação" suffix="R$/h" value={fields.depreciationPerHour} onChange={(value) => updateField("depreciationPerHour", value)} />
              <CostField label="Manutenção rateada" suffix="R$/h" hint="Sugestão pela despesa registrada dividida pelas horas acumuladas; você pode ajustar." value={fields.maintenancePerHour} onChange={(value) => updateField("maintenancePerHour", value)} />
            </div>
            <div className="price-subheading"><h3>Outros arquivos e componentes impressos</h3><button type="button" className="price-add-button" onClick={addProductionComponent} disabled={productionComponents.length >= MAX_PRODUCTION_COMPONENTS}><CirclePlus size={15} /> Adicionar componente</button></div>
            <p className="price-field-hint">Cada componente representa o total de material, tempo e custos de todas as execuções necessárias para este lote. Informe no tempo total quantas execuções foram necessárias; não multiplicamos pelas peças.</p>
            {productionComponents.length > 0 && <div className="production-component-list">{productionComponents.map((component) => <article className="production-component-card" key={component.id}>
              <div className="production-component-heading"><strong>Componente de produção</strong><button type="button" aria-label={`Remover ${component.name || "componente"}`} onClick={() => setProductionComponents((current) => current.filter((item) => item.id !== component.id))}><Trash2 size={15} /></button></div>
              <div className="price-fields-grid production-component-identification">
                <label className="price-field"><span>Arquivo ou componente</span><div className="price-input-wrap"><input type="text" maxLength={80} value={component.name} onChange={(event) => updateProductionComponent(component.id, "name", event.target.value)} placeholder="Ex.: Tampa" /></div></label>
                {materials.length > 0 && <label className="price-field"><span>Material do catálogo técnico</span><select value={materials.find((item) => materialLabel(item) === component.material)?.id ?? ""} onChange={(event) => updateProductionComponent(component.id, "material", materialLabel(materials.find((item) => item.id === event.target.value)))}>
                  <option value="">Selecionar material</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.brand} · {item.name} ({item.family}){item.process === "resin" ? " · resina" : " · filamento"}</option>)}
                </select></label>}
                <label className="price-field"><span>Material usado</span><input type="text" maxLength={120} value={component.material} onChange={(event) => updateProductionComponent(component.id, "material", event.target.value)} placeholder="Ex.: PETG de outra marca" /></label>
                <label className="price-field"><span>Impressora</span><div className="price-input-wrap"><input type="text" maxLength={120} value={component.printer} onChange={(event) => updateProductionComponent(component.id, "printer", event.target.value)} placeholder="Ex.: Impressora B" /></div></label>
                <CostField label="Quantidade por produto final" suffix="un." step="1" max={MAX_BATCH_QUANTITY} value={component.piecesPerProduct} onChange={(value) => updateProductionComponent(component.id, "piecesPerProduct", value)} idSuffix={component.id} />
              </div>
              {equipment.length > 0 && <label className="equipment-calculator-select production-equipment-select">Equipamento cadastrado para este componente<select value={component.equipmentId} onChange={(event) => selectComponentEquipment(component.id, event.target.value)}><option value="">Informar custos manualmente</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><small>Preenche a impressora, potência, tarifa e depreciação conhecidos; os campos permanecem editáveis.</small></label>}
              <MaterialCompatibilityNote equipmentId={component.equipmentId} materialName={component.material} equipment={equipment} materials={materials} />
              <div className="price-fields-grid production-component-costs">
                <CostField label="Material consumido no componente" suffix="g" value={component.filamentGrams} onChange={(value) => updateProductionComponent(component.id, "filamentGrams", value)} idSuffix={component.id} />
                <CostField label="Preço do material" suffix="R$/kg" hint="Informe seu preço de compra." value={component.filamentPricePerKg} onChange={(value) => updateProductionComponent(component.id, "filamentPricePerKg", value)} idSuffix={component.id} />
                <CostField label="Tempo total das execuções" suffix="horas" value={component.printHours} onChange={(value) => updateProductionComponent(component.id, "printHours", value)} idSuffix={component.id} />
                <CostField label="Potência média" suffix="W" value={component.averagePowerWatts} onChange={(value) => updateProductionComponent(component.id, "averagePowerWatts", value)} idSuffix={component.id} />
                <CostField label="Tarifa de energia" suffix="R$/kWh" value={component.energyPricePerKwh} onChange={(value) => updateProductionComponent(component.id, "energyPricePerKwh", value)} idSuffix={component.id} />
                <CostField label="Operação da máquina" suffix="R$/h" value={component.machineCostPerHour} onChange={(value) => updateProductionComponent(component.id, "machineCostPerHour", value)} idSuffix={component.id} />
                <CostField label="Depreciação" suffix="R$/h" value={component.depreciationPerHour} onChange={(value) => updateProductionComponent(component.id, "depreciationPerHour", value)} idSuffix={component.id} />
                <CostField label="Manutenção rateada" suffix="R$/h" hint="Sugestão histórica da impressora selecionada; você pode ajustar." value={component.maintenancePerHour} onChange={(value) => updateProductionComponent(component.id, "maintenancePerHour", value)} idSuffix={component.id} />
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
            <div className="price-card-heading"><span className="price-step">04</span><div><h2>Preço e canais</h2><p>Escolha markup sobre o custo ou margem sobre o preço. As taxas informadas são consideradas em cada canal.</p></div></div>
            <div className="price-margin-field">
              <label className="price-field" htmlFor="pricing-mode"><span>Método de precificação</span><select id="pricing-mode" value={pricingMode} onChange={(event) => setPricingMode(event.target.value as "margin" | "markup")}><option value="margin">Margem sobre o preço de venda</option><option value="markup">Markup sobre o custo unitário</option></select></label>
              {pricingMode === "margin"
                ? <CostField label="Margem desejada sobre o preço" suffix="%" hint="Lucro dividido pelo preço de venda." value={fields.targetMarginPercent} onChange={(value) => updateField("targetMarginPercent", value)} />
                : <CostField label="Markup desejado sobre o custo" suffix="%" hint="Acréscimo desejado sobre o custo unitário, após taxas do canal." value={fields.targetMarkupPercent} onChange={(value) => updateField("targetMarkupPercent", value)} />}
            </div>
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
          <div className="price-scenario-heading"><h2>Preço unitário por canal</h2><span>{pricingMode === "markup" ? "markup" : "margem"}: {(pricingMode === "markup" ? fields.targetMarkupPercent : fields.targetMarginPercent) ? `${pricingMode === "markup" ? fields.targetMarkupPercent : fields.targetMarginPercent}%` : "—"}</span></div>
          <div className="price-scenario-list">
            {channels.map((channel) => {
              const scenario = result.channels.find((item) => item.id === channel.id);
              const target = pricingMode === "markup" ? fields.targetMarkupPercent : fields.targetMarginPercent;
              const ready = target !== "" && channel.feePercent !== "" && channel.fixedFee !== "";
              const actualMarkup = result.unitCostCents ? ((scenario?.profitCents ?? 0) / result.unitCostCents * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : null;
              return <article className="price-scenario" key={channel.id}>
                <div className="price-scenario-top"><span>{channel.name || "Canal sem nome"}</span><strong>{ready && !result.errors.length ? money(scenario?.priceCents) : "—"}</strong></div>
                <p>{ready && scenario?.profitCents != null ? `Lucro ${money(scenario.profitCents)} · margem ${scenario.actualMarginPercent?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%${pricingMode === "markup" && actualMarkup ? ` · markup ${actualMarkup}%` : ""}` : "Informe a meta e as taxas deste canal."}</p>
              </article>;
            })}
          </div>
          <p className="price-disclaimer">Estimativa manual: não inclui impostos, frete, tarifas não informadas ou custos de produção não preenchidos.</p>
          <div className="price-export-actions">
            <button className="button button-secondary" type="button" disabled={!canExport} onClick={() => window.print()}>Salvar relatório em PDF</button>
            <button className="button button-secondary" type="button" disabled={!canExport} onClick={downloadCsv}>Baixar CSV</button>
          </div>
        </aside>
      </div>

      {canExport && breakdown && <section className="price-print-report" aria-hidden="true">
        <p className="eyebrow">VIRAPEÇA 3D · PRECIFICAÇÃO</p>
        <h1>Relatório de custos e preços</h1>
        <p><strong>Cálculo:</strong> {calculationTitle.trim() || fields.material.trim() || "Sem título"}</p>
        <p><strong>Meta:</strong> {pricingMode === "markup" ? "Markup" : "Margem"} de {pricingMode === "markup" ? fields.targetMarkupPercent : fields.targetMarginPercent}%</p>
        <p><strong>Lote:</strong> {input.batchQuantity} peças · <strong>Material:</strong> {input.material || "não informado"}</p>
        <p><strong>Custo total:</strong> {money(breakdown.totalCostCents)} · <strong>Custo unitário:</strong> {money(result.unitCostCents)}</p>
        <h2>Composição do custo do lote</h2>
        <table><tbody>{[
          ["Material", breakdown.materialCents], ["Energia", breakdown.energyCents], ["Operação da máquina", breakdown.machineCents],
          ["Depreciação", breakdown.depreciationCents], ["Manutenção", breakdown.maintenanceCents], ["Mão de obra", breakdown.laborCents],
          ["Componentes adicionais", breakdown.additionalCents], ["Custos fixos rateados", breakdown.overheadCents],
          ["Custo fixo do lote", breakdown.batchFixedCents], ["Reserva para falhas", breakdown.failureReserveCents],
        ].map(([label, cents]) => <tr key={String(label)}><th>{String(label)}</th><td>{money(cents as number)}</td></tr>)}<tr><th>Total do lote</th><td>{money(breakdown.totalCostCents)}</td></tr></tbody></table>
        <h2>Preços por canal</h2>
        <table><thead><tr><th>Canal</th><th>Taxa</th><th>Preço</th><th>Lucro</th><th>Margem</th></tr></thead><tbody>{result.channels.map((scenario) => <tr key={scenario.id}><th>{scenario.name}</th><td>{parsedChannels.find((channel) => channel.id === scenario.id)?.feePercent}% + {money(scenario.fixedFeeCents)}</td><td>{money(scenario.priceCents)}</td><td>{money(scenario.profitCents)}</td><td>{scenario.actualMarginPercent?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</td></tr>)}</tbody></table>
        <p className="price-print-note">Estimativa com base nos custos e taxas informados. Não inclui custos que ficaram em branco, impostos ou frete.</p>
      </section>}

      <section className="price-history" aria-labelledby="price-history-title">
        <div className="price-history-heading"><div><p className="eyebrow">CÁLCULOS DA SUA LOJA</p><h2 id="price-history-title">Histórico salvo</h2><p>Snapshots preservam os valores usados no momento do cálculo.</p></div></div>
        {canSaveCalculations ? <>
          <form action={saveAction} className="price-save-form">
            <label htmlFor="calculation-title">Nome do cálculo<input id="calculation-title" name="title" value={calculationTitle} onChange={(event) => setCalculationTitle(event.target.value)} minLength={2} maxLength={80} required placeholder="Ex.: Suporte de mesa · PLA" /></label>
            {productNotice && <p className="auth-notice is-error" role="status">{productNotice}</p>}
            {products.length > 0 && <label htmlFor="calculation-product">Vincular a um produto<select id="calculation-product" name="productSelector" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}><option value="">Sem vínculo com produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.published ? " · publicado" : " · rascunho"}</option>)}</select><small>Somente produtos desta loja aparecem nesta lista.</small></label>}
            {profileNotice && <p className="auth-notice is-error" role="status">{profileNotice}</p>}
            {profiles.length > 0 && <label htmlFor="calculation-profile">Vincular a um perfil de impressão<select id="calculation-profile" name="profileSelector" value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)}><option value="">Sem vínculo com perfil</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><small>Somente perfis da sua loja aparecem nesta lista.</small></label>}
            <input type="hidden" name="productId" value={selectedProductId} />
            <input type="hidden" name="printerId" value={selectedEquipmentId} />
            <input type="hidden" name="profileId" value={selectedProfileId} />
            <input type="hidden" name="snapshot" value={JSON.stringify({ input, channels: parsedChannels })} />
            <button className="button button-primary" type="submit" disabled={saving || !hasProductionCost || result.errors.length > 0}>{saving ? "Salvando…" : "Salvar cálculo"}</button>
            {saveState.message && <p className={saveState.success ? "auth-notice is-success" : "auth-notice is-error"} role="status">{saveState.message}</p>}
          </form>
          {savedCalculationsError ? <p className="auth-notice is-error" role="alert">Não foi possível carregar o histórico. Confira as migrações da calculadora e dos vínculos com produtos, equipamentos e perfis.</p> : savedCalculations.length === 0 ? <p className="price-history-empty">Os cálculos salvos aparecerão aqui.</p> : <div className="price-history-list">{savedCalculations.map((saved) => <article className="price-history-item" key={saved.id}>
            <div><strong>{saved.title}</strong><span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(saved.createdAt))} · {saved.batchQuantity} peças · lote {money(saved.totalCostCents)} · unidade {money(saved.unitCostCents)}</span>{saved.productName && <span>Produto: {saved.productUrl ? <Link href={saved.productUrl}>{saved.productName}</Link> : saved.productName}</span>}{saved.printerName && <span>Equipamento: {saved.printerName}</span>}{saved.profileName && <span>Perfil: {saved.profileName}</span>}</div>
            <div className="price-history-actions"><button className="button button-secondary" type="button" onClick={() => duplicateCalculation(saved.snapshot, saved.title, saved.productId, saved.printerId, saved.profileId)}>Abrir como cópia</button><form action={deleteMakerCalculation} onSubmit={(event) => { if (!window.confirm(`Excluir “${saved.title}” do histórico?`)) event.preventDefault(); }}><input type="hidden" name="calculationId" value={saved.id} /><button className="price-history-delete" type="submit">Excluir</button></form></div>
          </article>)}</div>}
        </> : <div className="price-history-locked"><p>Entre com uma conta de fabricante e loja aprovada para manter um histórico privado dos seus custos.</p><Link className="button button-secondary" href="/conta">Acessar conta</Link></div>}
      </section>
    </section>
  );
}
