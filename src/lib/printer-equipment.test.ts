import { describe, expect, it } from "vitest";
import { deriveEquipmentRates, validateMaintenanceEntry, validateMakerPrinter } from "./printer-equipment";

const modelId = "89abcdef-1234-4123-8123-123456789abc";

describe("printer equipment validation", () => {
  it("accepts a maker-owned printer linked to a published catalog model", () => {
    expect(validateMakerPrinter({
      nickname: "Bambu da oficina", catalogModelId: modelId, customManufacturer: "", customModel: "",
      purchasedAt: "2025-01-10", purchasePriceBrl: "4500", residualValueBrl: "900", usefulLifeHours: "8000",
      accumulatedHours: "620", installedNozzle: "Aço 0,4 mm", modifications: "AMS lite",
      averagePowerWatts: "92", powerConditions: "PLA, mesa a 55 °C", energyTariffPerKwh: "0.89", status: "available",
    }, "2026-11-11")).toMatchObject({
      catalogModelId: modelId, manufacturer: null, model: null, purchasePriceBrl: 4500,
      residualValueBrl: 900, usefulLifeHours: 8000, accumulatedHours: 620, averagePowerWatts: 92,
      status: "available",
    });
  });

  it("requires either a valid catalog model or a complete custom manufacturer and model", () => {
    const base = { nickname: "Minha máquina", catalogModelId: "", customManufacturer: "", customModel: "", status: "available" };
    expect(validateMakerPrinter(base, "2026-11-11")).toBeNull();
    expect(validateMakerPrinter({ ...base, customManufacturer: "Minha marca", customModel: "M1" }, "2026-11-11"))
      .toMatchObject({ catalogModelId: null, manufacturer: "Minha marca", model: "M1" });
    expect(validateMakerPrinter({ ...base, catalogModelId: "id-inválido", customManufacturer: "X", customModel: "Y" }, "2026-11-11")).toBeNull();
  });

  it("rejects invalid financial relationships and negative operating hours", () => {
    expect(validateMakerPrinter({ nickname: "M1", customManufacturer: "Marca", customModel: "M1", purchasePriceBrl: "1000", residualValueBrl: "1001" }, "2026-11-11")).toBeNull();
    expect(validateMakerPrinter({ nickname: "M1", customManufacturer: "Marca", customModel: "M1", accumulatedHours: "-1" }, "2026-11-11")).toBeNull();
  });

  it("requires measurement conditions when average power is supplied", () => {
    expect(validateMakerPrinter({
      nickname: "M1", customManufacturer: "Marca", customModel: "M1", averagePowerWatts: "92", powerConditions: "", status: "available",
    }, "2026-11-11")).toBeNull();
  });

  it("accepts a dated maintenance event and rejects future dates or negative costs", () => {
    expect(validateMaintenanceEntry({
      performedAt: "2026-10-01", maintenanceType: "nozzle_replacement", component: "Bico 0,4 mm",
      costBrl: "129.90", hoursAtEvent: "620", notes: "Troca preventiva", nextDueAt: "2027-04-01", nextDueHours: "1200",
    }, "2026-11-11")).toEqual({
      performedAt: "2026-10-01", maintenanceType: "nozzle_replacement", component: "Bico 0,4 mm",
      costBrl: 129.9, hoursAtEvent: 620, notes: "Troca preventiva", nextDueAt: "2027-04-01", nextDueHours: 1200,
    });
    expect(validateMaintenanceEntry({ performedAt: "2026-12-01", maintenanceType: "preventive", component: "Bico", costBrl: "-1" }, "2026-11-11")).toBeNull();
    expect(validateMaintenanceEntry({ performedAt: "2026-10-01", maintenanceType: "preventive", component: "Bico", costBrl: "0", nextDueHours: "1200" }, "2026-11-11", 1200)).toBeNull();
  });

  it("accepts component replacement as a maintenance event", () => {
    expect(validateMaintenanceEntry({
      performedAt: "2026-10-01", maintenanceType: "component_replacement", component: "Motor do extrusor", costBrl: "280", hoursAtEvent: "620",
    }, "2026-11-11")).toMatchObject({ maintenanceType: "component_replacement", component: "Motor do extrusor", costBrl: 280 });
  });

  it("derives calculator rates only from values the maker recorded", () => {
    expect(deriveEquipmentRates({
      purchasePriceBrl: "4500.00", residualValueBrl: "900", usefulLifeHours: "8000",
      averagePowerWatts: "92", energyTariffPerKwh: "0.89", maintenanceCostBrl: "320", accumulatedHours: "640",
    })).toEqual({ averagePowerWatts: 92, energyTariffPerKwh: 0.89, depreciationPerHour: 0.45, maintenancePerHour: 0.5 });
    expect(deriveEquipmentRates({ purchasePriceBrl: 4500, residualValueBrl: null, usefulLifeHours: 8000, averagePowerWatts: null, energyTariffPerKwh: null }))
      .toEqual({ averagePowerWatts: null, energyTariffPerKwh: null, depreciationPerHour: null, maintenancePerHour: null });
    expect(deriveEquipmentRates({ maintenanceCostBrl: 320, accumulatedHours: 0 }).maintenancePerHour).toBeNull();
  });
});
