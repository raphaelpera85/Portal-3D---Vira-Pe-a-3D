import { describe, expect, it } from "vitest";
import { mapModelPrintProfileToCalculator, mapPrintProfileToCalculator } from "./calculator-profile";

const profile = {
  name: "PLA bicolor",
  materialName: "PLA fosco",
  quantity: 2,
  printHours: 3.5,
  materialGrams: 24,
  materialByColor: [{ color: "#336699", grams: 20 }, { color: "#FFAA00", grams: 4 }],
};

describe("mapPrintProfileToCalculator", () => {
  it("scales saved model slicer metrics and per-color lengths into the calculator", () => {
    expect(mapModelPrintProfileToCalculator({ name: "PLA detalhado", materialName: "PLA Basic", quantity: 2, metrics: {
      slicer: "OrcaSlicer", modelGrams: 10, supportGrams: 2, totalGrams: 16, purgeGrams: 3, wipeTowerGrams: 1,
      filamentGrams: 16, derivedMass: false, lengthMeters: 4.8, printHours: 1.5, filamentChanges: 1,
      estimatedCost: null, materials: ["PLA Basic"], filaments: [{ index: 1, grams: 16, lengthMeters: 4.8, pricePerKg: null, material: "PLA Basic", color: "#336699" }], conflicts: [],
    } }, 3)).toMatchObject({
      material: "PLA Basic", filamentGrams: 32, printHours: 3,
      slicerMetrics: { slicer: "OrcaSlicer", modelGrams: 20, supportGrams: 4, purgeGrams: 6, wipeTowerGrams: 2, lengthMeters: 9.6, filamentChanges: 2,
        filaments: [{ grams: 32, lengthMeters: 9.6, color: "#336699" }] },
    });
  });
  it("scales profile consumption to enough plates and preserves matching filament prices", () => {
    expect(mapPrintProfileToCalculator(profile, 3, [
      { index: 1, grams: 1, lengthMeters: null, pricePerKg: 99, material: "PLA", color: "#336699" },
    ])).toMatchObject({
      material: "PLA fosco", filamentGrams: 48, printHours: 7,
      slicerMetrics: {
        slicer: "Perfil · PLA bicolor", filamentGrams: 48, printHours: 7,
        filaments: [
          { index: 1, grams: 40, pricePerKg: 99, material: "PLA fosco", color: "#336699" },
          { index: 2, grams: 8, pricePerKg: null, material: "PLA fosco", color: "#FFAA00" },
        ],
      },
    });
  });

  it("adds an unassigned row when the profile total exceeds its color breakdown", () => {
    const result = mapPrintProfileToCalculator({ ...profile, materialByColor: [{ color: "#336699", grams: 20 }] }, 1);
    expect(result?.slicerMetrics.filaments).toHaveLength(2);
    expect(result?.slicerMetrics.filaments[1]).toMatchObject({ grams: 4, color: null, material: "PLA fosco" });
  });

  it("uses the color total when the profile has no overall material weight", () => {
    expect(mapPrintProfileToCalculator({ ...profile, materialGrams: null }, 1)?.filamentGrams).toBe(24);
  });

  it("rejects profiles whose scaled values exceed calculator limits", () => {
    expect(mapPrintProfileToCalculator({ ...profile, materialGrams: 1_000_000 }, 1_000_000)).toBeNull();
  });

  it("rejects profile data where color consumption exceeds the saved total", () => {
    expect(mapPrintProfileToCalculator({ ...profile, materialGrams: 10 }, 1)).toBeNull();
  });
});
