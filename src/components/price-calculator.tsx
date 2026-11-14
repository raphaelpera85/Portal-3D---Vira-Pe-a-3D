"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { CirclePlus, Calculator, Trash2 } from "lucide-react";
import { calculatePrintPrice, laborActivityFields, laborActivityLabels, MAX_BATCH_QUANTITY, MAX_PRODUCTION_COMPONENTS, type PrintCostInput, type ProductionComponent, type SalesChannel } from "@/lib/pricing";
import { exportPrintCalculationCsv } from "@/lib/pricing-export";
import { deriveEquipmentRates, type EquipmentRateInput } from "@/lib/printer-equipment";
import { evaluateMaterialCompatibility, type CatalogPrinter } from "@/lib/compatibility";
import type { MaterialEntry, NozzleEntry } from "@/lib/technical-catalog";
import { applyCalculatedProductPrice, deleteMakerCalculation, saveMakerCalculation } from "@/app/calculadora/actions";
import { createMakerConsignmentItem } from "@/app/painel/maker/actions";
import { MAX_CONSIGNMENT_QUANTITY } from "@/lib/consignment";
import { SlicerImageImporter } from "@/components/slicer-image-importer";
import { ThreeMfSlicerImporter } from "@/components/three-mf-slicer-importer";
import { hasReviewableSlicerOcrData, slicerColorPresentation, type parseSlicerOcrTexts } from "@/lib/slicer-ocr";
import { mapThreeMfPlateToSlicerMetrics, type CalculationOrigin, type SavedSlicerMetrics } from "@/lib/saved-calculation";
import { mapModelPrintProfileToCalculator, mapPrintProfileToCalculator } from "@/lib/calculator-profile";
import type { ThreeMfSlicePlate } from "@/lib/model-file";

type FormFields = Record<keyof Omit<PrintCostInput, "additionalCosts" | "productionComponents" | "filamentCosts" | "pricingMode">, string>;
type ChannelFields = Omit<SalesChannel, "feePercent" | "fixedFee" | "logisticsCost" | "discountPercent" | "discountFixed"> & {
  feePercent: string; fixedFee: string; logisticsCost: string; discountType: "percent" | "fixed"; discountValue: string;
};
type ExtraField = { id: string; name: string; amount: string };
type ProductionComponentFields = { id: string; equipmentId: string } & Omit<Record<keyof ProductionComponent, string>, "id">;
type CalculatorEquipment = EquipmentRateInput & { id: string; label: string; catalogPrinter?: CatalogPrinter | null };
export type CalculatorProduct = { id: string; name: string; slug: string; published: boolean; listingType: "physical" | "digital"; priceMode: "fixed" | "from" | "quote"; priceBrl: number | null; variants: Array<{ id: string; options: Record<string, string>; priceBrl: number }>; canApplyPrice: boolean };
type CalculatorProfile = { id: string; name: string; productId: string | null; quantity: number; materialName: string; printHours: number | null; materialGrams: number | null; materialByColor: Array<{ color: string; grams: number | null; lengthMeters: number | null }>; equipmentId: string | null; kind?: "maker" | "model"; modelMetrics?: SavedSlicerMetrics };
type CalculatorMaterial = MaterialEntry;
type SavedCalculation = { id: string; title: string; createdAt: string; totalCostCents: number; unitCostCents: number; batchQuantity: number; productId: string | null; productName: string | null; productUrl: string | null; priceTargetId: string | null; priceTargetName: string | null; compatibilityNozzleLabels: string[]; printerId: string | null; printerName: string | null; profileId: string | null; profileName: string | null; slicer: SavedSlicerMetrics | null; origin: CalculationOrigin; snapshot: string };
const initialFields: FormFields = {
  batchQuantity: "1", batchFixedCost: "", material: "", filamentGrams: "", filamentPricePerKg: "", printHours: "", averagePowerWatts: "",
  energyPricePerKwh: "", machineCostPerHour: "", depreciationPerHour: "",
  maintenancePerHour: "", laborMinutes: "", laborRatePerHour: "", overheadPerUnit: "",
  laborPreparationMinutes: "", laborSupportRemovalMinutes: "", laborFinishingMinutes: "", laborPaintingMinutes: "", laborAssemblyMinutes: "", laborPackagingMinutes: "",
  failureReservePercent: "", targetMarginPercent: "", targetMarkupPercent: "",
};

const initialChannels: ChannelFields[] = [
  { id: "direta", name: "Venda direta", feePercent: "", fixedFee: "", logisticsCost: "", discountType: "percent", discountValue: "" },
  { id: "virapeca", name: "ViraPeça 3D", feePercent: "", fixedFee: "", logisticsCost: "", discountType: "percent", discountValue: "" },
  { id: "shopee", name: "Shopee", feePercent: "", fixedFee: "", logisticsCost: "", discountType: "percent", discountValue: "" },
  { id: "mercado-livre", name: "Mercado Livre", feePercent: "", fixedFee: "", logisticsCost: "", discountType: "percent", discountValue: "" },
  { id: "atacado", name: "Atacado", feePercent: "", fixedFee: "", logisticsCost: "", discountType: "percent", discountValue: "" },
  { id: "consignacao", name: "Consignação", feePercent: "", fixedFee: "", logisticsCost: "", discountType: "percent", discountValue: "" },
];

const money = (cents: number | null | undefined) => cents == null
  ? "—"
  : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const numberValue = (value: string) => value.trim() === "" ? 0 : Number(value.replace(",", "."));
const materialLabel = (material?: CalculatorMaterial) => material ? `${material.brand} · ${material.name} (${material.family})` : "";
const compatibilityText = { compatible: "Compatível", conditional: "Compatível com condições", incompatible: "Incompatível", unverified: "Não verificado" };
const metric = (value: number | null, suffix: string) => value == null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${suffix}`;

function MaterialCompatibilityNote({ equipmentId, materialName, equipment, materials, nozzles, nozzleId, onNozzleChange }: {
  equipmentId: string; materialName: string; equipment: CalculatorEquipment[]; materials: CalculatorMaterial[]; nozzles: NozzleEntry[];
  nozzleId: string; onNozzleChange: (id: string) => void;
}) {
  if (!equipmentId) return null;
  const selectedEquipment = equipment.find((item) => item.id === equipmentId);
  if (!selectedEquipment) return null;
  const material = materials.find((item) => materialLabel(item) === materialName);
  const nozzle = nozzles.find((item) => item.id === nozzleId) ?? null;
  const evaluation = selectedEquipment.catalogPrinter && material
    ? evaluateMaterialCompatibility(selectedEquipment.catalogPrinter, material, nozzle ?? undefined)
    : null;
  const status = evaluation?.status ?? "unverified";
  const message = !material
    ? "Selecione um material do catálogo para conferir os dados técnicos; materiais informados manualmente não são verificados."
    : !selectedEquipment.catalogPrinter
      ? "Este equipamento não está vinculado a um modelo publicado no catálogo."
      : null;
  const nozzleHint = !material
    ? "Selecione um material do catálogo para verificar compatibilidade."
    : material.process !== "filament"
      ? "A verificação de bico não se aplica a impressoras de resina."
      : !selectedEquipment.catalogPrinter
        ? "Vincule este equipamento a um modelo publicado para verificar o bico."
        : nozzles.length === 0
          ? "O catálogo não tem bicos publicados para esta checagem."
          : nozzle
            ? "A checagem inclui o encaixe, o limite de temperatura e a resistência à abrasão cadastrados para o bico."
            : "Selecione o bico para incluir encaixe, temperatura e resistência à abrasão na checagem.";

  return <div className={`calculator-compatibility is-${status}`} role="status">
    <strong>Material e impressora: {compatibilityText[status]}</strong>
    {material?.process === "filament" && selectedEquipment.catalogPrinter && nozzles.length > 0 && <label>Bico para esta checagem<select value={nozzleId} onChange={(event) => onNozzleChange(event.target.value)}><option value="">Sem bico selecionado</option>{nozzles.map((item) => <option key={item.id} value={item.id}>{item.brand} · {item.name} · {item.diameterMm} mm</option>)}</select></label>}
    <small>{nozzleHint}</small>
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

export function PriceCalculator({ equipment = [], products = [], profiles = [], materials = [], nozzles = [], materialNotice = null, equipmentNotice = null, productNotice = null, profileNotice = null, canSaveCalculations = false, canUseOcr = false, ocrConfigured = false, savedCalculations = [], savedCalculationsError = false }: {
  equipment?: CalculatorEquipment[]; equipmentNotice?: string | null; canSaveCalculations?: boolean; canUseOcr?: boolean; ocrConfigured?: boolean;
  products?: CalculatorProduct[]; productNotice?: string | null; profiles?: CalculatorProfile[]; profileNotice?: string | null;
  materials?: CalculatorMaterial[]; nozzles?: NozzleEntry[]; materialNotice?: string | null;
  savedCalculations?: SavedCalculation[]; savedCalculationsError?: boolean;
}) {
  const [fields, setFields] = useState(initialFields);
  const [extras, setExtras] = useState<ExtraField[]>([]);
  const [productionComponents, setProductionComponents] = useState<ProductionComponentFields[]>([]);
  const [channels, setChannels] = useState(initialChannels);
  const [pricingMode, setPricingMode] = useState<"margin" | "markup">("margin");
  const [calculationTitle, setCalculationTitle] = useState("");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [selectedNozzleId, setSelectedNozzleId] = useState("");
  const [componentNozzleIds, setComponentNozzleIds] = useState<Record<string, string>>({});
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedPriceTargetId, setSelectedPriceTargetId] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileApplyNotice, setProfileApplyNotice] = useState("");
  const [slicerMetrics, setSlicerMetrics] = useState<SavedSlicerMetrics | null>(null);
  const [calculationOrigin, setCalculationOrigin] = useState<CalculationOrigin>("manual");
  const [saveState, saveAction, saving] = useActionState(saveMakerCalculation, { message: "", success: false });
  const [priceApplyState, applyPriceAction, applyingPrice] = useActionState(applyCalculatedProductPrice, { message: "", success: false });
  const parsedChannels: SalesChannel[] = channels.map((channel) => ({
    ...channel,
    feePercent: numberValue(channel.feePercent),
    fixedFee: numberValue(channel.fixedFee),
    logisticsCost: numberValue(channel.logisticsCost),
    discountPercent: channel.discountType === "percent" ? numberValue(channel.discountValue) : 0,
    discountFixed: channel.discountType === "fixed" ? numberValue(channel.discountValue) : 0,
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
      ...Object.fromEntries(laborActivityFields.map((field) => [field, numberValue(component[field])])) as Record<typeof laborActivityFields[number], number>,
    })),
    material: fields.material.trim(),
    filamentGrams: numberValue(fields.filamentGrams),
    filamentPricePerKg: numberValue(fields.filamentPricePerKg),
    filamentCosts: slicerMetrics?.filaments.length && slicerMetrics.filaments.every((filament) => filament.grams !== null && filament.pricePerKg !== null)
      ? slicerMetrics.filaments.map(({ grams, pricePerKg, material, color }) => ({ grams: grams!, pricePerKg: pricePerKg!, name: material, color }))
      : [],
    printHours: numberValue(fields.printHours),
    averagePowerWatts: numberValue(fields.averagePowerWatts),
    energyPricePerKwh: numberValue(fields.energyPricePerKwh),
    machineCostPerHour: numberValue(fields.machineCostPerHour),
    depreciationPerHour: numberValue(fields.depreciationPerHour),
    maintenancePerHour: numberValue(fields.maintenancePerHour),
    laborMinutes: numberValue(fields.laborMinutes),
    laborRatePerHour: numberValue(fields.laborRatePerHour),
    ...Object.fromEntries(laborActivityFields.map((field) => [field, numberValue(fields[field])])) as Record<typeof laborActivityFields[number], number>,
    overheadPerUnit: numberValue(fields.overheadPerUnit),
    failureReservePercent: numberValue(fields.failureReservePercent),
    targetMarginPercent: pricingMode === "margin" ? numberValue(fields.targetMarginPercent) : 0,
    targetMarkupPercent: pricingMode === "markup" ? numberValue(fields.targetMarkupPercent) : 0,
    pricingMode,
    additionalCosts: extras.map(({ name, amount }) => ({ name, amount: numberValue(amount) })),
  };
  const result = useMemo(() => calculatePrintPrice(input, parsedChannels), [fields, extras, productionComponents, channels, pricingMode, slicerMetrics]);
  const hasProductionCost = Boolean(result.breakdown?.totalCostCents);
  const consignmentChannel = parsedChannels.find((channel) => channel.id === "consignacao");
  const consignmentChannelInput = channels.find((channel) => channel.id === "consignacao");
  const consignmentPrice = result.channels.find((channel) => channel.id === "consignacao");
  const consignmentProduct = products.find((product) => product.id === selectedProductId && product.published);
  const priceProduct = products.find((product) => product.canApplyPrice
    && (product.id === selectedPriceTargetId || product.variants.some((variant) => variant.id === selectedPriceTargetId)));
  const priceVariant = priceProduct?.variants.find((variant) => variant.id === selectedPriceTargetId);
  const currentPriceCents = Math.round((priceVariant?.priceBrl ?? priceProduct?.priceBrl ?? 0) * 100);
  const priceTargetLabel = priceVariant ? Object.entries(priceVariant.options).map(([name, value]) => `${name}: ${value}`).join(" · ") : priceProduct?.name;
  const consignmentQuantity = numberValue(fields.batchQuantity);
  const canRegisterConsignment = canSaveCalculations && result.errors.length === 0 && hasProductionCost
    && consignmentQuantity <= MAX_CONSIGNMENT_QUANTITY && Boolean(consignmentChannelInput?.feePercent !== "")
    && Boolean(consignmentChannelInput?.fixedFee !== "") && consignmentPrice?.priceCents != null && result.unitCostCents != null;
  const hasCurrentValues = Object.entries(fields).some(([key, value]) => value !== "" && key !== "batchQuantity" && key !== "batchFixedCost") || extras.length > 0
    || productionComponents.length > 0
    || Boolean(selectedNozzleId) || Object.values(componentNozzleIds).some(Boolean)
    || channels.some((channel) => channel.feePercent !== "" || channel.fixedFee !== "" || channel.logisticsCost !== "" || channel.discountValue !== "" || !initialChannels.some((initial) => initial.id === channel.id && initial.name === channel.name))
    || pricingMode !== "margin";

  function updateField(field: keyof FormFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  function updateChannel(id: string, field: "name" | "feePercent" | "fixedFee" | "logisticsCost" | "discountType" | "discountValue", value: string) {
    setChannels((current) => current.map((channel) => channel.id === id ? { ...channel, [field]: value } : channel));
  }

  function addExtra() {
    setExtras((current) => [...current, { id: crypto.randomUUID(), name: "", amount: "" }]);
  }

  function addProductionComponent() {
    if (productionComponents.length >= MAX_PRODUCTION_COMPONENTS) return;
    const id = crypto.randomUUID();
    setProductionComponents((current) => [...current, {
      id, equipmentId: "", name: "", material: "", printer: "", piecesPerProduct: "1",
      filamentGrams: "", filamentPricePerKg: "", printHours: "", averagePowerWatts: "", energyPricePerKwh: "",
      machineCostPerHour: "", depreciationPerHour: "", maintenancePerHour: "", laborMinutes: "", laborRatePerHour: "",
      ...Object.fromEntries(laborActivityFields.map((field) => [field, ""])) as Record<typeof laborActivityFields[number], string>,
    } as ProductionComponentFields]);
    setComponentNozzleIds((current) => ({ ...current, [id]: "" }));
  }

  function updateProductionComponent(id: string, field: keyof ProductionComponentFields, value: string) {
    setProductionComponents((current) => current.map((component) => component.id === id ? { ...component, [field]: value } : component));
  }

  function selectComponentEquipment(componentId: string, equipmentId: string) {
    const selected = equipment.find((item) => item.id === equipmentId);
    if (!selected) {
      setProductionComponents((current) => current.map((component) => component.id === componentId ? { ...component, equipmentId: "", maintenancePerHour: "" } : component));
      setComponentNozzleIds((current) => ({ ...current, [componentId]: "" }));
      return;
    }
    const rates = deriveEquipmentRates(selected);
    if (productionComponents.find((component) => component.id === componentId)?.equipmentId !== equipmentId) {
      setComponentNozzleIds((current) => ({ ...current, [componentId]: "" }));
    }
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
    setChannels((current) => [...current, { id: crypto.randomUUID(), name: "Novo canal", feePercent: "", fixedFee: "", logisticsCost: "", discountType: "percent", discountValue: "" }]);
  }

  function selectEquipment(id: string) {
    const selected = equipment.find((item) => item.id === id);
    if (!selected) {
      setSelectedEquipmentId("");
      setSelectedNozzleId("");
      setFields((current) => ({ ...current, maintenancePerHour: "" }));
      return;
    }
    if (selectedEquipmentId !== id) setSelectedNozzleId("");
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

  function applySelectedProfile() {
    const profile = profiles.find((item) => item.id === selectedProfileId);
    if (!profile) return;
    if ((fields.material.trim() !== "" || fields.filamentGrams !== "" || fields.printHours !== "" || slicerMetrics?.filaments.length) && !window.confirm("Aplicar este perfil substituirá o material, o peso, o tempo e a composição por cor informados. Os preços por kg das cores correspondentes serão mantidos. Continuar?")) return;
    const values = profile.kind === "model" && profile.modelMetrics
      ? mapModelPrintProfileToCalculator({ name: profile.name, materialName: profile.materialName, quantity: profile.quantity, metrics: profile.modelMetrics }, numberValue(fields.batchQuantity), slicerMetrics?.filaments)
      : mapPrintProfileToCalculator(profile, numberValue(fields.batchQuantity), slicerMetrics?.filaments);
    if (!values) {
      setProfileApplyNotice("A quantidade do lote ou o consumo escalado deste perfil excede os limites aceitos pela calculadora.");
      return;
    }
    setFields((current) => ({
      ...current,
      material: values.material || current.material,
      filamentGrams: values.filamentGrams === null ? "" : String(values.filamentGrams),
      printHours: values.printHours === null ? "" : String(values.printHours),
    }));
    setSlicerMetrics(values.slicerMetrics);
    setCalculationOrigin("profile");
    if (profile.productId) setSelectedProductId(profile.productId);
    if (profile.equipmentId && equipment.some((item) => item.id === profile.equipmentId)) selectEquipment(profile.equipmentId);
    setProfileApplyNotice(`Consumo de “${profile.name}” aplicado para ${Math.max(1, Math.ceil(numberValue(fields.batchQuantity) / profile.quantity))} execução(ões). Confira os preços por kg antes de calcular.`);
  }

  function applyOcr(extraction: ReturnType<typeof parseSlicerOcrTexts>): boolean | null {
    if (!hasReviewableSlicerOcrData(extraction)) return false;
    if ((fields.filamentGrams !== "" || fields.printHours !== "" || slicerMetrics) && !window.confirm("Aplicar OCR pode substituir os valores atuais de peso, tempo, consumo por filamento e dados reconhecidos. Continuar?")) return null;
    setFields((current) => ({
      ...current,
      ...(extraction.filamentGrams == null ? {} : { filamentGrams: String(extraction.filamentGrams) }),
      ...(extraction.printHours == null ? {} : { printHours: String(extraction.printHours) }),
    }));
    setSlicerMetrics({
      slicer: extraction.slicer, modelGrams: extraction.modelGrams, supportGrams: extraction.supportGrams,
      totalGrams: extraction.totalGrams, purgeGrams: extraction.purgeGrams, wipeTowerGrams: extraction.wipeTowerGrams,
      filamentGrams: extraction.filamentGrams, derivedMass: extraction.derivedMass, lengthMeters: extraction.lengthMeters,
      printHours: extraction.printHours, filamentChanges: extraction.filamentChanges, estimatedCost: extraction.estimatedCost,
      estimatedCostCurrency: extraction.estimatedCostCurrency,
      materials: extraction.materials.slice(0, 20),
      filaments: extraction.filaments.slice(0, 32).map(({ index, grams, lengthMeters, material, color }) => ({ index, grams, lengthMeters, pricePerKg: null, material, color })),
      conflicts: extraction.conflicts.slice(0, 30),
    });
    setCalculationOrigin("ocr");
    return true;
  }

  function applyThreeMfPlate(plate: ThreeMfSlicePlate, plateNumber: number): boolean | null {
    const metrics = mapThreeMfPlateToSlicerMetrics(plate, plateNumber);
    if (metrics.filamentGrams == null && metrics.printHours == null) return false;
    if ((fields.filamentGrams !== "" || fields.printHours !== "") && !window.confirm("Os dados desta placa substituirão os valores atuais de peso e tempo. Continuar?")) return null;
    setFields((current) => ({
      ...current,
      ...(metrics.filamentGrams == null ? {} : { filamentGrams: String(metrics.filamentGrams) }),
      ...(metrics.printHours == null ? {} : { printHours: String(metrics.printHours) }),
    }));
    setSlicerMetrics(metrics);
    setCalculationOrigin("3mf");
    return true;
  }

  function updateSlicerFilament(index: number, values: Partial<Pick<SavedSlicerMetrics["filaments"][number], "grams" | "lengthMeters" | "pricePerKg">>) {
    if (!slicerMetrics) return;
    const filaments = slicerMetrics.filaments.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item);
    setSlicerMetrics({ ...slicerMetrics, filaments });
    if ("grams" in values) setFields((fieldsNow) => ({
      ...fieldsNow,
      filamentGrams: filaments.length > 0 && filaments.every((item) => item.grams !== null)
        ? String(filaments.reduce((sum, item) => sum + item.grams!, 0))
        : "",
    }));
  }

  function duplicateCalculation(snapshot: string, title: string, productId: string | null, printerId: string | null, profileId: string | null) {
    if (hasCurrentValues && !window.confirm("Abrir esta cópia substituirá os valores atuais da calculadora. Deseja continuar?")) return;
    try {
      const saved = JSON.parse(snapshot) as { input?: PrintCostInput; channels?: SalesChannel[]; slicer?: SavedSlicerMetrics | null; origin?: CalculationOrigin; priceTargetId?: string | null; compatibilityNozzles?: { main?: { equipmentId?: string | null; nozzleId?: string | null }; components?: Array<{ equipmentId?: string | null; nozzleId?: string | null }> } };
      if (!saved.input || !Array.isArray(saved.channels)) return;
      setFields({ ...initialFields, ...Object.fromEntries(Object.entries(saved.input).filter(([key]) => key !== "additionalCosts" && key !== "productionComponents" && key !== "filamentCosts" && key !== "pricingMode").map(([key, value]) => [key, String(value)])) } as FormFields);
      setPricingMode(saved.input.pricingMode === "markup" ? "markup" : "margin");
      setExtras(saved.input.additionalCosts.map((item) => ({ id: crypto.randomUUID(), name: item.name, amount: String(item.amount) })));
      const restoredComponents = (saved.input.productionComponents ?? []).map((component, index) => ({
        id: crypto.randomUUID(), equipmentId: equipment.some((item) => item.id === saved.compatibilityNozzles?.components?.[index]?.equipmentId) ? saved.compatibilityNozzles?.components?.[index]?.equipmentId ?? "" : "", ...Object.fromEntries(Object.entries(component).map(([key, value]) => [key, String(value)])),
        ...Object.fromEntries(laborActivityFields.map((field) => [field, String(component[field] ?? 0)])),
      } as ProductionComponentFields));
      setProductionComponents(restoredComponents);
      setComponentNozzleIds(Object.fromEntries(restoredComponents.map((component, index) => {
        const id = saved.compatibilityNozzles?.components?.[index]?.nozzleId ?? "";
        return [component.id, nozzles.some((nozzle) => nozzle.id === id) ? id : ""];
      })));
      setSelectedNozzleId(nozzles.some((nozzle) => nozzle.id === saved.compatibilityNozzles?.main?.nozzleId) ? saved.compatibilityNozzles?.main?.nozzleId ?? "" : "");
      setChannels(saved.channels.map((channel) => ({
        ...channel,
        feePercent: String(channel.feePercent),
        fixedFee: String(channel.fixedFee),
        logisticsCost: String(channel.logisticsCost ?? 0),
        discountType: (channel.discountFixed ?? 0) > 0 ? "fixed" : "percent",
        discountValue: String((channel.discountFixed ?? 0) > 0 ? channel.discountFixed : channel.discountPercent ?? 0),
      })));
      setCalculationTitle(`${title} (cópia)`.slice(0, 80));
      setSelectedEquipmentId(printerId ?? "");
      setSelectedProductId(productId ?? "");
      setSelectedPriceTargetId(typeof saved.priceTargetId === "string" ? saved.priceTargetId : "");
      setSelectedProfileId(profileId ?? "");
      setSlicerMetrics(saved.slicer ?? null);
      setCalculationOrigin(saved.origin ?? "unknown");
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
      <ThreeMfSlicerImporter onApply={applyThreeMfPlate} />

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
            {slicerMetrics?.filaments.length ? <div className="price-ocr-filaments is-editable">
              <strong>Consumo e custo por cor/material</strong>
              <p className="price-field-hint">Revise massa, comprimento e preço por quilo de cada filamento. O custo total por cor substitui o preço geral somente quando todas as linhas tiverem massa e preço preenchidos.</p>
              <ul>{slicerMetrics.filaments.map((filament, index) => {
                const color = slicerColorPresentation(filament.color);
                return (
                  <li key={`${filament.index}-${index}`}>
                    <span>{color?.cssColor && <i className="three-mf-filament-color" style={{ backgroundColor: color.cssColor }} aria-hidden="true" />}{`Filamento ${filament.index}`}{filament.material ? ` · ${filament.material}` : ""}{color ? ` · ${color.label}` : ""}</span>
                    <label><span className="sr-only">Massa em gramas do filamento {filament.index}</span><input type="number" min="0" step="any" value={filament.grams ?? ""} placeholder="g" onChange={(event) => updateSlicerFilament(index, { grams: event.target.value === "" ? null : Number(event.target.value) })} /></label>
                    <label><span className="sr-only">Comprimento em metros do filamento {filament.index}</span><input type="number" min="0" step="any" value={filament.lengthMeters ?? ""} placeholder="m" onChange={(event) => updateSlicerFilament(index, { lengthMeters: event.target.value === "" ? null : Number(event.target.value) })} /></label>
                    <label><span className="sr-only">Preço por quilo do filamento {filament.index}</span><input type="number" min="0" step="any" value={filament.pricePerKg ?? ""} placeholder="R$/kg" onChange={(event) => updateSlicerFilament(index, { pricePerKg: event.target.value === "" ? null : Number(event.target.value) })} /></label>
                  </li>
                );
              })}</ul>
              {input.filamentCosts?.length ? <p className="price-ocr-note">O cálculo soma o custo de cada filamento informado.</p> : null}
            </div> : null}
          </section>

          <section className="price-card">
            <div className="price-card-heading"><span className="price-step">02</span><div><h2>Máquina e energia</h2><p>Use horas, potência e custos medidos para a execução completa do lote. O tempo da impressora é contado uma vez.</p></div></div>
            {equipment.length > 0 && <label className="equipment-calculator-select">Equipamento cadastrado<select value={selectedEquipmentId} onChange={(event) => selectEquipment(event.target.value)}><option value="">Sem equipamento (manter campos manuais)</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><small>Selecionar preenche dados conhecidos; o equipamento fica vinculado ao salvar e os campos continuam editáveis.</small></label>}
            <MaterialCompatibilityNote equipmentId={selectedEquipmentId} materialName={fields.material} equipment={equipment} materials={materials} nozzles={nozzles} nozzleId={selectedNozzleId} onNozzleChange={setSelectedNozzleId} />
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
              <div className="production-component-heading"><strong>Componente de produção</strong><button type="button" aria-label={`Remover ${component.name || "componente"}`} onClick={() => { setProductionComponents((current) => current.filter((item) => item.id !== component.id)); setComponentNozzleIds((current) => { const next = { ...current }; delete next[component.id]; return next; }); }}><Trash2 size={15} /></button></div>
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
              <MaterialCompatibilityNote equipmentId={component.equipmentId} materialName={component.material} equipment={equipment} materials={materials} nozzles={nozzles} nozzleId={componentNozzleIds[component.id] ?? ""} onNozzleChange={(id) => setComponentNozzleIds((current) => ({ ...current, [component.id]: id }))} />
              <div className="price-fields-grid production-component-costs">
                <CostField label="Material consumido no componente" suffix="g" value={component.filamentGrams} onChange={(value) => updateProductionComponent(component.id, "filamentGrams", value)} idSuffix={component.id} />
                <CostField label="Preço do material" suffix="R$/kg" hint="Informe seu preço de compra." value={component.filamentPricePerKg} onChange={(value) => updateProductionComponent(component.id, "filamentPricePerKg", value)} idSuffix={component.id} />
                <CostField label="Tempo total das execuções" suffix="horas" value={component.printHours} onChange={(value) => updateProductionComponent(component.id, "printHours", value)} idSuffix={component.id} />
                <CostField label="Potência média" suffix="W" value={component.averagePowerWatts} onChange={(value) => updateProductionComponent(component.id, "averagePowerWatts", value)} idSuffix={component.id} />
                <CostField label="Tarifa de energia" suffix="R$/kWh" value={component.energyPricePerKwh} onChange={(value) => updateProductionComponent(component.id, "energyPricePerKwh", value)} idSuffix={component.id} />
                <CostField label="Operação da máquina" suffix="R$/h" value={component.machineCostPerHour} onChange={(value) => updateProductionComponent(component.id, "machineCostPerHour", value)} idSuffix={component.id} />
                <CostField label="Depreciação" suffix="R$/h" value={component.depreciationPerHour} onChange={(value) => updateProductionComponent(component.id, "depreciationPerHour", value)} idSuffix={component.id} />
                <CostField label="Manutenção rateada" suffix="R$/h" hint="Sugestão histórica da impressora selecionada; você pode ajustar." value={component.maintenancePerHour} onChange={(value) => updateProductionComponent(component.id, "maintenancePerHour", value)} idSuffix={component.id} />
                <CostField label="Outra mão de obra" suffix="min" value={component.laborMinutes} onChange={(value) => updateProductionComponent(component.id, "laborMinutes", value)} idSuffix={component.id} />
                {laborActivityFields.map((field) => <CostField key={field} label={laborActivityLabels[field]} suffix="min" value={component[field]} onChange={(value) => updateProductionComponent(component.id, field, value)} idSuffix={component.id} />)}
                <CostField label="Valor da mão de obra" suffix="R$/h" value={component.laborRatePerHour} onChange={(value) => updateProductionComponent(component.id, "laborRatePerHour", value)} idSuffix={component.id} />
              </div>
              <p className="price-field-hint">Este componente exige {numberValue(component.piecesPerProduct) * (input.batchQuantity ?? 1)} unidade(s) no lote. O peso e o tempo acima são os totais já medidos para essas unidades.</p>
            </article>)}</div>}
          </section>

          <section className="price-card">
            <div className="price-card-heading"><span className="price-step">03</span><div><h2>Trabalho e outros custos</h2><p>Informe a mão de obra da execução, componentes por peça e um custo fixo único do lote.</p></div></div>
            <div className="price-fields-grid">
              <CostField label="Outra mão de obra do lote" suffix="min" value={fields.laborMinutes} onChange={(value) => updateField("laborMinutes", value)} />
              {laborActivityFields.map((field) => <CostField key={field} label={laborActivityLabels[field]} suffix="min" value={fields[field]} onChange={(value) => updateField(field, value)} />)}
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
                <button type="button" className="price-remove-channel" aria-label={`Remover canal ${channel.name}`} onClick={() => setChannels((current) => current.filter((item) => item.id !== channel.id))}><Trash2 size={15} /></button>
                <div className="price-channel-fees">
                  <label><span>Taxa</span><span className="price-channel-input"><input type="number" min="0" max="99.99" step="0.01" inputMode="decimal" placeholder="0" value={channel.feePercent} onChange={(event) => updateChannel(channel.id, "feePercent", event.target.value)} /><small>%</small></span></label>
                  <label><span>Fixa</span><span className="price-channel-input"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" value={channel.fixedFee} onChange={(event) => updateChannel(channel.id, "fixedFee", event.target.value)} /><small>R$</small></span></label>
                  <label><span>Logística/peça</span><span className="price-channel-input"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" value={channel.logisticsCost} onChange={(event) => updateChannel(channel.id, "logisticsCost", event.target.value)} /><small>R$</small></span></label>
                  <label><span>Desconto</span><span className="price-channel-input"><input type="number" min="0" max={channel.discountType === "percent" ? "99.99" : undefined} step="0.01" inputMode="decimal" placeholder="0" value={channel.discountValue} onChange={(event) => updateChannel(channel.id, "discountValue", event.target.value)} /><select aria-label={`Tipo de desconto do canal ${channel.name}`} value={channel.discountType} onChange={(event) => updateChannel(channel.id, "discountType", event.target.value as "percent" | "fixed")}><option value="percent">%</option><option value="fixed">R$</option></select></span></label>
                </div>
              </div>)}
            </div>
            <button type="button" className="price-add-button" onClick={addChannel}><CirclePlus size={15} /> Comparar outro canal</button>
            <p className="price-disclaimer">O desconto é assumido pelo vendedor; a taxa percentual incide sobre o preço após o desconto. Informe taxas e logística por peça conforme seu canal.</p>
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
          {breakdown && breakdown.laborCents > 0 && <details className="price-labor-detail"><summary>Detalhar mão de obra</summary><div className="price-breakdown">{[["Outras tarefas", breakdown.laborOtherCents], ...laborActivityFields.map((field) => [laborActivityLabels[field], breakdown.laborActivityCents[field]])].map(([label, value]) => <div className="price-breakdown-row" key={String(label)}><span>{label}</span><strong>{money(value as number)}</strong></div>)}</div></details>}
          <div className="price-scenario-heading"><h2>Preço unitário por canal</h2><span>{pricingMode === "markup" ? "markup" : "margem"}: {(pricingMode === "markup" ? fields.targetMarkupPercent : fields.targetMarginPercent) ? `${pricingMode === "markup" ? fields.targetMarkupPercent : fields.targetMarginPercent}%` : "—"}</span></div>
          {canSaveCalculations && products.some((product) => product.canApplyPrice) && <label className="price-apply-product"><span>Aplicar um preço calculado a um anúncio</span><select value={selectedPriceTargetId} onChange={(event) => setSelectedPriceTargetId(event.target.value)}><option value="">Selecione um produto físico ou uma variação</option>{products.filter((product) => product.canApplyPrice).map((product) => <optgroup key={product.id} label={`${product.name} · ${product.published ? "publicado" : "rascunho"}`}>{product.variants.length ? product.variants.map((variant) => <option key={variant.id} value={variant.id}>{Object.entries(variant.options).map(([name, value]) => `${name}: ${value}`).join(" · ")} · atual {money(Math.round(variant.priceBrl * 100))}</option>) : <option value={product.id}>Preço atual {money(product.priceBrl == null ? null : Math.round(product.priceBrl * 100))}</option>}</optgroup>)}</select><small>O preço de lista será atualizado; descontos configurados no canal continuam simulados à parte.</small></label>}
          <div className="price-scenario-list">
            {channels.map((channel) => {
              const scenario = result.channels.find((item) => item.id === channel.id);
              const target = pricingMode === "markup" ? fields.targetMarkupPercent : fields.targetMarginPercent;
              const ready = target !== "" && channel.feePercent !== "" && channel.fixedFee !== "";
              const actualMarkup = result.unitCostCents ? ((scenario?.profitCents ?? 0) / result.unitCostCents * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : null;
              return <article className="price-scenario" key={channel.id}>
                <div className="price-scenario-top"><span>{channel.name || "Canal sem nome"}</span><strong>{ready && !result.errors.length ? money(scenario?.priceCents) : "—"}</strong></div>
                <p>{ready && scenario?.profitCents != null ? `Desconto ${money(scenario.discountCents)} · logística ${money(scenario.logisticsCostCents)} · lucro ${money(scenario.profitCents)} · margem ${scenario.actualMarginPercent?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%${pricingMode === "markup" && actualMarkup ? ` · markup ${actualMarkup}%` : ""}` : "Informe a meta e as taxas deste canal."}</p>
                {priceProduct && scenario?.priceCents != null && !result.errors.length && <form action={applyPriceAction} onSubmit={(event) => {
                  if (priceProduct.published && !window.confirm(`Atualizar o preço publicado de “${priceProduct.name}${priceVariant ? ` · ${priceTargetLabel}` : ""}” de ${money(currentPriceCents)} para ${money(scenario.priceCents)}?`)) event.preventDefault();
                  else if (priceProduct.published) event.currentTarget.querySelector<HTMLInputElement>('input[name="confirmedPublishedPrice"]')!.value = "yes";
                }}>
                  <input type="hidden" name="productId" value={priceProduct.id} />
                  <input type="hidden" name="variantId" value={priceVariant?.id ?? ""} />
                  <input type="hidden" name="priceCents" value={scenario.priceCents} />
                  <input type="hidden" name="expectedPriceCents" value={currentPriceCents} />
                  <input type="hidden" name="confirmedPublishedPrice" value="" />
                  <button className="price-apply-button" type="submit" disabled={applyingPrice || currentPriceCents === scenario.priceCents}>{applyingPrice ? "Aplicando…" : currentPriceCents === scenario.priceCents ? "Preço já aplicado" : "Aplicar no anúncio"}</button>
                </form>}
              </article>;
            })}
          </div>
          {priceApplyState.message && <p className={`auth-notice ${priceApplyState.success ? "is-success" : "is-error"}`} role="status">{priceApplyState.message}</p>}
          <p className="price-disclaimer">Estimativa manual: não inclui impostos, frete cobrado à parte, tarifas não informadas ou custos de produção não preenchidos.</p>
          {canRegisterConsignment && consignmentChannel && consignmentPrice?.priceCents != null && result.unitCostCents != null && <form action={createMakerConsignmentItem} className="consignment-create-form calculator-consignment-form">
            <div><p className="eyebrow">PRÓXIMO PASSO</p><h3>Registrar preço em consignação</h3><p>Usa o custo, a comissão e o preço calculado deste canal. A venda e o repasse continuam sendo registrados manualmente.</p></div>
            <input type="hidden" name="productId" value={consignmentProduct?.id ?? ""} />
            <input type="hidden" name="quantity" value={consignmentQuantity} />
            <input type="hidden" name="unitCostBrl" value={(result.unitCostCents / 100).toFixed(2)} />
            <input type="hidden" name="salePriceBrl" value={(consignmentPrice.priceCents / 100).toFixed(2)} />
            <input type="hidden" name="commissionPercent" value={consignmentChannel.feePercent} />
            <input type="hidden" name="commissionFixedFeeBrl" value={consignmentChannel.fixedFee.toFixed(2)} />
            <div className="consignment-form-grid"><label>Estabelecimento<input name="establishment" minLength={2} maxLength={120} required placeholder="Ex.: Loja do Centro" /></label>
            <label>Produto<input name="productName" minLength={2} maxLength={200} defaultValue={consignmentProduct?.name ?? (calculationTitle.trim() || fields.material.trim() || "Produto calculado")} required /></label></div>
            <p className="calculator-consignment-price">Lote de {consignmentQuantity} · custo {money(result.unitCostCents)} por peça · venda {money(consignmentPrice.priceCents)} · comissão {consignmentChannel.feePercent}% + {money(Math.round(consignmentChannel.fixedFee * 100))}</p>
            <button className="button button-secondary" type="submit">Criar lote em consignação</button>
          </form>}
          {canSaveCalculations && result.errors.length === 0 && hasProductionCost && consignmentQuantity > MAX_CONSIGNMENT_QUANTITY && <p className="auth-notice" role="status">O controle de consignação aceita lotes de até {MAX_CONSIGNMENT_QUANTITY.toLocaleString("pt-BR")} peças.</p>}
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
        {breakdown.laborCents > 0 && <><h2>Detalhamento da mão de obra</h2><table><tbody>{[["Outras tarefas", breakdown.laborOtherCents], ...laborActivityFields.map((field) => [laborActivityLabels[field], breakdown.laborActivityCents[field]])].map(([label, cents]) => <tr key={String(label)}><th>{String(label)}</th><td>{money(cents as number)}</td></tr>)}</tbody></table></>}
        {input.filamentCosts?.length ? <><h2>Custo por cor/material</h2><table><thead><tr><th>Filamento</th><th>Massa</th><th>Preço/kg</th><th>Subtotal</th></tr></thead><tbody>{input.filamentCosts.map((item, index) => <tr key={`${item.name ?? "filamento"}-${index}`}><th>{item.name || `Filamento ${index + 1}`}{item.color ? ` · ${item.color}` : ""}</th><td>{metric(item.grams, "g")}</td><td>{money(Math.round(item.pricePerKg * 100))}</td><td>{money(Math.round(item.grams * item.pricePerKg / 1000 * 100))}</td></tr>)}</tbody></table></> : null}
        <h2>Preços por canal</h2>
        <table><thead><tr><th>Canal</th><th>Taxa</th><th>Fixa</th><th>Desconto</th><th>Logística/peça</th><th>Preço</th><th>Lucro</th><th>Margem</th></tr></thead><tbody>{result.channels.map((scenario) => <tr key={scenario.id}><th>{scenario.name}</th><td>{parsedChannels.find((channel) => channel.id === scenario.id)?.feePercent}%</td><td>{money(scenario.fixedFeeCents)}</td><td>{money(scenario.discountCents)}</td><td>{money(scenario.logisticsCostCents)}</td><td>{money(scenario.priceCents)}</td><td>{money(scenario.profitCents)}</td><td>{scenario.actualMarginPercent?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</td></tr>)}</tbody></table>
        <p className="price-print-note">Estimativa com base nos custos, taxas e logística por peça informados. Não inclui custos que ficaram em branco, impostos ou frete cobrado à parte.</p>
      </section>}

      <section className="price-history" aria-labelledby="price-history-title">
        <div className="price-history-heading"><div><p className="eyebrow">CÁLCULOS DA SUA LOJA</p><h2 id="price-history-title">Histórico salvo</h2><p>Snapshots preservam os valores usados no momento do cálculo.</p></div></div>
        {canSaveCalculations ? <>
          <form action={saveAction} className="price-save-form">
            <label htmlFor="calculation-title">Nome do cálculo<input id="calculation-title" name="title" value={calculationTitle} onChange={(event) => setCalculationTitle(event.target.value)} minLength={2} maxLength={80} required placeholder="Ex.: Suporte de mesa · PLA" /></label>
            {productNotice && <p className="auth-notice is-error" role="status">{productNotice}</p>}
            {products.length > 0 && <label htmlFor="calculation-product">Vincular a um produto<select id="calculation-product" name="productSelector" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}><option value="">Sem vínculo com produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.published ? " · publicado" : " · rascunho"}</option>)}</select><small>Somente produtos desta loja aparecem nesta lista.</small></label>}
            {profileNotice && <p className="auth-notice is-error" role="status">{profileNotice}</p>}
            {profiles.length > 0 && <div className="calculator-profile-apply"><label htmlFor="calculation-profile">Perfil de impressão<select id="calculation-profile" name="profileSelector" value={selectedProfileId} onChange={(event) => { setSelectedProfileId(event.target.value); setProfileApplyNotice(""); }}><option value="">Sem vínculo com perfil</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.kind === "model" ? "Modelo 3D · " : "Loja · "}{profile.name}</option>)}</select><small>Escolha um perfil e aplique o consumo previsto para o lote.</small></label><button className="button button-secondary" type="button" onClick={applySelectedProfile} disabled={!selectedProfileId}>Aplicar consumo</button>{profileApplyNotice && <p className="price-profile-apply-note" role="status">{profileApplyNotice}</p>}</div>}
            <input type="hidden" name="productId" value={selectedProductId} />
            <input type="hidden" name="printerId" value={selectedEquipmentId} />
            <input type="hidden" name="profileId" value={selectedProfileId.startsWith("model:") ? "" : selectedProfileId} />
            <input type="hidden" name="snapshot" value={JSON.stringify({ input, channels: parsedChannels, slicer: slicerMetrics, origin: calculationOrigin, priceTargetId: selectedPriceTargetId || null, compatibilityNozzles: { main: { equipmentId: selectedEquipmentId || null, nozzleId: selectedNozzleId || null }, components: productionComponents.map((component) => ({ equipmentId: component.equipmentId || null, nozzleId: componentNozzleIds[component.id] || null })) } })} />
            <button className="button button-primary" type="submit" disabled={saving || !hasProductionCost || result.errors.length > 0}>{saving ? "Salvando…" : "Salvar cálculo"}</button>
            {saveState.message && <p className={saveState.success ? "auth-notice is-success" : "auth-notice is-error"} role="status">{saveState.message}</p>}
          </form>
          {savedCalculationsError ? <p className="auth-notice is-error" role="alert">Não foi possível carregar o histórico. Confira as migrações da calculadora e dos vínculos com produtos, equipamentos e perfis.</p> : savedCalculations.length === 0 ? <p className="price-history-empty">Os cálculos salvos aparecerão aqui.</p> : <div className="price-history-list">{savedCalculations.map((saved) => <article className="price-history-item" key={saved.id}>
            <div><strong>{saved.title}</strong><span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(saved.createdAt))} · {saved.batchQuantity} peças · lote {money(saved.totalCostCents)} · unidade {money(saved.unitCostCents)}</span><span>Origem dos dados: {{ manual: "Entrada manual", ocr: "OCR de imagem", "3mf": "Arquivo 3MF", profile: "Perfil de impressão", unknown: "Não registrada (histórico antigo)" }[saved.origin]}</span>{saved.productName && <span>Produto: {saved.productUrl ? <Link href={saved.productUrl}>{saved.productName}</Link> : saved.productName}</span>}{saved.priceTargetId && <span>Preço destinado a: {saved.priceTargetName ?? "anúncio não disponível nesta loja"}</span>}{saved.compatibilityNozzleLabels.length > 0 && <span>Bicos verificados: {saved.compatibilityNozzleLabels.join("; ")}</span>}{saved.printerName && <span>Equipamento: {saved.printerName}</span>}{saved.profileName && <span>Perfil: {saved.profileName}</span>}{saved.slicer && <><span>{saved.slicer.slicer} · modelo {metric(saved.slicer.modelGrams, "g")} · suportes {metric(saved.slicer.supportGrams, "g")} · total {metric(saved.slicer.totalGrams, "g")} · filamentos {metric(saved.slicer.filamentGrams, "g")} · purga {metric(saved.slicer.purgeGrams, "g")} · torre {metric(saved.slicer.wipeTowerGrams, "g")} · comprimento {metric(saved.slicer.lengthMeters, "m")} · trocas {saved.slicer.filamentChanges == null ? "—" : saved.slicer.filamentChanges.toLocaleString("pt-BR")} · tempo {metric(saved.slicer.printHours, "h")}</span>{saved.slicer.filaments.length > 0 && <details><summary>Consumo por filamento ({saved.slicer.filaments.length})</summary><ul>{saved.slicer.filaments.map((filament) => <li key={filament.index}>Filamento {filament.index}{filament.material ? ` · ${filament.material}` : ""}{filament.color ? ` · ${filament.color}` : ""} · {metric(filament.grams, "g")} · {metric(filament.lengthMeters, "m")} · preço/kg {money(filament.pricePerKg == null ? null : Math.round(filament.pricePerKg * 100))}</li>)}</ul></details>}{saved.slicer.conflicts.length > 0 && <span>Campos com conflito ignorados: {saved.slicer.conflicts.join(", ")}</span>}</>}</div>
            <div className="price-history-actions"><button className="button button-secondary" type="button" onClick={() => duplicateCalculation(saved.snapshot, saved.title, saved.productId, saved.printerId, saved.profileId)}>Abrir como cópia</button><form action={deleteMakerCalculation} onSubmit={(event) => { if (!window.confirm(`Excluir “${saved.title}” do histórico?`)) event.preventDefault(); }}><input type="hidden" name="calculationId" value={saved.id} /><button className="price-history-delete" type="submit">Excluir</button></form></div>
          </article>)}</div>}
        </> : <div className="price-history-locked"><p>Entre com uma conta de fabricante e loja aprovada para manter um histórico privado dos seus custos.</p><Link className="button button-secondary" href="/conta">Acessar conta</Link></div>}
      </section>
    </section>
  );
}
