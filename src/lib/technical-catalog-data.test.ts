import { describe, expect, it } from "vitest";
import { evaluateBuildVolume, evaluateCompatibility } from "./compatibility";
import { mapTechnicalCatalog, mergeTechnicalCatalogWithFallback } from "./technical-catalog-data";
import { materials, nozzles, printers } from "./technical-catalog";

describe("mapTechnicalCatalog", () => {
  it("keeps Sovol M1D variants, pre-order status and mode-specific volumes explicit", () => {
    const m1d = printers.filter((printer) => printer.model === "M1D");
    expect(m1d.map(({ variant, commercialStatus, enclosure }) => ({ variant, commercialStatus, enclosure }))).toEqual([
      { variant: "Essential", commercialStatus: "announced", enclosure: false },
      { variant: "Advanced", commercialStatus: "announced", enclosure: true },
    ]);
    expect(m1d[0].buildVolumeMm).toBeNull();
    expect(evaluateBuildVolume(m1d[0].buildVolumeMm, { x: 250, y: 250, z: 250 }).status).toBe("unverified");
    expect(m1d[0].technicalProperties).toMatchObject({
      toolheadCount: 7,
      activeChamberHeatingIncluded: false,
      toolheadModes: [
        { mode: "fixed toolhead or right-side toolhead switching", dimensionsMm: { x: 300, y: 300, z: 350 } },
        { mode: "seven-toolhead printing", dimensionsMm: { x: 240, y: 300, z: 350 } },
        { mode: "copy", dimensionsMm: { x: 178, y: 300, z: 350 }, simultaneousParts: 2 },
        { mode: "mirror", dimensionsMm: { x: 138, y: 300, z: 350 }, simultaneousParts: 2 },
      ],
    });
    expect(m1d[1].technicalProperties).toMatchObject({ activeChamberMaximumTemperatureC: 60, activeChamberHeatingIncluded: true });
    expect(nozzles.filter((nozzle) => nozzle.id.startsWith("sovol-m1d-")).map(({ diameterMm, material, original }) => ({ diameterMm, material, original }))).toEqual([
      { diameterMm: 0.4, material: "Aço endurecido", original: true },
      { diameterMm: 0.6, material: null, original: false },
      { diameterMm: 0.8, material: null, original: false },
    ]);
  });

  it("deduplicates database catalog records by natural identity and remaps compatibility links", () => {
    const fallbackPrinter = printers.find((printer) => printer.id === "prusa-mk4s")!;
    const fallbackNozzle = nozzles.find((nozzle) => nozzle.id === "prusa-mk4s-hardened-0.4")!;
    const fallbackMaterial = materials.find((material) => material.id === "prusament-pla")!;
    const database = {
      printers: [{ ...fallbackPrinter, id: "db-printer", name: "MK4S cadastrada", supportedMaterials: { "db-material": { status: "conditional" as const, conditions: "Banco" } } }],
      materials: [{ ...fallbackMaterial, id: "db-material" }],
      nozzles: [{ ...fallbackNozzle, id: "db-nozzle", printerCompatibility: { "db-printer": "compatible" as const } }],
    };

    const catalog = mergeTechnicalCatalogWithFallback(database, { printers, materials, nozzles });

    expect(catalog.printers.filter((printer) => printer.brand === fallbackPrinter.brand && printer.model === fallbackPrinter.model && printer.variant === fallbackPrinter.variant)).toHaveLength(1);
    expect(catalog.printers.find((printer) => printer.id === "db-printer")?.name).toBe("MK4S cadastrada");
    expect(catalog.printers.find((printer) => printer.id === "db-printer")?.supportedMaterials["db-material"])
      .toEqual({ status: "conditional", conditions: "Banco" });
    expect(catalog.printers.some((printer) => printer.id === "bambu-a1")).toBe(true);
    expect(catalog.materials.filter((material) => material.brand === fallbackMaterial.brand && material.name === fallbackMaterial.name)).toHaveLength(1);
    expect(catalog.nozzles.filter((nozzle) => nozzle.brand === fallbackNozzle.brand && nozzle.name === fallbackNozzle.name && nozzle.diameterMm === fallbackNozzle.diameterMm)).toHaveLength(1);
    expect(catalog.nozzles.find((nozzle) => nozzle.id === "db-nozzle")?.printerCompatibility)
      .toEqual({ "db-printer": "compatible", "prusa-core-one-l-plus": "compatible" });
  });

  it("keeps separate records when the database does not provide natural identity fields", () => {
    const printer = printers[0];
    const material = materials[0];
    const nozzle = nozzles[0];
    const catalog = mergeTechnicalCatalogWithFallback({
      printers: [
        { ...printer, id: "db-printer-1", brand: "", model: "" },
        { ...printer, id: "db-printer-2", brand: "", model: "" },
      ],
      materials: [
        { ...material, id: "db-material-1", brand: "", name: "" },
        { ...material, id: "db-material-2", brand: "", name: "" },
      ],
      nozzles: [
        { ...nozzle, id: "db-nozzle-1", brand: "", name: "", diameterMm: 0 },
        { ...nozzle, id: "db-nozzle-2", brand: "", name: "", diameterMm: 0 },
      ],
    }, { printers: [], materials: [], nozzles: [] });

    expect(catalog.printers.map(({ id }) => id)).toEqual(["db-printer-1", "db-printer-2"]);
    expect(catalog.materials.map(({ id }) => id)).toEqual(["db-material-1", "db-material-2"]);
    expect(catalog.nozzles.map(({ id }) => id)).toEqual(["db-nozzle-1", "db-nozzle-2"]);
  });

  it("preserves manufacturer resin ranges, colors and printer-specific exposure settings", () => {
    const catalog = mapTechnicalCatalog([], [{
      id: "resin-1", manufacturer: "Anycubic", product: "Standard Resin V2", family: "standard resin", process: "resin",
      density_g_cm3: null, colors: [{ name: "Clear", hex: null }, { name: "Blue", hex: "#00A3E0" }],
      technical_properties: {
        densityGPerCm3: { min: 1.05, max: 1.25 },
        viscosityMpas: { min: 250, max: 350, temperatureC: 25 },
        wavelengthNm: { min: 365, max: 405 },
        firstLayerExposureSeconds: { min: 20, max: 40 },
        normalExposureSeconds: { min: 2.5, max: 3 },
        washingMethods: ["water", "IPA"],
        washingDurationMinutes: { min: 3 },
        postCureMinutes: 3,
        safetyNotes: "Use luvas e óculos.",
        wasteDisposal: "Cure resíduos antes do descarte.",
        exposureByPrinter: [{ printer: "Photon P1", layerHeightMm: 0.05, normalExposureSeconds: 2, bottomExposureSeconds: 20 }],
      }, source_url: "https://example.com/resin", verified_at: "2026-11-12",
    }], [], [], []);

    expect(catalog.materials[0]).toMatchObject({
      densityGPerCm3: null,
      colors: [{ name: "Clear", hex: null }, { name: "Blue", hex: "#00A3E0" }],
      technicalProperties: {
        densityGPerCm3: { min: 1.05, max: 1.25 },
        wavelengthNm: { min: 365, max: 405 },
        washingMethods: ["water", "IPA"],
        washingDurationMinutes: { min: 3 },
        postCureMinutes: 3,
        safetyNotes: "Use luvas e óculos.",
        wasteDisposal: "Cure resíduos antes do descarte.",
        exposureByPrinter: [{ printer: "Photon P1", normalExposureSeconds: 2 }],
      },
    });
  });

  it("maps published records and only treats an explicit relation as verified", () => {
    const catalog = mapTechnicalCatalog(
      [{ id: "printer-1", manufacturer: "Maker", model: "M1", variant: "Combo", technology: "FDM", build_volume_x_mm: 180, build_volume_y_mm: 180, build_volume_z_mm: 180, filament_diameter_mm: "1.75", max_nozzle_temperature_c: 260, max_bed_temperature_c: 100, heated_bed: true, source_url: "https://example.com/printer", verified_at: "2026-01-01" }],
      [{ id: "material-1", manufacturer: "Maker", product: "PLA", family: "PLA", process: "filament", filament_diameter_mm: 1.75, nozzle_temperature_min_c: 190, nozzle_temperature_max_c: 220, source_url: "https://example.com/material", verified_at: "2026-01-01" }],
      [{ id: "nozzle-1", manufacturer: "Maker", model: "M1 nozzle", diameter_mm: 0.4, original: true, catalog_status: "published", source_url: "https://example.com/nozzle", verified_at: "2026-01-01" }],
      [{ printer_id: "printer-1", material_id: "material-1", compatibility: "compatible" }],
      [{ printer_id: "printer-1", nozzle_id: "nozzle-1", fit: "compatible", conditions: "Não usar TPU 95A pelo IFS." }],
    );

    expect(catalog.printers[0].supportedMaterials["material-1"]).toEqual({ status: "compatible", conditions: null });
    expect(catalog.nozzles[0].original).toBe(true);
    expect(catalog.nozzles[0].printerCompatibilityConditions).toEqual({ "printer-1": "Não usar TPU 95A pelo IFS." });
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

  it("keeps same-family material relations product-specific and shows manufacturer conditions", () => {
    const catalog = mapTechnicalCatalog(
      [{ id: "printer-1", manufacturer: "Maker", model: "M1", variant: "standard", technology: "FDM", filament_diameter_mm: 1.75 }],
      [
        { id: "pla-a", manufacturer: "Maker", product: "PLA A", family: "PLA", process: "filament", filament_diameter_mm: 1.75 },
        { id: "pla-b", manufacturer: "Maker", product: "PLA B", family: "PLA", process: "filament", filament_diameter_mm: 1.75 },
      ], [], [
        { printer_id: "printer-1", material_id: "pla-a", compatibility: "compatible", conditions: "Camada 0,05 mm; exposição 2 s." },
        { printer_id: "printer-1", material_id: "pla-b", compatibility: "incompatible", conditions: "Não usar com este cabeçote." },
      ], [],
    );

    const supportCheck = (materialIndex: number) => evaluateCompatibility(catalog.printers[0], catalog.materials[materialIndex]).checks.find((check) => check.key === "material");
    expect(supportCheck(0)).toMatchObject({ status: "compatible", detail: expect.stringContaining("exposição 2 s") });
    expect(supportCheck(1)).toMatchObject({ status: "incompatible", detail: expect.stringContaining("Não usar") });
  });
});
