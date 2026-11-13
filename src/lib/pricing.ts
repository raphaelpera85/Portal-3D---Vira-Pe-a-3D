export type AdditionalCost = { name: string; amount: number };
export type ProductionComponent = {
  name: string;
  material: string;
  printer: string;
  piecesPerProduct: number;
  filamentGrams: number;
  filamentPricePerKg: number;
  printHours: number;
  averagePowerWatts: number;
  energyPricePerKwh: number;
  machineCostPerHour: number;
  depreciationPerHour: number;
  maintenancePerHour: number;
  laborMinutes: number;
  laborRatePerHour: number;
};
export type SalesChannel = { id: string; name: string; feePercent: number; fixedFee: number; logisticsCost?: number };
export type FilamentCost = { grams: number; pricePerKg: number; name?: string | null; color?: string | null };
export const MAX_BATCH_QUANTITY = 1_000_000;
export const MAX_PRODUCTION_COMPONENTS = 20;

export type PrintCostInput = {
  batchQuantity?: number;
  batchFixedCost?: number;
  material?: string;
  productionComponents?: ProductionComponent[];
  filamentCosts?: FilamentCost[];
  filamentGrams: number;
  filamentPricePerKg: number;
  printHours: number;
  averagePowerWatts: number;
  energyPricePerKwh: number;
  machineCostPerHour: number;
  depreciationPerHour: number;
  maintenancePerHour: number;
  laborMinutes: number;
  laborRatePerHour: number;
  overheadPerUnit: number;
  failureReservePercent: number;
  additionalCosts: AdditionalCost[];
  targetMarginPercent: number;
  pricingMode?: "margin" | "markup";
  targetMarkupPercent?: number;
};

export type CostBreakdown = {
  materialCents: number;
  energyCents: number;
  machineCents: number;
  depreciationCents: number;
  maintenanceCents: number;
  laborCents: number;
  additionalCents: number;
  overheadCents: number;
  batchFixedCents: number;
  failureReserveCents: number;
  totalCostCents: number;
};

export type ChannelPrice = {
  id: string;
  name: string;
  feeCents: number;
  fixedFeeCents: number;
  logisticsCostCents: number;
  priceCents: number | null;
  profitCents: number | null;
  actualMarginPercent: number | null;
};

export function calculatePrintPrice(input: PrintCostInput, channels: SalesChannel[]) {
  const pricingMode = input.pricingMode ?? "margin";
  const targetMarkupPercent = input.targetMarkupPercent ?? 0;
  const batchQuantity = input.batchQuantity ?? 1;
  const batchFixedCost = input.batchFixedCost ?? 0;
  const components = input.productionComponents ?? [];
  const filamentCosts = input.filamentCosts ?? [];
  if (!Array.isArray(filamentCosts) || filamentCosts.length > 32 || filamentCosts.some((filament) => !filament
    || !Number.isFinite(filament.grams) || filament.grams < 0 || !Number.isFinite(filament.pricePerKg) || filament.pricePerKg < 0)) {
    return { errors: ["Revise os custos e as massas dos filamentos."], breakdown: null, unitCostCents: null, channels: [] };
  }
  const numericValues = [
    batchQuantity, batchFixedCost,
    input.filamentGrams, input.filamentPricePerKg, input.printHours, input.averagePowerWatts,
    input.energyPricePerKwh, input.machineCostPerHour, input.depreciationPerHour,
    input.maintenancePerHour, input.laborMinutes, input.laborRatePerHour,
    input.overheadPerUnit, input.failureReservePercent, input.targetMarginPercent, targetMarkupPercent,
    ...input.additionalCosts.map(({ amount }) => amount),
    ...filamentCosts.flatMap(({ grams, pricePerKg }) => [grams, pricePerKg]),
    ...components.flatMap(({ piecesPerProduct, filamentGrams, filamentPricePerKg, printHours, averagePowerWatts, energyPricePerKwh, machineCostPerHour, depreciationPerHour, maintenancePerHour, laborMinutes, laborRatePerHour }) => [
      piecesPerProduct, filamentGrams, filamentPricePerKg, printHours, averagePowerWatts,
      energyPricePerKwh, machineCostPerHour, depreciationPerHour, maintenancePerHour, laborMinutes, laborRatePerHour,
    ]),
    ...channels.flatMap(({ feePercent, fixedFee, logisticsCost = 0 }) => [feePercent, fixedFee, logisticsCost]),
  ];

  if (numericValues.some((value) => !Number.isFinite(value))) {
    return { errors: ["Preencha somente valores numéricos válidos."], breakdown: null, unitCostCents: null, channels: [] };
  }
  if (pricingMode !== "margin" && pricingMode !== "markup") {
    return { errors: ["Selecione margem sobre venda ou markup sobre custo."], breakdown: null, unitCostCents: null, channels: [] };
  }
  if (numericValues.some((value) => value < 0)) {
    return { errors: ["Os custos e quantidades não podem ser negativos."], breakdown: null, unitCostCents: null, channels: [] };
  }
  if (!Number.isSafeInteger(batchQuantity) || batchQuantity < 1 || batchQuantity > MAX_BATCH_QUANTITY) {
    return { errors: ["A quantidade do lote deve ser um número inteiro entre 1 e 1.000.000."], breakdown: null, unitCostCents: null, channels: [] };
  }
  if (components.length > MAX_PRODUCTION_COMPONENTS || components.some(({ name, material, printer, piecesPerProduct }) =>
    typeof name !== "string" || name.trim().length < 1 || name.length > 80
    || typeof material !== "string" || material.length > 120
      || typeof printer !== "string" || printer.length > 120
      || !Number.isSafeInteger(piecesPerProduct) || piecesPerProduct < 1 || piecesPerProduct > MAX_BATCH_QUANTITY
  )) {
    return { errors: ["Revise os nomes, as quantidades e o limite de componentes por lote."], breakdown: null, unitCostCents: null, channels: [] };
  }
  if (input.failureReservePercent > 100 || channels.some((channel) => channel.feePercent >= 100)
    || (pricingMode === "margin" && input.targetMarginPercent >= 100)) {
    return { errors: ["Margens, taxas e reservas devem ficar entre 0% e 100%."], breakdown: null, unitCostCents: null, channels: [] };
  }
  if (pricingMode === "margin" && channels.some((channel) => input.targetMarginPercent + channel.feePercent >= 100)) {
    return { errors: ["A margem desejada somada às taxas precisa ser menor que 100%."], breakdown: null, unitCostCents: null, channels: [] };
  }

  const roundCents = (amount: number) => Math.round(amount * 100);
  const componentCosts = components.reduce((sum, component) => ({
    materialCents: sum.materialCents + roundCents(component.filamentGrams * component.filamentPricePerKg / 1000),
    energyCents: sum.energyCents + roundCents(component.averagePowerWatts / 1000 * component.printHours * component.energyPricePerKwh),
    machineCents: sum.machineCents + roundCents(component.printHours * component.machineCostPerHour),
    depreciationCents: sum.depreciationCents + roundCents(component.printHours * component.depreciationPerHour),
    maintenanceCents: sum.maintenanceCents + roundCents(component.printHours * component.maintenancePerHour),
    laborCents: sum.laborCents + roundCents(component.laborMinutes / 60 * component.laborRatePerHour),
  }), { materialCents: 0, energyCents: 0, machineCents: 0, depreciationCents: 0, maintenanceCents: 0, laborCents: 0 });
  const productionCosts = {
    materialCents: (filamentCosts.length
      ? filamentCosts.reduce((sum, filament) => sum + roundCents(filament.grams * filament.pricePerKg / 1000), 0)
      : roundCents(input.filamentGrams * input.filamentPricePerKg / 1000)) + componentCosts.materialCents,
    energyCents: roundCents(input.averagePowerWatts / 1000 * input.printHours * input.energyPricePerKwh) + componentCosts.energyCents,
    machineCents: roundCents(input.printHours * input.machineCostPerHour) + componentCosts.machineCents,
    depreciationCents: roundCents(input.printHours * input.depreciationPerHour) + componentCosts.depreciationCents,
    maintenanceCents: roundCents(input.printHours * input.maintenancePerHour) + componentCosts.maintenanceCents,
    laborCents: roundCents(input.laborMinutes / 60 * input.laborRatePerHour) + componentCosts.laborCents,
    additionalCents: input.additionalCosts.reduce((sum, item) => sum + roundCents(item.amount) * batchQuantity, 0),
    overheadCents: roundCents(input.overheadPerUnit) * batchQuantity,
    batchFixedCents: roundCents(batchFixedCost),
  };
  const beforeReserveCents = Object.values(productionCosts).reduce((sum, amount) => sum + amount, 0);
  const failureReserveCents = Math.round(beforeReserveCents * input.failureReservePercent / 100);
  const totalCostCents = beforeReserveCents + failureReserveCents;
  const unitCostCents = totalCostCents === 0 ? null : Math.ceil(totalCostCents / batchQuantity);

  if (![...Object.values(productionCosts), failureReserveCents, totalCostCents].every(Number.isSafeInteger)) {
    return { errors: ["Os valores excedem o limite seguro do cálculo."], breakdown: null, unitCostCents: null, channels: [] };
  }

  const targetMarkupProfitCents = unitCostCents == null ? 0 : Math.ceil(unitCostCents * targetMarkupPercent / 100);
  if (unitCostCents != null && !Number.isSafeInteger(targetMarkupProfitCents)) {
    return { errors: ["Os valores excedem o limite seguro do cálculo."], breakdown: null, unitCostCents: null, channels: [] };
  }
  if (channels.some((channel) => {
    const denominator = 1 - channel.feePercent / 100 - (pricingMode === "margin" ? input.targetMarginPercent / 100 : 0);
    const baseCents = (unitCostCents ?? 0) + roundCents(channel.fixedFee) + roundCents(channel.logisticsCost ?? 0)
      + (pricingMode === "markup" ? targetMarkupProfitCents : 0);
    return !Number.isSafeInteger(roundCents(channel.fixedFee) + roundCents(channel.logisticsCost ?? 0))
      || (unitCostCents != null && !Number.isSafeInteger(Math.ceil((baseCents + 1) / denominator) + 1));
  })) {
    return { errors: ["Os valores excedem o limite seguro do cálculo."], breakdown: null, unitCostCents: null, channels: [] };
  }

  const breakdown: CostBreakdown = { ...productionCosts, failureReserveCents, totalCostCents };
  const channelPrices = channels.map((channel): ChannelPrice => {
    const feeCents = roundCents(channel.fixedFee);
    const logisticsCostCents = roundCents(channel.logisticsCost ?? 0);
    if (unitCostCents == null) {
      return { id: channel.id, name: channel.name, feeCents: 0, fixedFeeCents: feeCents, logisticsCostCents, priceCents: null, profitCents: null, actualMarginPercent: null };
    }

    const feeRate = channel.feePercent / 100;
    const marginRate = pricingMode === "margin" ? input.targetMarginPercent / 100 : 0;
    const denominator = 1 - feeRate - marginRate;
    const baseCents = unitCostCents + feeCents + logisticsCostCents;
    let high = Math.max(baseCents, Math.ceil((baseCents + (pricingMode === "markup" ? targetMarkupProfitCents : 0) + 1) / denominator) + 1);
    const meetsTarget = (priceCents: number) => {
      const roundedPercentageFee = roundCents(priceCents / 100 * channel.feePercent / 100);
      const profit = priceCents - unitCostCents - feeCents - logisticsCostCents - roundedPercentageFee;
      return pricingMode === "markup" ? profit >= targetMarkupProfitCents : profit / priceCents * 100 >= input.targetMarginPercent;
    };

    let low = baseCents;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (meetsTarget(middle)) high = middle;
      else low = middle + 1;
    }

    const roundedPercentageFee = roundCents(low / 100 * channel.feePercent / 100);
    const profitCents = low - unitCostCents - feeCents - logisticsCostCents - roundedPercentageFee;
    return {
      id: channel.id,
      name: channel.name,
      feeCents: roundedPercentageFee,
      fixedFeeCents: feeCents,
      logisticsCostCents,
      priceCents: low,
      profitCents,
      actualMarginPercent: profitCents / low * 100,
    };
  });

  return { errors: [], breakdown, unitCostCents, channels: channelPrices };
}
