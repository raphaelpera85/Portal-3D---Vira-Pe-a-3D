import { describe, expect, it } from "vitest";
import { validateCalculationToSave } from "./saved-calculation";

const snapshot = {
  input: {
    filamentGrams: 200, filamentPricePerKg: 100, printHours: 3, averagePowerWatts: 120,
    energyPricePerKwh: 0.8, machineCostPerHour: 4, depreciationPerHour: 2,
    maintenancePerHour: 1, laborMinutes: 30, laborRatePerHour: 24, overheadPerUnit: 1,
    failureReservePercent: 10, additionalCosts: [{ name: "Ímãs", amount: 2.5 }], targetMarginPercent: 25,
  },
  channels: [{ id: "marketplace", name: "Marketplace", feePercent: 12, fixedFee: 2 }],
};

describe("validateCalculationToSave", () => {
  it("recalculates and returns a bounded immutable snapshot", () => {
    const result = validateCalculationToSave("Suporte de mesa", JSON.stringify(snapshot));

    expect(result.error).toBeNull();
    expect(result.calculation?.title).toBe("Suporte de mesa");
    expect(result.calculation?.result.breakdown.totalCostCents).toBeGreaterThan(0);
    expect(result.calculation?.result.channels[0].priceCents).toBeGreaterThan(0);
  });

  it("keeps optional product and equipment associations and rejects malformed IDs", () => {
    const productId = "89abcdef-1234-4123-8123-123456789abc";
    const printerId = "76543210-abcd-4123-8123-abcdef123456";
    const profileId = "76543210-abcd-4123-8123-abcdef123456";
    expect(validateCalculationToSave("Suporte de mesa", JSON.stringify(snapshot), productId, printerId, profileId).calculation).toMatchObject({ productId, printerId, profileId });
    expect(validateCalculationToSave("Suporte de mesa", JSON.stringify(snapshot), "not-a-uuid").calculation).toBeNull();
    expect(validateCalculationToSave("Suporte de mesa", JSON.stringify(snapshot), null, "not-a-uuid").calculation).toBeNull();
    expect(validateCalculationToSave("Suporte de mesa", JSON.stringify(snapshot), null, null, "not-a-uuid").calculation).toBeNull();
    expect(validateCalculationToSave("Suporte de mesa", JSON.stringify(snapshot)).calculation?.productId).toBeNull();
  });

  it("keeps older single-piece snapshots as one-piece batches", () => {
    const result = validateCalculationToSave("Suporte de mesa", JSON.stringify(snapshot));
    expect(result.calculation?.input.batchQuantity).toBe(1);
    expect(result.calculation?.input.batchFixedCost).toBe(0);
    expect(result.calculation?.result.unitCostCents).toBe(result.calculation?.result.breakdown.totalCostCents);
  });

  it("validates and recalculates saved component runs", () => {
    const component = {
      name: "Tampa", material: "PETG", printer: "Impressora B", piecesPerProduct: 2,
      filamentGrams: 300, filamentPricePerKg: 200, printHours: 5, averagePowerWatts: 100,
      energyPricePerKwh: 1.5, machineCostPerHour: 3, depreciationPerHour: 1,
      maintenancePerHour: 0.5, laborMinutes: 60, laborRatePerHour: 30,
    };
    const result = validateCalculationToSave("Conjunto", JSON.stringify({
      ...snapshot,
      input: { ...snapshot.input, batchQuantity: 4, batchFixedCost: 10, productionComponents: [component] },
    }));

    expect(result.error).toBeNull();
    expect(result.calculation?.input.productionComponents).toEqual([component]);
    expect(result.calculation?.result.breakdown.totalCostCents).toBe(20_959);
    expect(validateCalculationToSave("Conjunto", JSON.stringify({
      ...snapshot,
      input: { ...snapshot.input, productionComponents: [{ ...component, piecesPerProduct: 1.5 }] },
    })).calculation).toBeNull();
  });

  it("rejects malformed, oversized, and incomplete calculations", () => {
    expect(validateCalculationToSave("Teste", "{" ).calculation).toBeNull();
    expect(validateCalculationToSave("Teste", "x".repeat(24_001)).calculation).toBeNull();
    expect(validateCalculationToSave("", JSON.stringify(snapshot)).calculation).toBeNull();
    expect(validateCalculationToSave("Teste", JSON.stringify({ ...snapshot, input: { ...snapshot.input, filamentGrams: -1 } })).calculation).toBeNull();
  });
});
