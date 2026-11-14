import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModelPrintProfileManager } from "./model-print-profile-manager";
import type { SavedSlicerMetrics } from "@/lib/saved-calculation";

describe("ModelPrintProfileManager", () => {
  it("keeps color and material rows with no measured consumption when editing a profile", () => {
    const slicerMetrics: SavedSlicerMetrics = {
      slicer: "OrcaSlicer", modelGrams: null, supportGrams: null, totalGrams: null,
      purgeGrams: null, wipeTowerGrams: null, filamentGrams: null, derivedMass: false,
      lengthMeters: null, printHours: null, filamentChanges: null, estimatedCost: null,
      materials: ["PLA Basic", "PETG"], conflicts: [],
      filaments: [
        { index: 3, grams: null, lengthMeters: null, pricePerKg: null, material: "PLA Basic", color: "#336699" },
        { index: 4, grams: null, lengthMeters: null, pricePerKg: null, material: "PETG", color: "azul" },
      ],
    };
    const markup = renderToStaticMarkup(<ModelPrintProfileManager
      modelSlug="70bda315e46e" authenticated canUseOcr ocrConfigured notice={null} plates={[]}
      profiles={[{
        id: "123e4567-e89b-42d3-a456-426614174000", profile_name: "PLA", profile_type: "custom", slicer: "OrcaSlicer",
        printer_snapshot: "Printer", material_snapshot: "PLA Basic", nozzle_snapshot: "0.4 mm",
        layer_height_mm: null, infill_percent: null, wall_count: null, supports: false, orientation: "", scale_percent: 100,
        quantity: 1, slicer_metrics: slicerMetrics, created_at: "2026-11-13T00:00:00Z", sharing_scope: "private",
        review_status: "draft", review_note: null, isOwner: true,
      }]}
    />);

    expect(markup).toContain("#336699; PLA Basic; ; ; 3");
    expect(markup).toContain("azul; PETG; ; ; 4");
    expect(markup).toContain("Ler imagem do fatiador");
    expect(markup).toContain("o custo estimado mostrado pelo fatiador não é salvo como preço de material");
  });
});
