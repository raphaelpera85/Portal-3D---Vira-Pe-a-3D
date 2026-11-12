import { describe, expect, it } from "vitest";
import { parseSlicerOcrTexts } from "./slicer-ocr";

describe("parseSlicerOcrTexts", () => {
  it("extracts only labeled slicer values and converts Brazilian decimals and time", () => {
    const result = parseSlicerOcrTexts([`OrcaSlicer\nModel: 211,63 g\nSupports: 12,17 g\nTotal filament: 223,80 g\nFilament length: 75,65 m\nPrint time: 13h40\nFilament changes: 1\nMaterial: PLA\nCost: 16,799`]);
    expect(result).toMatchObject({ slicer: "OrcaSlicer", modelGrams: 211.63, supportGrams: 12.17, totalGrams: 223.8, filamentGrams: 223.8, lengthMeters: 75.65, printHours: 13 + 40 / 60, filamentChanges: 1, materials: ["PLA"], estimatedCost: 16.799 });
  });

  it("detects conflicting screenshots and leaves missing fields empty", () => {
    const result = parseSlicerOcrTexts(["Total filament: 20 g", "Total filament: 22 g"]);
    expect(result.totalGrams).toBeNull();
    expect(result.filamentGrams).toBeNull();
    expect(result.printHours).toBeNull();
    expect(result.conflicts).toContain("consumo total");
  });

  it("derives only model plus support mass when both were explicitly detected", () => {
    const result = parseSlicerOcrTexts(["Modelo: 10 g\nSuportes: 2 g"]);
    expect(result.filamentGrams).toBe(12);
    expect(result.totalGrams).toBeNull();
    expect(result.derivedMass).toBe(true);
  });

  it("collects per-filament material and color rows without treating them as a new total", () => {
    const result = parseSlicerOcrTexts(["Filament 1: PLA red 12,5 g\nFilamento 2: PETG cor: azul 8 g"]);
    expect(result.totalGrams).toBeNull();
    expect(result.filaments).toEqual([
      { index: 1, grams: 12.5, material: "PLA", color: "red" },
      { index: 2, grams: 8, material: "PETG", color: "azul" },
    ]);
  });
});
