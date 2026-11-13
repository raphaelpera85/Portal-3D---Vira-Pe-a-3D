import { describe, expect, it } from "vitest";
import { calculatePrintPrice } from "./pricing";

const sample = {
  filamentGrams: 200,
  filamentPricePerKg: 100,
  printHours: 3,
  averagePowerWatts: 120,
  energyPricePerKwh: 0.8,
  machineCostPerHour: 4,
  depreciationPerHour: 2,
  maintenancePerHour: 1,
  laborMinutes: 30,
  laborRatePerHour: 24,
  overheadPerUnit: 1,
  failureReservePercent: 10,
  additionalCosts: [{ name: "Ímãs", amount: 2.5 }],
  targetMarginPercent: 25,
};

describe("calculatePrintPrice", () => {
  it("includes seller logistics cost in channel pricing and reports it separately", () => {
    const result = calculatePrintPrice({
      ...sample,
      filamentGrams: 100,
      filamentPricePerKg: 100,
      printHours: 0,
      averagePowerWatts: 0,
      machineCostPerHour: 0,
      depreciationPerHour: 0,
      maintenancePerHour: 0,
      laborMinutes: 0,
      overheadPerUnit: 0,
      failureReservePercent: 0,
      additionalCosts: [],
      targetMarginPercent: 25,
    }, [{ id: "marketplace", name: "Marketplace", feePercent: 10, fixedFee: 1, logisticsCost: 3.5 }]);

    expect(result.errors).toEqual([]);
    expect(result.channels[0]).toMatchObject({
      fixedFeeCents: 100,
      logisticsCostCents: 350,
      priceCents: 2231,
      profitCents: 558,
    });
    expect(result.channels[0].actualMarginPercent).toBeGreaterThanOrEqual(25);
  });

  it("breaks down production cost and finds channel prices at the requested margin", () => {
    const result = calculatePrintPrice(sample, [
      { id: "marketplace", name: "Marketplace", feePercent: 12, fixedFee: 2 },
      { id: "store", name: "Loja própria", feePercent: 4, fixedFee: 0.5 },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.breakdown).toEqual({
      materialCents: 2000,
      energyCents: 29,
      machineCents: 1200,
      depreciationCents: 600,
      maintenanceCents: 300,
      laborCents: 1200,
      additionalCents: 250,
      overheadCents: 100,
      batchFixedCents: 0,
      failureReserveCents: 568,
      totalCostCents: 6247,
    });
    expect(result.channels[0].priceCents).toBe(10234);
    expect(result.channels[0].actualMarginPercent).toBeGreaterThanOrEqual(25);
    expect(result.channels[1].actualMarginPercent).toBeGreaterThanOrEqual(25);
  });

  it("rounds fractional material cost to cents and calculates margin without channel fees", () => {
    const result = calculatePrintPrice({
      ...sample,
      filamentGrams: 50,
      filamentPricePerKg: 90,
      printHours: 0,
      averagePowerWatts: 0,
      machineCostPerHour: 0,
      depreciationPerHour: 0,
      maintenancePerHour: 0,
      laborMinutes: 0,
      overheadPerUnit: 0,
      failureReservePercent: 0,
      additionalCosts: [],
      targetMarginPercent: 25,
    }, [{ id: "direct", name: "Venda direta", feePercent: 0, fixedFee: 0 }]);

    expect(result.breakdown?.materialCents).toBe(450);
    expect(result.channels[0].priceCents).toBe(600);
  });

  it("prices imported filament colors separately and adds their rounded subtotals", () => {
    const result = calculatePrintPrice({
      ...sample,
      filamentGrams: 20,
      filamentCosts: [{ grams: 12, pricePerKg: 100 }, { grams: 8, pricePerKg: 200 }],
      printHours: 0, averagePowerWatts: 0, machineCostPerHour: 0, depreciationPerHour: 0,
      maintenancePerHour: 0, laborMinutes: 0, overheadPerUnit: 0, failureReservePercent: 0,
      additionalCosts: [], targetMarginPercent: 25,
    }, []);

    expect(result.errors).toEqual([]);
    expect(result.breakdown?.materialCents).toBe(280);
  });

  it("calculates markup over unit cost and finds the smallest cent price per channel", () => {
    const result = calculatePrintPrice({ ...sample, pricingMode: "markup", targetMarkupPercent: 50, targetMarginPercent: 0 }, [
      { id: "direct", name: "Venda direta", feePercent: 0, fixedFee: 0 },
      { id: "marketplace", name: "Marketplace", feePercent: 10, fixedFee: 1 },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.unitCostCents).toBe(6247);
    expect(result.channels.map((channel) => channel.priceCents)).toEqual([9371, 10523]);
    expect(result.channels[0].profitCents).toBe(3124);
    expect(result.channels[1].profitCents).toBe(3124);
    expect(result.channels[1].actualMarginPercent).toBeLessThan(50);
  });

  it("rejects a markup whose price would exceed safe integer precision", () => {
    const result = calculatePrintPrice({ ...sample, pricingMode: "markup", targetMarkupPercent: Number.MAX_VALUE }, [
      { id: "direct", name: "Venda direta", feePercent: 0, fixedFee: 0 },
    ]);

    expect(result.errors).toContain("Os valores excedem o limite seguro do cálculo.");
    expect(result.channels).toEqual([]);
  });

  it("calculates a full production batch once and distributes per-piece and fixed costs correctly", () => {
    const result = calculatePrintPrice({ ...sample, batchQuantity: 4, batchFixedCost: 10 }, [
      { id: "direct", name: "Venda direta", feePercent: 0, fixedFee: 0 },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.breakdown).toMatchObject({
      materialCents: 2000,
      energyCents: 29,
      machineCents: 1200,
      additionalCents: 1000,
      overheadCents: 400,
      batchFixedCents: 1000,
      failureReserveCents: 773,
      totalCostCents: 8502,
    });
    expect(result.unitCostCents).toBe(2126);
    expect(result.channels[0].priceCents).toBe(2835);
  });

  it("adds independent material and printer costs for another component without multiplying run time by piece count", () => {
    const result = calculatePrintPrice({
      ...sample,
      batchQuantity: 4,
      batchFixedCost: 10,
      productionComponents: [{
        name: "Tampa",
        material: "PETG",
        printer: "Impressora B",
        piecesPerProduct: 2,
        filamentGrams: 300,
        filamentPricePerKg: 200,
        printHours: 5,
        averagePowerWatts: 100,
        energyPricePerKwh: 1.5,
        machineCostPerHour: 3,
        depreciationPerHour: 1,
        maintenancePerHour: 0.5,
        laborMinutes: 60,
        laborRatePerHour: 30,
      }],
    }, []);

    expect(result.errors).toEqual([]);
    expect(result.breakdown).toMatchObject({
      materialCents: 8_000,
      energyCents: 104,
      machineCents: 2_700,
      depreciationCents: 1_100,
      maintenanceCents: 550,
      laborCents: 4_200,
      totalCostCents: 20_959,
    });
    expect(result.unitCostCents).toBe(5_240);
  });

  it("accepts a full catalog label for a component material", () => {
    const result = calculatePrintPrice({
      ...sample,
      productionComponents: [{
        name: "Tampa", material: "Material catalogado com nome extenso ".repeat(3), printer: "Impressora A", piecesPerProduct: 1,
        filamentGrams: 0, filamentPricePerKg: 0, printHours: 0, averagePowerWatts: 0, energyPricePerKwh: 0,
        machineCostPerHour: 0, depreciationPerHour: 0, maintenancePerHour: 0, laborMinutes: 0, laborRatePerHour: 0,
      }],
    }, []);

    expect(result.errors).toEqual([]);
  });

  it("rejects negative values and a margin that leaves no room for channel fees", () => {
    expect(calculatePrintPrice({ ...sample, laborMinutes: -1 }, []).errors).toContain("Os custos e quantidades não podem ser negativos.");
    expect(calculatePrintPrice({ ...sample, targetMarginPercent: 90 }, [
      { id: "marketplace", name: "Marketplace", feePercent: 10, fixedFee: 0 },
    ]).errors).toContain("A margem desejada somada às taxas precisa ser menor que 100%.");
  });

  it("requires a positive whole-piece batch quantity", () => {
    expect(calculatePrintPrice({ ...sample, batchQuantity: 1.5 }, []).errors).toContain("A quantidade do lote deve ser um número inteiro entre 1 e 1.000.000.");
    expect(calculatePrintPrice({ ...sample, batchQuantity: 0 }, []).errors).toContain("A quantidade do lote deve ser um número inteiro entre 1 e 1.000.000.");
  });

  it("does not suggest prices before the user enters a production cost", () => {
    const result = calculatePrintPrice({
      ...sample,
      filamentGrams: 0,
      printHours: 0,
      averagePowerWatts: 0,
      machineCostPerHour: 0,
      depreciationPerHour: 0,
      maintenancePerHour: 0,
      laborMinutes: 0,
      overheadPerUnit: 0,
      additionalCosts: [],
      failureReservePercent: 0,
    }, [{ id: "direct", name: "Venda direta", feePercent: 0, fixedFee: 0 }]);
    expect(result.channels[0].priceCents).toBeNull();
  });

  it("returns a validation error when a channel price exceeds safe integer precision", () => {
    const result = calculatePrintPrice({ ...sample, targetMarginPercent: 99.999999999999 }, [
      { id: "direct", name: "Venda direta", feePercent: 0, fixedFee: 0 },
    ]);

    expect(result.errors).toContain("Os valores excedem o limite seguro do cálculo.");
    expect(result.channels).toEqual([]);
  });
});
