import { calculatePrintPrice, MAX_BATCH_QUANTITY, MAX_PRODUCTION_COMPONENTS, type PrintCostInput, type ProductionComponent, type SalesChannel } from "./pricing";

export const MAX_SAVED_CALCULATION_JSON = 20_000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const validNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000;
const optionalUuid = (value: unknown) => value == null || value === "" ? null : typeof value === "string" && uuidPattern.test(value) ? value : undefined;

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

  const rawInput = parsed.input;
  const material = rawInput.material === undefined ? "" : typeof rawInput.material === "string" && rawInput.material.length <= 120 ? rawInput.material.trim() : undefined;
  const numberFields = ["filamentGrams", "filamentPricePerKg", "printHours", "averagePowerWatts", "energyPricePerKwh", "machineCostPerHour", "depreciationPerHour", "maintenancePerHour", "laborMinutes", "laborRatePerHour", "overheadPerUnit", "failureReservePercent", "targetMarginPercent"] as const;
  const batchQuantity = rawInput.batchQuantity === undefined ? 1 : rawInput.batchQuantity;
  const batchFixedCost = rawInput.batchFixedCost === undefined ? 0 : rawInput.batchFixedCost;
  const rawComponents = rawInput.productionComponents === undefined ? [] : rawInput.productionComponents;
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
  if (material === undefined || !numberFields.every((field) => validNumber(rawInput[field])) || !validNumber(batchQuantity) || !Number.isSafeInteger(batchQuantity) || batchQuantity < 1 || batchQuantity > MAX_BATCH_QUANTITY
    || !validNumber(batchFixedCost) || !Array.isArray(rawInput.additionalCosts) || rawInput.additionalCosts.length > 30
    || productionComponents === null || productionComponents.some((component) => component === null)) {
    return { calculation: null, error: "Revise os valores do cálculo antes de salvar." };
  }

  const additionalCosts = rawInput.additionalCosts.map((item) => isRecord(item) && typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 80 && validNumber(item.amount)
    ? { name: item.name.trim(), amount: item.amount }
    : null);
  if (additionalCosts.some((item) => item === null)) return { calculation: null, error: "Há componentes adicionais inválidos." };

  const input = { ...Object.fromEntries(numberFields.map((field) => [field, rawInput[field]])), material, batchQuantity, batchFixedCost, productionComponents } as unknown as Omit<PrintCostInput, "additionalCosts">;
  const channels = parsed.channels.map((item) => isRecord(item) && typeof item.id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(item.id)
    && typeof item.name === "string" && item.name.trim().length <= 80
    && validNumber(item.feePercent) && item.feePercent < 100 && validNumber(item.fixedFee)
    ? { id: item.id, name: item.name.trim(), feePercent: item.feePercent, fixedFee: item.fixedFee }
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
      title: rawTitle.trim(), productId, printerId, profileId, input: safeInput, channels: safeChannels,
      result: { breakdown: result.breakdown, unitCostCents: result.unitCostCents, channels: result.channels },
    },
    error: null,
  };
}
