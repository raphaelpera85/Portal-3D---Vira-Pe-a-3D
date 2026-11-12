import { describe, expect, it } from "vitest";
import { validateModelPrintProfile } from "./model-print-profiles";

const input = {
  modelSlug: "70bda315e46e",
  name: "PLA 0.20 mm",
  profileType: "detailed",
  slicer: "OrcaSlicer",
  printerName: "Bambu Lab A1",
  materialName: "PLA Basic",
  nozzleName: "0.4 mm",
  layerHeightMm: "0,20",
  infillPercent: "15",
  wallCount: "3",
  supports: "false",
  orientation: "Deitado",
  scalePercent: "100",
  quantity: "1",
  modelGrams: "12",
  supportGrams: "2",
  totalGrams: "18",
  purgeGrams: "3",
  wipeTowerGrams: "1",
  filamentGrams: "18",
  lengthMeters: "5,4",
  printHours: "0,75",
  filamentChanges: "1",
  filamentLines: "#336699; PLA Basic; 18; 5,4",
};

describe("validateModelPrintProfile", () => {
  it("normalizes a manually entered per-color print profile", () => {
    expect(validateModelPrintProfile(input)).toMatchObject({
      modelSlug: "70bda315e46e", name: "PLA 0.20 mm", quantity: 1,
      metrics: {
        totalGrams: 18, purgeGrams: 3, wipeTowerGrams: 1, filamentGrams: 18,
        printHours: 0.75, filaments: [{ index: 1, color: "#336699", material: "PLA Basic", grams: 18, lengthMeters: 5.4 }],
      },
    });
  });

  it("rejects duplicate colors and color totals above total filament use", () => {
    expect(validateModelPrintProfile({ ...input, filamentLines: "#336699; PLA; 10; 2\n#336699; PETG; 10; 2" })).toBeNull();
    expect(validateModelPrintProfile({ ...input, totalGrams: "10", filamentGrams: "10", filamentLines: "#336699; PLA; 11; 2" })).toBeNull();
  });

  it("accepts imported 3MF slicer metrics after validating the payload", () => {
    const slicerMetrics = {
      slicer: "Arquivo 3MF · placa 1", modelGrams: null, supportGrams: null, totalGrams: 8,
      purgeGrams: null, wipeTowerGrams: null, filamentGrams: 8, derivedMass: false, lengthMeters: 2.4,
      printHours: 0.5, filamentChanges: null, estimatedCost: null, materials: ["PLA"],
      filaments: [{ index: 1, grams: 8, lengthMeters: 2.4, pricePerKg: null, material: "PLA", color: "#336699" }], conflicts: [],
    };
    expect(validateModelPrintProfile({ ...input, importedMetrics: JSON.stringify(slicerMetrics) })?.metrics).toEqual(slicerMetrics);
    expect(validateModelPrintProfile({ ...input, importedMetrics: JSON.stringify({ ...slicerMetrics, filamentGrams: -8 }) })).toBeNull();
    expect(validateModelPrintProfile({ ...input, importedMetrics: JSON.stringify({ ...slicerMetrics, filamentChanges: 1.5 }) })).toBeNull();
    expect(validateModelPrintProfile({ ...input, importedMetrics: JSON.stringify({ ...slicerMetrics, estimatedCost: 12 }) })).toBeNull();
  });
});
