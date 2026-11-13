import { describe, expect, it } from "vitest";
import { confirmSlicerOcrCostCurrency, hasReviewableSlicerOcrData, parseSlicerOcrTexts, slicerColorPresentation } from "./slicer-ocr";

describe("parseSlicerOcrTexts", () => {
  it("presents recognized color names safely and keeps hex swatches intact", () => {
    expect(slicerColorPresentation("azul")).toEqual({ label: "azul", cssColor: "blue" });
    expect(slicerColorPresentation("red")).toEqual({ label: "red", cssColor: "red" });
    expect(slicerColorPresentation("#336699")).toEqual({ label: "#336699", cssColor: "#336699" });
    expect(slicerColorPresentation("unknown; color: red")).toEqual({ label: "unknown; color: red", cssColor: null });
    expect(slicerColorPresentation("constructor")?.cssColor).toBeNull();
  });

  it("keeps partial recognized data available for manual review", () => {
    expect(hasReviewableSlicerOcrData(parseSlicerOcrTexts(["Estimated cost: R$ 16,79"]))).toBe(true);
    expect(hasReviewableSlicerOcrData(parseSlicerOcrTexts(["Purge: 3 g\nMaterial: PLA"]))).toBe(true);
    expect(hasReviewableSlicerOcrData(parseSlicerOcrTexts(["OrcaSlicer\nNo readable measurements"]))).toBe(false);
  });

  it("extracts only labeled slicer values and converts Brazilian decimals and time", () => {
    const result = parseSlicerOcrTexts([`OrcaSlicer\nModel: 211,63 g\nSupports: 12,17 g\nTotal filament: 223,80 g\nFilament length: 75,65 m\nPrint time: 13h40\nFilament changes: 1\nMaterial: PLA\nCost: 16,799`]);
    expect(result).toMatchObject({ slicer: "OrcaSlicer", modelGrams: 211.63, supportGrams: 12.17, totalGrams: 223.8, filamentGrams: 223.8, lengthMeters: 75.65, printHours: 13 + 40 / 60, filamentChanges: 1, materials: ["PLA"], estimatedCost: 16.799 });
  });

  it("reads values placed on the line after their labels in slicer summaries", () => {
    const result = parseSlicerOcrTexts(["Anycubic Slicer Next\nModel\n211,63 g\nSupports\n12,17 g\nTotal filament\n223,80 g\nFilament length\n75,65 m\nPrint time\n13h40\nFilament changes\n1\nEstimated cost\nR$ 16,799"]);
    expect(result).toMatchObject({
      slicer: "Anycubic Slicer Next", modelGrams: 211.63, supportGrams: 12.17, totalGrams: 223.8,
      filamentGrams: 223.8, lengthMeters: 75.65, printHours: 13 + 40 / 60, filamentChanges: 1,
      estimatedCost: 16.799, estimatedCostCurrency: "BRL",
    });
  });

  it("recognizes only explicit currency labels for slicer cost", () => {
    expect(parseSlicerOcrTexts(["Estimated cost: R$ 16,79"]).estimatedCost).toBe(16.79);
    expect(parseSlicerOcrTexts(["Estimated cost: R$ 16,79"]).estimatedCostCurrency).toBe("BRL");
    expect(parseSlicerOcrTexts(["Estimated cost: USD 2.30"]).estimatedCost).toBe(2.3);
    expect(parseSlicerOcrTexts(["Estimated cost: USD 2.30"]).estimatedCostCurrency).toBe("USD");
    expect(parseSlicerOcrTexts(["Estimated cost: $2.30"]).estimatedCost).toBe(2.3);
    expect(parseSlicerOcrTexts(["Estimated cost: $2.30"]).estimatedCostCurrency).toBeNull();
    expect(parseSlicerOcrTexts(["Cost: 10 BRL"]).estimatedCost).toBe(10);
  });

  it("requires a currency choice before retaining an unlabelled cost and can discard it", () => {
    const extraction = parseSlicerOcrTexts(["OrcaSlicer\nEstimated cost: 16,79"]);
    expect(confirmSlicerOcrCostCurrency(extraction, "")).toBeNull();
    expect(confirmSlicerOcrCostCurrency(extraction, "BRL")).toMatchObject({ estimatedCost: 16.79, estimatedCostCurrency: "BRL" });
    expect(confirmSlicerOcrCostCurrency(extraction, "ignore")).toMatchObject({ estimatedCost: null, estimatedCostCurrency: null });
    expect(confirmSlicerOcrCostCurrency(extraction, "EUR")).toBeNull();
  });

  it("clears a currency conflict only after the user confirms the cost currency", () => {
    const extraction = parseSlicerOcrTexts(["Cost: 10 BRL", "Cost: 10 USD"]);
    expect(extraction.conflicts).toContain("moeda do custo");
    expect(confirmSlicerOcrCostCurrency(extraction, "USD")?.conflicts).not.toContain("moeda do custo");
  });

  it("preserves full names for the filament and resin products in the technical catalog", () => {
    const names = [
      "PPA-CF", "Prusament PA11 Carbon Fiber", "Prusament PETG Carbon Fiber", "Prusament PC Blend", "PLA+",
      "Prusament TPU 95A", "Anycubic Standard Resin V2", "Anycubic Water-Wash Resin 2.0", "ELEGOO ABS-Like Resin V3.0",
    ];

    for (const name of names) {
      expect(parseSlicerOcrTexts([`Material: ${name}`]).materials).toEqual([name.toUpperCase()]);
    }

    expect(parseSlicerOcrTexts(["Filament 1: Prusament PA11 Carbon Fiber black 12 g"]).filaments[0].material).toBe("PRUSAMENT PA11 CARBON FIBER");
  });

  it("preserves Bambu Lab and Creality catalog material names", () => {
    const names = ["Bambu Lab PLA Basic", "Bambu Lab PPA-CF", "Creality Hyper PLA", "Creality Hyper ABS", "Creality Hyper PETG", "Creality HP ASA", "Creality HP-TPU"];
    for (const name of names) expect(parseSlicerOcrTexts([`Material: ${name}`]).materials).toEqual([name.toUpperCase()]);
  });

  it("leaves currency empty when screenshots disagree", () => {
    const result = parseSlicerOcrTexts(["Cost: R$ 10.00", "Cost: USD 10.00"]);
    expect(result.estimatedCostCurrency).toBeNull();
    expect(result.conflicts).toContain("moeda do custo");
  });

  it("recognizes the slicers used by Creality, ELEGOO, Flashforge, Raise3D, and UltiMaker", () => {
    const names = [
      ["Creality Print 7.3.1", "Creality Print"],
      ["ElegooSlicer", "ElegooSlicer"],
      ["FlashPrint 5", "FlashPrint"],
      ["ideaMaker", "ideaMaker"],
      ["UltiMaker Cura", "UltiMaker Cura"],
    ];

    for (const [text, expected] of names) {
      expect(parseSlicerOcrTexts([text]).slicer).toBe(expected);
    }
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
      { index: 1, grams: 12.5, lengthMeters: null, material: "PLA", color: "red" },
      { index: 2, grams: 8, lengthMeters: null, material: "PETG", color: "azul" },
    ]);
  });

  it("merges per-filament lengths with weights recognized in separate images", () => {
    const result = parseSlicerOcrTexts([
      "Filament 1: PLA red 12,5 g\nFilament 2: PETG blue 8 g",
      "Filament 1 length: 4,8 m\nFilament 2 comprimento: 3200 mm",
    ]);
    expect(result.filaments).toEqual([
      { index: 1, grams: 12.5, lengthMeters: 4.8, material: "PLA", color: "red" },
      { index: 2, grams: 8, lengthMeters: 3.2, material: "PETG", color: "blue" },
    ]);
  });

  it("leaves conflicting per-filament lengths blank", () => {
    const result = parseSlicerOcrTexts(["Filament 1 length: 4 m", "Filament 1 length: 5 m"]);
    expect(result.filaments).toMatchObject([{ index: 1, grams: null, lengthMeters: null }]);
    expect(result.conflicts).toContain("comprimento do filamento 1");
  });

  it("recognizes purge and wipe tower separately without adding either to total filament", () => {
    const result = parseSlicerOcrTexts(["Total filament: 20 g\nPurge: 3,2 g\nWipe tower: 1.1 g"]);
    expect(result).toMatchObject({ totalGrams: 20, filamentGrams: 20, purgeGrams: 3.2, wipeTowerGrams: 1.1 });
  });

  it("does not classify purge tower consumption as both purge and tower", () => {
    const result = parseSlicerOcrTexts(["Purge tower: 2 g"]);
    expect(result.purgeGrams).toBeNull();
    expect(result.wipeTowerGrams).toBe(2);
  });

  it("keeps purge and wipe tower separate from a derived model plus support total", () => {
    expect(parseSlicerOcrTexts(["Model: 10 g\nSupports: 2 g\nPurge: 3 g\nWipe tower: 1 g"]))
      .toMatchObject({ totalGrams: null, filamentGrams: 12, derivedMass: true, purgeGrams: 3, wipeTowerGrams: 1 });
  });
});
