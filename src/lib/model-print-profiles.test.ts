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
  it("defaults to private profiles and accepts community submissions", () => {
    expect(validateModelPrintProfile(input)?.sharingScope).toBe("private");
    expect(validateModelPrintProfile({ ...input, sharingScope: "community" })?.sharingScope).toBe("community");
    expect(validateModelPrintProfile({ ...input, sharingScope: "official" })).toBeNull();
  });

  it("accepts every slicer recognized by the OCR for saved model profiles", () => {
    const slicers = ["Anycubic Slicer Next", "OrcaSlicer", "Bambu Studio", "PrusaSlicer", "Creality Print", "ElegooSlicer", "FlashPrint", "ideaMaker", "UltiMaker Cura", "Cura", "Simplify3D"];
    for (const slicer of slicers) expect(validateModelPrintProfile({ ...input, slicer })?.slicer).toBe(slicer);
  });

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

  it("accepts up to 32 filament entries in manual profiles", () => {
    const filamentLines = Array.from({ length: 13 }, (_, index) => `#${index.toString(16).padStart(6, "0")}; PLA; 1; 0,3`).join("\n");
    expect(validateModelPrintProfile({ ...input, filamentGrams: "20", filamentLines })?.metrics.filaments).toHaveLength(13);
  });

  it("accepts imported 3MF slicer metrics after validating the payload", () => {
    const slicerMetrics = {
      slicer: "Arquivo 3MF · placa 1", modelGrams: null, supportGrams: null, totalGrams: 8,
      purgeGrams: null, wipeTowerGrams: null, filamentGrams: 8, derivedMass: false, lengthMeters: 2.4,
      printHours: 0.5, filamentChanges: null, estimatedCost: null, materials: ["PLA"],
      filaments: [{ index: 1, grams: 8, lengthMeters: 2.4, pricePerKg: null, material: "PLA", color: "#336699" }], conflicts: [],
    };
    expect(validateModelPrintProfile({ ...input, manualOverrideFields: "", importedMetrics: JSON.stringify(slicerMetrics) })?.metrics).toEqual(slicerMetrics);
    expect(validateModelPrintProfile({ ...input, importedMetrics: JSON.stringify({ ...slicerMetrics, filamentGrams: -8 }) })).toBeNull();
    expect(validateModelPrintProfile({ ...input, importedMetrics: JSON.stringify({ ...slicerMetrics, filamentChanges: 1.5 }) })).toBeNull();
    expect(validateModelPrintProfile({ ...input, importedMetrics: JSON.stringify({ ...slicerMetrics, estimatedCost: 12 }) })).toBeNull();
    expect(validateModelPrintProfile({ ...input, importedMetrics: JSON.stringify({ ...slicerMetrics, estimatedCostCurrency: "USD" }) })).toBeNull();
  });

  it("accepts imported 3MF metrics with up to 32 filaments", () => {
    const filaments = Array.from({ length: 13 }, (_, index) => ({
      index: index + 1, grams: 1, lengthMeters: 0.3, pricePerKg: null, material: "PLA", color: `#${index.toString(16).padStart(6, "0")}`,
    }));
    const importedMetrics = {
      slicer: "Arquivo 3MF · placa 1", modelGrams: null, supportGrams: null, totalGrams: 13,
      purgeGrams: null, wipeTowerGrams: null, filamentGrams: 13, derivedMass: false, lengthMeters: 3.9,
      printHours: 0.5, filamentChanges: null, estimatedCost: null, materials: ["PLA"], filaments, conflicts: [],
    };
    expect(validateModelPrintProfile({ ...input, manualOverrideFields: "", importedMetrics: JSON.stringify(importedMetrics) })?.metrics.filaments).toHaveLength(13);
  });

  it("lets manual metrics and per-color consumption override imported 3MF values", () => {
    const importedMetrics = {
      slicer: "Arquivo 3MF · placa 1", modelGrams: null, supportGrams: null, totalGrams: 8,
      purgeGrams: null, wipeTowerGrams: null, filamentGrams: 8, derivedMass: false, lengthMeters: 2.4,
      printHours: 0.5, filamentChanges: null, estimatedCost: null, materials: ["PLA"],
      filaments: [{ index: 1, grams: 8, lengthMeters: 2.4, pricePerKg: null, material: "PLA", color: "#336699" }], conflicts: [],
    };
    const result = validateModelPrintProfile({
      ...input, modelGrams: "6", filamentGrams: "10", filamentLines: "#FFAA00; PETG; 10; 3",
      manualOverrideFields: "modelGrams,filamentGrams,filamentLines",
      importedMetrics: JSON.stringify(importedMetrics),
    });
    expect(result?.metrics).toMatchObject({ modelGrams: 6, filamentGrams: 10, filaments: [{ index: 1, grams: 10, material: "PETG", color: "#FFAA00" }] });
  });

  it("preserves sparse 3MF filament slot ids when editing a model profile", () => {
    const result = validateModelPrintProfile({
      ...input, filamentGrams: "222.17",
      filamentLines: "#000000; PLA; 3.08; 1.02; 1\n#00AE42; PLA; 219.09; 72.29; 3",
      manualOverrideFields: "filamentLines",
      importedMetrics: JSON.stringify({
        slicer: "Arquivo 3MF · placa 1", modelGrams: null, supportGrams: null, totalGrams: 222.17,
        purgeGrams: null, wipeTowerGrams: null, filamentGrams: 222.17, derivedMass: false, lengthMeters: 73.31,
        printHours: null, filamentChanges: null, estimatedCost: null, materials: ["PLA"],
        filaments: [
          { index: 1, grams: 3.08, lengthMeters: 1.02, pricePerKg: null, material: "PLA", color: "#000000" },
          { index: 3, grams: 219.09, lengthMeters: 72.29, pricePerKg: null, material: "PLA", color: "#00AE42" },
        ], conflicts: [],
      }),
    });
    expect(result?.metrics.filaments.map(({ index }) => index)).toEqual([1, 3]);
  });

  it("rejects duplicate filament slot ids in manual profile data", () => {
    expect(validateModelPrintProfile({ ...input, filamentLines: "#000000; PLA; 3; 1; 3\n#00AE42; PLA; 5; 2; 3" })).toBeNull();
  });

  it("preserves zero-based filament slot ids when present", () => {
    expect(validateModelPrintProfile({ ...input, filamentLines: "; PLA; 2; 1; 0" })?.metrics.filaments).toMatchObject([{ index: 0 }]);
  });
});
