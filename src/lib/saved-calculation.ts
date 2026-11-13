import { calculatePrintPrice, MAX_BATCH_QUANTITY, MAX_PRODUCTION_COMPONENTS, type FilamentCost, type PrintCostInput, type ProductionComponent, type SalesChannel } from "./pricing";
import type { ThreeMfSlicePlate } from "./model-file";

export const MAX_SAVED_CALCULATION_JSON = 20_000;
export const calculationOrigins = ["manual", "ocr", "3mf", "profile", "unknown"] as const;
export type CalculationOrigin = typeof calculationOrigins[number];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const validNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000;
const optionalUuid = (value: unknown) => value == null || value === "" ? null : typeof value === "string" && uuidPattern.test(value) ? value : undefined;
const optionalCatalogId = (value: unknown) => value == null || value === "" ? null : typeof value === "string" && value.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value) ? value : undefined;
export type SavedCompatibilityNozzleCheck = { equipmentId: string | null; nozzleId: string | null };
export type SavedCompatibilityNozzles = { main: SavedCompatibilityNozzleCheck; components: SavedCompatibilityNozzleCheck[] };

function parseCompatibilityNozzles(value: unknown): SavedCompatibilityNozzles | undefined {
  if (value === undefined) return { main: { equipmentId: null, nozzleId: null }, components: [] };
  if (!isRecord(value) || !isRecord(value.main) || !Array.isArray(value.components) || value.components.length > MAX_PRODUCTION_COMPONENTS) return undefined;
  const parseCheck = (check: Record<string, unknown>) => {
    const equipmentId = optionalUuid(check.equipmentId);
    const nozzleId = optionalCatalogId(check.nozzleId);
    return equipmentId === undefined || nozzleId === undefined ? undefined : { equipmentId, nozzleId };
  };
  const main = parseCheck(value.main);
  const components = value.components.map((check) => isRecord(check) ? parseCheck(check) : undefined);
  return !main || components.some((check) => !check) ? undefined : { main, components: components as SavedCompatibilityNozzleCheck[] };
}
export type SavedSlicerMetrics = {
  slicer: string; modelGrams: number | null; supportGrams: number | null; totalGrams: number | null;
  purgeGrams: number | null; wipeTowerGrams: number | null; filamentGrams: number | null; derivedMass: boolean;
  lengthMeters: number | null; printHours: number | null; filamentChanges: number | null; estimatedCost: number | null;
  estimatedCostCurrency?: "BRL" | "USD" | null;
  materials: string[]; filaments: Array<{ index: number; grams: number | null; lengthMeters: number | null; pricePerKg: number | null; material: string | null; color: string | null }>;
  conflicts: string[];
};

export function mapThreeMfPlateToSlicerMetrics(plate: ThreeMfSlicePlate, plateNumber: number): SavedSlicerMetrics {
  const filamentGrams = plate.weightGrams ?? (plate.filaments.length > 0 && plate.filaments.every((filament) => filament.weightGrams !== null)
    ? plate.filaments.reduce((total, filament) => total + filament.weightGrams!, 0)
    : null);
  const lengths = plate.filaments.map((filament) => filament.lengthMeters);
  return {
    slicer: `Arquivo 3MF · placa ${plate.index ?? plateNumber}`,
    modelGrams: null,
    supportGrams: null,
    totalGrams: plate.weightGrams,
    purgeGrams: null,
    wipeTowerGrams: null,
    filamentGrams,
    derivedMass: plate.weightGrams === null && filamentGrams !== null,
    lengthMeters: lengths.length > 0 && lengths.every((length) => length !== null)
      ? lengths.reduce((total, length) => total + length!, 0)
      : null,
    printHours: plate.printTimeSeconds === null ? null : plate.printTimeSeconds / 3600,
    filamentChanges: null,
    estimatedCost: null,
    materials: [...new Set(plate.filaments.map((filament) => filament.type).filter((type): type is string => Boolean(type)))].slice(0, 20),
    filaments: plate.filaments.slice(0, 32).map((filament, index) => ({
      index: index + 1, grams: filament.weightGrams, lengthMeters: filament.lengthMeters, pricePerKg: null, material: filament.type, color: filament.color,
    })),
    conflicts: [],
  };
}

function parseSlicerMetrics(value: unknown): SavedSlicerMetrics | null | undefined {
  if (value == null) return null;
  if (!isRecord(value)) return undefined;
  const metricFields = ["modelGrams", "supportGrams", "totalGrams", "purgeGrams", "wipeTowerGrams", "filamentGrams", "lengthMeters", "printHours", "filamentChanges", "estimatedCost"] as const;
  const costCurrency = value.estimatedCostCurrency;
  const nullableNumber = (item: unknown) => item === null || validNumber(item);
  if (typeof value.slicer !== "string" || value.slicer.length > 40 || typeof value.derivedMass !== "boolean"
    || !metricFields.every((field) => nullableNumber(value[field]))
    || !(costCurrency === undefined || costCurrency === null || costCurrency === "BRL" || costCurrency === "USD")
    || !Array.isArray(value.materials) || value.materials.length > 20 || value.materials.some((item) => typeof item !== "string" || item.length > 40)
    || !Array.isArray(value.conflicts) || value.conflicts.length > 30 || value.conflicts.some((item) => typeof item !== "string" || item.length > 80)
    || !Array.isArray(value.filaments) || value.filaments.length > 32 || value.filaments.some((item) => !isRecord(item)
      || !Number.isSafeInteger(item.index) || (item.index as number) < 0 || !(item.grams === null || validNumber(item.grams))
      || !(item.pricePerKg === undefined || item.pricePerKg === null || validNumber(item.pricePerKg))
      || !(item.lengthMeters === undefined || item.lengthMeters === null || validNumber(item.lengthMeters))
      || !(item.material === null || typeof item.material === "string" && item.material.length <= 40)
      || !(item.color === null || typeof item.color === "string" && item.color.length <= 40))) return undefined;
  return {
    slicer: value.slicer, derivedMass: value.derivedMass,
    ...Object.fromEntries(metricFields.map((field) => [field, value[field]])),
    estimatedCostCurrency: costCurrency ?? null,
    materials: value.materials as string[], conflicts: value.conflicts as string[],
    filaments: value.filaments.map((item) => ({ ...item, lengthMeters: item.lengthMeters ?? null, pricePerKg: item.pricePerKg ?? null })) as SavedSlicerMetrics["filaments"],
  } as SavedSlicerMetrics;
}

export function validateCalculationToSave(rawTitle: unknown, rawSnapshot: unknown, rawProductId?: unknown, rawPrinterId?: unknown, rawProfileId?: unknown) {
  if (typeof rawTitle !== "string" || rawTitle.trim().length < 2 || rawTitle.trim().length > 80) {
    return { calculation: null, error: "Informe um nome de 2 a 80 caracteres." };
  }
  if (typeof rawSnapshot !== "string" || rawSnapshot.length === 0 || rawSnapshot.length > MAX_SAVED_CALCULATION_JSON) {
    return { calculation: null, error: "Os dados do cálculo estão ausentes ou excedem o limite." };
  }
  const productId = optionalUuid(rawProductId);
  const printerId = optionalUuid(rawPrinterId);
  const profileId = optionalUuid(rawProfileId);
  if (productId === undefined || printerId === undefined || profileId === undefined) return { calculation: null, error: "O produto, equipamento ou perfil vinculado é inválido." };

  let parsed: unknown;
  try { parsed = JSON.parse(rawSnapshot); } catch { return { calculation: null, error: "Os dados do cálculo são inválidos." }; }
  if (!isRecord(parsed) || !isRecord(parsed.input) || !Array.isArray(parsed.channels) || parsed.channels.length < 1 || parsed.channels.length > 10) {
    return { calculation: null, error: "Informe ao menos um canal de venda válido." };
  }
  const priceTargetId = optionalUuid(parsed.priceTargetId);
  if (priceTargetId === undefined) return { calculation: null, error: "O anúncio selecionado para receber o preço é inválido." };
  const compatibilityNozzles = parseCompatibilityNozzles(parsed.compatibilityNozzles);
  if (!compatibilityNozzles) return { calculation: null, error: "A seleção de bicos para a checagem de compatibilidade é inválida." };
  const slicer = parseSlicerMetrics(parsed.slicer);
  if (slicer === undefined) return { calculation: null, error: "Os dados reconhecidos pelo OCR são inválidos." };
  const origin = parsed.origin === undefined ? "unknown" : parsed.origin;
  if (!calculationOrigins.includes(origin as CalculationOrigin)) return { calculation: null, error: "A origem dos dados do cálculo é inválida." };

  const rawInput = parsed.input;
  const pricingMode = rawInput.pricingMode === undefined ? "margin" : rawInput.pricingMode;
  const targetMarkupPercent = rawInput.targetMarkupPercent === undefined && pricingMode === "margin" ? 0 : rawInput.targetMarkupPercent;
  const material = rawInput.material === undefined ? "" : typeof rawInput.material === "string" && rawInput.material.length <= 120 ? rawInput.material.trim() : undefined;
  const numberFields = ["filamentGrams", "filamentPricePerKg", "printHours", "averagePowerWatts", "energyPricePerKwh", "machineCostPerHour", "depreciationPerHour", "maintenancePerHour", "laborMinutes", "laborRatePerHour", "overheadPerUnit", "failureReservePercent", "targetMarginPercent"] as const;
  const batchQuantity = rawInput.batchQuantity === undefined ? 1 : rawInput.batchQuantity;
  const batchFixedCost = rawInput.batchFixedCost === undefined ? 0 : rawInput.batchFixedCost;
  const rawComponents = rawInput.productionComponents === undefined ? [] : rawInput.productionComponents;
  const rawFilamentCosts = rawInput.filamentCosts === undefined ? [] : rawInput.filamentCosts;
  const filamentCosts = Array.isArray(rawFilamentCosts) && rawFilamentCosts.length <= 32
    ? rawFilamentCosts.map((item): FilamentCost | null => isRecord(item) && validNumber(item.grams) && validNumber(item.pricePerKg)
      && (item.name === undefined || item.name === null || typeof item.name === "string" && item.name.length <= 80)
      && (item.color === undefined || item.color === null || typeof item.color === "string" && item.color.length <= 40)
      ? { grams: item.grams, pricePerKg: item.pricePerKg, name: typeof item.name === "string" ? item.name : null, color: typeof item.color === "string" ? item.color : null }
      : null)
    : null;
  const componentNumberFields = ["filamentGrams", "filamentPricePerKg", "printHours", "averagePowerWatts", "energyPricePerKwh", "machineCostPerHour", "depreciationPerHour", "maintenancePerHour", "laborMinutes", "laborRatePerHour"] as const;
  const productionComponents = Array.isArray(rawComponents) && rawComponents.length <= MAX_PRODUCTION_COMPONENTS
    ? rawComponents.map((item): ProductionComponent | null => isRecord(item)
      && typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 80
      && typeof item.material === "string" && item.material.length <= 120
      && typeof item.printer === "string" && item.printer.length <= 120
      && validNumber(item.piecesPerProduct) && Number.isSafeInteger(item.piecesPerProduct) && item.piecesPerProduct > 0 && item.piecesPerProduct <= MAX_BATCH_QUANTITY
      && componentNumberFields.every((field) => validNumber(item[field]))
      ? {
        name: item.name.trim(), material: item.material.trim(), printer: item.printer.trim(), piecesPerProduct: item.piecesPerProduct,
        ...Object.fromEntries(componentNumberFields.map((field) => [field, item[field]])),
      } as ProductionComponent
      : null)
    : null;
  if ((pricingMode !== "margin" && pricingMode !== "markup") || (pricingMode === "markup" && rawInput.targetMarkupPercent === undefined)
    || !validNumber(targetMarkupPercent) || material === undefined || !numberFields.every((field) => validNumber(rawInput[field])) || !validNumber(batchQuantity) || !Number.isSafeInteger(batchQuantity) || batchQuantity < 1 || batchQuantity > MAX_BATCH_QUANTITY
    || !validNumber(batchFixedCost) || !Array.isArray(rawInput.additionalCosts) || rawInput.additionalCosts.length > 30
    || productionComponents === null || productionComponents.some((component) => component === null)
    || filamentCosts === null || filamentCosts.some((filament) => filament === null)) {
    return { calculation: null, error: "Revise os valores do cálculo antes de salvar." };
  }

  const additionalCosts = rawInput.additionalCosts.map((item) => isRecord(item) && typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 80 && validNumber(item.amount)
    ? { name: item.name.trim(), amount: item.amount }
    : null);
  if (additionalCosts.some((item) => item === null)) return { calculation: null, error: "Há componentes adicionais inválidos." };

  const input = { ...Object.fromEntries(numberFields.map((field) => [field, rawInput[field]])), material, batchQuantity, batchFixedCost, productionComponents, filamentCosts: filamentCosts as FilamentCost[], pricingMode, targetMarkupPercent } as unknown as Omit<PrintCostInput, "additionalCosts">;
  const channels = parsed.channels.map((item) => isRecord(item) && typeof item.id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(item.id)
    && typeof item.name === "string" && item.name.trim().length <= 80
    && validNumber(item.feePercent) && item.feePercent < 100 && validNumber(item.fixedFee)
    && (item.logisticsCost === undefined || validNumber(item.logisticsCost))
    && (item.discountPercent === undefined || validNumber(item.discountPercent) && item.discountPercent <= 99.99)
    && (item.discountFixed === undefined || validNumber(item.discountFixed))
    && !((item.discountPercent ?? 0) > 0 && (item.discountFixed ?? 0) > 0)
    ? {
      id: item.id, name: item.name.trim(), feePercent: item.feePercent, fixedFee: item.fixedFee,
      logisticsCost: item.logisticsCost ?? 0, discountPercent: item.discountPercent ?? 0, discountFixed: item.discountFixed ?? 0,
    }
    : null);
  if (channels.some((item) => item === null) || new Set(channels.map((item) => item?.id)).size !== channels.length) {
    return { calculation: null, error: "Há canais de venda inválidos ou repetidos." };
  }

  const safeInput: PrintCostInput = { ...input, additionalCosts: additionalCosts as PrintCostInput["additionalCosts"] };
  const safeChannels = channels as SalesChannel[];
  const result = calculatePrintPrice(safeInput, safeChannels);
  if (result.errors.length || !result.breakdown || result.breakdown.totalCostCents <= 0) {
    return { calculation: null, error: result.errors[0] ?? "Informe um custo de produção maior que zero." };
  }

  return {
    calculation: {
      title: rawTitle.trim(), productId, printerId, profileId, priceTargetId, compatibilityNozzles, input: safeInput, channels: safeChannels,
      slicer, origin: origin as CalculationOrigin,
      result: { breakdown: result.breakdown, unitCostCents: result.unitCostCents, channels: result.channels },
    },
    error: null,
  };
}
