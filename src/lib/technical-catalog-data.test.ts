import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { evaluateBuildVolume, evaluateCompatibility } from "./compatibility";
import { getBuildVolumeModes, mapTechnicalCatalog, mergeTechnicalCatalogWithFallback } from "./technical-catalog-data";
import { materials, nozzles, printers } from "./technical-catalog";

const profileHash = (profiles: unknown) => {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
    : value;
  return createHash("sha256").update(JSON.stringify(canonical(profiles) ?? null)).digest("hex");
};

describe("mapTechnicalCatalog", () => {
  it("maps the stored printer launch year into the public catalog data", () => {
    expect(mapTechnicalCatalog([{
      id: "printer", manufacturer: "Creality", model: "K1 Max", variant: "2024", model_year: 2024, technology: "FDM",
    }], [], [], [], []).printers[0].modelYear).toBe(2024);
  });

  it("keeps Raise3D Pro3 Plus HS available in the local fallback with both build modes", () => {
    const printer = printers.find((entry) => entry.id === "raise3d-pro3-plus-hs");

    expect(printer).toMatchObject({
      brand: "Raise3D", model: "Pro3 Plus HS", variant: "standard", extruders: 2,
      buildVolumeDescription: "300 × 300 × 605 mm (extrusão simples) · 255 × 300 × 605 mm (dupla)",
      technicalProperties: {
        singleExtrusionVolumeMm: { x: 300, y: 300, z: 605 },
        dualExtrusionVolumeMm: { x: 255, y: 300, z: 605 },
      },
    });
    expect(getBuildVolumeModes(printer!.technicalProperties!)).toHaveLength(2);
  });

  it("includes Formlabs Form 4L with its official resin build volume and resolution data", () => {
    const form4L = printers.find((printer) => printer.id === "formlabs-form-4l");

    expect(form4L).toMatchObject({
      brand: "Formlabs", technology: "MSLA", buildVolumeMm: { x: 353, y: 196, z: 350 },
      technicalProperties: { openMaterialMode: true, layerThicknessRangeMicrons: { min: 25, max: 200 } },
    });
    expect(form4L?.sources.map((source) => source.url)).toContain("https://formlabs.com/products/form-4l-basic-package/");
  });

  it("includes the Phrozen Revo 16K official wavelength without inferring resin exposure", () => {
    const phrozen = printers.find((printer) => printer.id === "phrozen-sonic-mighty-revo-16k");

    expect(phrozen).toMatchObject({
      technology: "MSLA", buildVolumeMm: { x: 211.68, y: 118.37, z: 235 },
      technicalProperties: { resolution: "16K", pixelSizeMicrons: "14 × 19", wavelengthNm: 405 },
    });
    expect(phrozen?.sources.map((source) => source.url)).toContain("https://us.phrozen3d.com/products/sonic-mighty-16k-printer");
    expect(phrozen?.supportedMaterials).toEqual({});
  });

  it("includes the Snapmaker U1 in the local catalog with only sourced specifications", () => {
    const snapmaker = printers.find((printer) => printer.id === "snapmaker-u1");

    expect(snapmaker).toMatchObject({
      brand: "Snapmaker", model: "U1", buildVolumeMm: { x: 270, y: 270, z: 270 }, filamentDiameterMm: 1.75,
      maxNozzleTemperatureC: 300, maxBedTemperatureC: 100, maximumSpeedMmPerSecond: 500,
      multicolorSlots: 4, technicalProperties: { independentToolheads: 4 },
    });
    expect(snapmaker?.sources.map((entry) => entry.url)).toContain("https://www.snapmaker.com/en/snapmaker-u1/specs");
    expect(snapmaker?.extruders).toBeNull();
    expect(printers.filter((printer) => printer.brand === "Snapmaker" && printer.model === "U1")).toHaveLength(1);
    expect(nozzles.find((nozzle) => nozzle.id === "snapmaker-u1-0.4")).toMatchObject({
      diameterMm: 0.4, material: "Aço inoxidável", original: true, printerCompatibility: { "snapmaker-u1": "compatible" },
    });
  });

  it("keeps the Snapmaker Artisan build area tied to its active nozzle mode", () => {
    const artisan = printers.find((printer) => printer.id === "snapmaker-artisan")!;

    expect(artisan.buildVolumeMm).toBeNull();
    expect(getBuildVolumeModes(artisan.technicalProperties ?? {})).toEqual([
      { id: "artisan-left-nozzle", label: "Bico esquerdo", dimensionsMm: { x: 375, y: 400, z: 400 } },
      { id: "artisan-right-nozzle", label: "Bico direito", dimensionsMm: { x: 400, y: 400, z: 400 } },
      { id: "artisan-dual-nozzle", label: "Dois bicos", dimensionsMm: { x: 350, y: 400, z: 400 } },
    ]);
    expect(nozzles.filter((nozzle) => nozzle.id.startsWith("snapmaker-artisan-")).map(({ diameterMm, material, original }) => ({ diameterMm, material, original }))).toEqual([
      { diameterMm: 0.2, material: null, original: false }, { diameterMm: 0.4, material: "Latão", original: true },
      { diameterMm: 0.6, material: null, original: false }, { diameterMm: 0.8, material: null, original: false },
    ]);
  });

  it("does not duplicate the locally seeded Snapmaker nozzles after the database seed is applied", () => {
    const databaseNozzle = mapTechnicalCatalog([], [], [{
      id: "snapmaker-db-artisan-04", manufacturer: "Snapmaker", model: "Bico Snapmaker Artisan",
      diameter_mm: 0.4, body_material: "Latão", max_temperature_c: 300, original: true,
      catalog_status: "published", source_url: "https://www.snapmaker.com/en/snapmaker-artisan/specs/",
    }], [], []).nozzles;
    const catalog = mergeTechnicalCatalogWithFallback({ printers: [], materials: [], nozzles: databaseNozzle }, { printers, materials, nozzles });

    expect(catalog.nozzles.filter((nozzle) => nozzle.brand === "Snapmaker" && nozzle.name === "Bico Snapmaker Artisan" && nozzle.diameterMm === 0.4)).toHaveLength(1);
  });

  it("keeps published resin entries and exact exposure data in the local fallback", () => {
    const standard = materials.find((material) => material.id === "anycubic-standard-resin-v2");
    const waterWash = materials.find((material) => material.id === "anycubic-water-wash-resin-2-0");
    const elegoo = materials.find((material) => material.id === "elegoo-abs-like-resin-v3-0");

    expect(materials.filter((material) => material.process === "resin")).toHaveLength(3);
    expect(standard).toMatchObject({ process: "resin", resinWavelengthNm: 405 });
    expect(standard?.technicalProperties?.exposureByPrinter).toContainEqual({
      printer: "Photon Mono M7", layerHeightMm: 0.05, normalExposureSeconds: 2.2, lightOffSeconds: 0.5,
      bottomExposureSeconds: 25, bottomLayers: 4, antiAliasingLevel: 1, zLiftDistanceMm: 8, zLiftSpeedMmPerSecond: 6, zRetractSpeedMmPerSecond: 6,
    });
    expect(waterWash).toMatchObject({ process: "resin", resinWavelengthNm: 405 });
    expect(waterWash?.technicalProperties?.exposureByPrinter).toContainEqual({
      printer: "Photon Mono M7", layerHeightMm: 0.05, normalExposureSeconds: 2.5, lightOffSeconds: 1,
      bottomExposureSeconds: 35, bottomLayers: 4, antiAliasingLevel: 1, zLiftDistanceMm: 8, zLiftSpeedMmPerSecond: 6, zRetractSpeedMmPerSecond: 6,
    });
    expect(standard?.technicalProperties?.exposureByPrinter).toHaveLength(16);
    expect(waterWash?.technicalProperties?.exposureByPrinter).toHaveLength(16);
    expect(profileHash(standard?.technicalProperties?.exposureByPrinter)).toBe("14b424d6cb7ff3fd2b277d7d3542ec8128efa6727ed134a017db938de13aa6ad");
    expect(profileHash(waterWash?.technicalProperties?.exposureByPrinter)).toBe("4fbec81d72ddbe21318e3676487947d2006f9a277ca18b42a13dc956400513b3");
    expect(elegoo).toMatchObject({ process: "resin", resinWavelengthNm: 405, resinExposureSeconds: null });
    expect(elegoo?.technicalProperties).not.toHaveProperty("exposureByPrinter");

    const monoM7 = printers.find((printer) => printer.id === "anycubic-photon-mono-m7")!;
    const anycubicCheck = evaluateCompatibility(monoM7, standard!);
    expect(anycubicCheck.checks.find((check) => check.key === "material")?.status).toBe("compatible");
    expect(anycubicCheck.checks.find((check) => check.key === "resin-exposure")?.status).toBe("compatible");
    expect(anycubicCheck.checks.find((check) => check.key === "resin-wavelength")?.status).toBe("unverified");

    const saturn = printers.find((printer) => printer.id === "elegoo-saturn-4-ultra-12k")!;
    const elegooCheck = evaluateCompatibility(saturn, elegoo!);
    expect(elegooCheck.checks.find((check) => check.key === "material")?.status).toBe("compatible");
    expect(elegooCheck.checks.find((check) => check.key === "resin-wavelength")?.status).toBe("compatible");
    expect(elegooCheck.checks.find((check) => check.key === "resin-exposure")?.status).toBe("unverified");
  });

  it("keeps Sovol M1D variants, pre-order status and mode-specific volumes explicit", () => {
    const m1d = printers.filter((printer) => printer.model === "M1D");
    expect(m1d.map(({ variant, commercialStatus, enclosure }) => ({ variant, commercialStatus, enclosure }))).toEqual([
      { variant: "Essential", commercialStatus: "announced", enclosure: false },
      { variant: "Advanced", commercialStatus: "announced", enclosure: true },
    ]);
    expect(m1d[0].buildVolumeMm).toBeNull();
    expect(evaluateBuildVolume(m1d[0].buildVolumeMm, { x: 250, y: 250, z: 250 }).status).toBe("unverified");
    const modes = getBuildVolumeModes(m1d[0].technicalProperties ?? {});
    expect(modes).toEqual([
      { id: "fixed toolhead or right-side toolhead switching", label: "Ferramenta fixa ou troca lateral", dimensionsMm: { x: 300, y: 300, z: 350 } },
      { id: "seven-toolhead printing", label: "Sete ferramentas", dimensionsMm: { x: 240, y: 300, z: 350 } },
      { id: "copy", label: "Cópia (2 peças)", dimensionsMm: { x: 178, y: 300, z: 350 } },
      { id: "mirror", label: "Espelho (2 peças)", dimensionsMm: { x: 138, y: 300, z: 350 } },
    ]);
    expect(getBuildVolumeModes({ toolheadModes: [{ mode: "bad", dimensionsMm: { x: 240, y: 0, z: 350 } }] })).toEqual([]);
    expect(evaluateBuildVolume(modes[2].dimensionsMm, { x: 400, y: 150, z: 100 }).status).toBe("incompatible");
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

  it("merges local and database technical properties for printers and materials", () => {
    const fallbackPrinter = printers.find((printer) => printer.id === "prusa-mk4s")!;
    const fallbackMaterial = materials.find((material) => material.id === "prusament-pla")!;
    const catalog = mergeTechnicalCatalogWithFallback({
      printers: [{ ...fallbackPrinter, id: "db-printer", technicalProperties: { databaseOnly: true, shared: "database", nested: { databaseOnly: true, shared: "database" } } }],
      materials: [{ ...fallbackMaterial, id: "db-material", technicalProperties: { databaseOnly: true, shared: "database", nested: { databaseOnly: true, shared: "database" } } }],
      nozzles: [],
    }, {
      printers: [{ ...fallbackPrinter, technicalProperties: { localOnly: true, shared: "local", nested: { localOnly: true, shared: "local" } } }],
      materials: [{ ...fallbackMaterial, technicalProperties: { localOnly: true, shared: "local", nested: { localOnly: true, shared: "local" } } }],
      nozzles: [],
    });

    expect(catalog.printers.find(({ id }) => id === "db-printer")?.technicalProperties)
      .toEqual({ localOnly: true, databaseOnly: true, shared: "database", nested: { localOnly: true, databaseOnly: true, shared: "database" } });
    expect(catalog.materials.find(({ id }) => id === "db-material")?.technicalProperties)
      .toEqual({ localOnly: true, databaseOnly: true, shared: "database", nested: { localOnly: true, databaseOnly: true, shared: "database" } });
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
