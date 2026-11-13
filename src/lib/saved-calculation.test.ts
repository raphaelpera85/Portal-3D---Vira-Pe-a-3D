import { describe, expect, it } from "vitest";
import { mapThreeMfPlateToSlicerMetrics, validateCalculationToSave } from "./saved-calculation";

const snapshot = {
  input: {
    filamentGrams: 200, filamentPricePerKg: 100, printHours: 3, averagePowerWatts: 120,
    energyPricePerKwh: 0.8, machineCostPerHour: 4, depreciationPerHour: 2,
    maintenancePerHour: 1, laborMinutes: 30, laborRatePerHour: 24, overheadPerUnit: 1,
    failureReservePercent: 10, additionalCosts: [{ name: "Ímãs", amount: 2.5 }], targetMarginPercent: 25,
  },
  channels: [{ id: "marketplace", name: "Marketplace", feePercent: 12, fixedFee: 2 }],
};

describe("mapThreeMfPlateToSlicerMetrics", () => {
  it("uses plate totals when present and derives a total only from complete filament weights", () => {
    expect(mapThreeMfPlateToSlicerMetrics({
      index: 2, weightGrams: null, printTimeSeconds: 5400, supportUsed: true,
      filaments: [
        { color: "ff0000", type: "PLA", weightGrams: 12, lengthMeters: 4 },
        { color: "0000ff", type: "PETG", weightGrams: 8, lengthMeters: 3 },
      ],
    }, 1)).toMatchObject({
      slicer: "Arquivo 3MF · placa 2", filamentGrams: 20, derivedMass: true,
      lengthMeters: 7, printHours: 1.5, materials: ["PLA", "PETG"],
      filaments: [{ index: 1, grams: 12, color: "ff0000" }, { index: 2, grams: 8, color: "0000ff" }],
    });
    expect(mapThreeMfPlateToSlicerMetrics({
      index: 1, weightGrams: 25, printTimeSeconds: null, supportUsed: null,
      filaments: [{ color: null, type: "PLA", weightGrams: 12, lengthMeters: null }, { color: null, type: "PETG", weightGrams: null, lengthMeters: null }],
    }, 1)).toMatchObject({ filamentGrams: 25, derivedMass: false, lengthMeters: null, filaments: [{ grams: 12 }, { grams: null }] });
  });
});

describe("validateCalculationToSave", () => {
  it("recalculates and returns a bounded immutable snapshot", () => {
    const result = validateCalculationToSave("Suporte de mesa", JSON.stringify(snapshot));

    expect(result.error).toBeNull();
    expect(result.calculation?.title).toBe("Suporte de mesa");
    expect(result.calculation?.result.breakdown.totalCostCents).toBeGreaterThan(0);
    expect(result.calculation?.result.channels[0].priceCents).toBeGreaterThan(0);
  });

  it("normalizes legacy channels and preserves validated logistics costs", () => {
    const legacy = validateCalculationToSave("Antigo", JSON.stringify(snapshot));
    const current = validateCalculationToSave("Atual", JSON.stringify({
      ...snapshot,
      channels: [{ ...snapshot.channels[0], logisticsCost: 4.25 }],
    }));

    expect(legacy.calculation?.channels[0].logisticsCost).toBe(0);
    expect(current.calculation?.channels[0].logisticsCost).toBe(4.25);
    expect(validateCalculationToSave("Inválido", JSON.stringify({
      ...snapshot,
      channels: [{ ...snapshot.channels[0], logisticsCost: -1 }],
    })).calculation).toBeNull();
  });

  it("preserves the calculation data source and marks legacy snapshots as unknown", () => {
    const imported = validateCalculationToSave("OCR", JSON.stringify({ ...snapshot, origin: "ocr" }));
    expect(imported.calculation?.origin).toBe("ocr");

    const legacy = validateCalculationToSave("Antigo", JSON.stringify(snapshot));
    expect(legacy.calculation?.origin).toBe("unknown");
    expect(validateCalculationToSave("Inválido", JSON.stringify({ ...snapshot, origin: "external" })).calculation).toBeNull();
  });

  it("preserves the selected catalog material in the saved snapshot", () => {
    const material = "Bambu Lab · PLA Basic (PLA)";
    const result = validateCalculationToSave("Suporte de mesa", JSON.stringify({
      ...snapshot,
      input: { ...snapshot.input, material },
    }));

    expect(result.error).toBeNull();
    expect(result.calculation?.input.material).toBe(material);
    expect(validateCalculationToSave("Suporte de mesa", JSON.stringify({
      ...snapshot,
      input: { ...snapshot.input, material: 5 },
    })).calculation).toBeNull();
  });

  it("preserves validated slicer metrics without storing recognized screenshot text", () => {
    const slicer = {
      slicer: "OrcaSlicer", modelGrams: 10, supportGrams: 2, totalGrams: 15, purgeGrams: 2,
      wipeTowerGrams: 1, filamentGrams: 15, derivedMass: false, lengthMeters: 4.5, printHours: 3,
      filamentChanges: 2, estimatedCost: 7.5, materials: ["PLA"],
      filaments: [{ index: 1, grams: 15, lengthMeters: 4.5, material: "PLA", color: "#ff0000" }], conflicts: [],
      text: "Do not persist screenshot OCR text",
    };
    const result = validateCalculationToSave("Suporte de mesa", JSON.stringify({ ...snapshot, slicer }));
    expect(result.error).toBeNull();
    expect(result.calculation?.slicer).toMatchObject({ slicer: "OrcaSlicer", purgeGrams: 2, wipeTowerGrams: 1, filaments: slicer.filaments });
    expect(JSON.stringify(result.calculation?.slicer)).not.toContain("screenshot OCR text");
    const legacy = validateCalculationToSave("Cálculo antigo", JSON.stringify({ ...snapshot, slicer: { ...slicer, filaments: [{ index: 1, grams: 15, material: "PLA", color: "#ff0000" }] } }));
    expect(legacy.calculation?.slicer?.filaments[0].lengthMeters).toBeNull();
    expect(validateCalculationToSave("Teste", JSON.stringify({ ...snapshot, slicer: { ...slicer, filaments: Array(33).fill(slicer.filaments[0]) } })).calculation).toBeNull();
  });

  it("preserves recognized cost currency and rejects unsupported currency codes", () => {
    const slicer = {
      slicer: "OrcaSlicer", modelGrams: null, supportGrams: null, totalGrams: null, purgeGrams: null,
      wipeTowerGrams: null, filamentGrams: 15, derivedMass: false, lengthMeters: null, printHours: null,
      filamentChanges: null, estimatedCost: 2.3, estimatedCostCurrency: "USD", materials: [], filaments: [], conflicts: [],
    };
    const result = validateCalculationToSave("Suporte de mesa", JSON.stringify({ ...snapshot, slicer }));

    expect(result.calculation?.slicer?.estimatedCostCurrency).toBe("USD");
    const legacySlicer = { ...slicer, estimatedCostCurrency: undefined };
    expect(validateCalculationToSave("Antigo", JSON.stringify({ ...snapshot, slicer: legacySlicer })).calculation?.slicer?.estimatedCostCurrency).toBeNull();
    expect(validateCalculationToSave("Inválido", JSON.stringify({ ...snapshot, slicer: { ...slicer, estimatedCostCurrency: "EUR" } })).calculation).toBeNull();
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

  it("validates and recalculates markup snapshots while keeping older snapshots in margin mode", () => {
    const markup = validateCalculationToSave("Suporte de mesa", JSON.stringify({
      ...snapshot,
      input: { ...snapshot.input, pricingMode: "markup", targetMarkupPercent: 50 },
    }));
    const older = validateCalculationToSave("Suporte de mesa", JSON.stringify(snapshot));

    expect(markup.error).toBeNull();
    expect(markup.calculation?.input).toMatchObject({ pricingMode: "markup", targetMarkupPercent: 50 });
    expect(markup.calculation?.result.channels[0].profitCents).toBeGreaterThan(0);
    expect(older.calculation?.input).toMatchObject({ pricingMode: "margin", targetMarkupPercent: 0 });
    expect(validateCalculationToSave("Suporte", JSON.stringify({
      ...snapshot,
      input: { ...snapshot.input, pricingMode: "unknown", targetMarkupPercent: 50 },
    })).calculation).toBeNull();
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
