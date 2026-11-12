import { describe, expect, it } from "vitest";
import { evaluateCompatibility } from "./compatibility";
import { mapTechnicalCatalog } from "./technical-catalog-data";

describe("mapTechnicalCatalog", () => {
  it("maps published records and only treats an explicit relation as verified", () => {
    const catalog = mapTechnicalCatalog(
      [{ id: "printer-1", manufacturer: "Maker", model: "M1", variant: "Combo", technology: "FDM", build_volume_x_mm: 180, build_volume_y_mm: 180, build_volume_z_mm: 180, filament_diameter_mm: "1.75", max_nozzle_temperature_c: 260, max_bed_temperature_c: 100, heated_bed: true, source_url: "https://example.com/printer", verified_at: "2026-01-01" }],
      [{ id: "material-1", manufacturer: "Maker", product: "PLA", family: "PLA", process: "filament", filament_diameter_mm: 1.75, nozzle_temperature_min_c: 190, nozzle_temperature_max_c: 220, source_url: "https://example.com/material", verified_at: "2026-01-01" }],
      [{ id: "nozzle-1", manufacturer: "Maker", model: "M1 nozzle", diameter_mm: 0.4, original: true, catalog_status: "published", source_url: "https://example.com/nozzle", verified_at: "2026-01-01" }],
      [{ printer_id: "printer-1", material_id: "material-1", compatibility: "compatible" }],
      [{ printer_id: "printer-1", nozzle_id: "nozzle-1", fit: "compatible" }],
    );

    expect(catalog.printers[0].supportedMaterials.PLA).toBe("compatible");
    expect(catalog.nozzles[0].original).toBe(true);
    expect(catalog.printers[0].sources[0].url).toBe("https://example.com/printer");
    expect(evaluateCompatibility(catalog.printers[0], catalog.materials[0], catalog.nozzles[0]).status).toBe("compatible");
  });

  it("does not turn a missing compatibility row into a negative result", () => {
    const catalog = mapTechnicalCatalog(
      [{ id: "printer-1", manufacturer: "Maker", model: "M1", variant: "standard", technology: "FDM", filament_diameter_mm: 1.75 }],
      [{ id: "material-1", manufacturer: "Maker", product: "PLA", family: "PLA", process: "filament", filament_diameter_mm: 1.75 }],
      [{ id: "nozzle-1", manufacturer: "Maker", model: "M1 nozzle", diameter_mm: 0.4 }], [], [],
    );

    const result = evaluateCompatibility(catalog.printers[0], catalog.materials[0], catalog.nozzles[0]);
    expect(result.checks.find((check) => check.key === "material")?.status).toBe("unverified");
    expect(result.checks.find((check) => check.key === "nozzle-fit")?.status).toBe("unverified");
  });
});
