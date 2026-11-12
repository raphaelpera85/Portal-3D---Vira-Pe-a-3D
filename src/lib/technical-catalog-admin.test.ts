import { describe, expect, it } from "vitest";
import { validateMaterialCatalogInput, validateMaterialCompatibilityInput, validateNozzleCatalogInput, validateNozzleCompatibilityInput } from "./technical-catalog-admin";

const material = {
  manufacturer: "Bambu Lab", product: "PLA Basic", family: "PLA", process: "filament", catalogStatus: "published",
  filamentDiameter: "1.75", density: "1.24", colors: "[{\"name\":\"Preto\",\"hex\":\"#000000\"}]",
  nozzleMin: "190", nozzleMax: "230", bedMin: "35", bedMax: "45", enclosure: "false", abrasive: "false",
  multicolorCompatible: "true", dryingRequired: "false", dryingTemperature: "50", dryingHours: "8",
  maxPrintSpeed: "300", resinWavelength: "", resinExposure: "", technicalProperties: "{\"nozzleDiametersMm\":[0.4,0.6]} ",
  documentationUrl: "", sourceUrl: "https://example.com/pla", verifiedAt: "2026-11-11",
};
const nozzle = {
  manufacturer: "Bambu Lab", model: "A1 mini 0.4 mm", interface: "", diameter: "0.4", bodyMaterial: "Aço inoxidável",
  maxTemperature: "300", abrasionResistant: "false", original: "on", catalogStatus: "published",
  technicalProperties: "{\"original\":true}", documentationUrl: "", sourceUrl: "https://example.com/nozzle", verifiedAt: "2026-11-11",
};
const relation = {
  printerId: "8f14e45f-ea6d-4e1d-8f8a-3f2a6f1d2c70", entityId: "714e4c72-07f8-49e5-b8ba-f821af2f06b4",
  compatibility: "conditional", conditions: "Use câmara fechada.", catalogStatus: "published",
  sourceUrl: "https://example.com/compatibility", verifiedAt: "2026-11-11",
};

describe("technical catalog admin validation", () => {
  it("normalizes sourced materials and resins with structured colors", () => {
    expect(validateMaterialCatalogInput(material)).toMatchObject({
      manufacturer: "Bambu Lab", product: "PLA Basic", process: "filament", catalog_status: "published",
      colors: [{ name: "Preto", hex: "#000000" }], nozzle_temperature_min_c: 190, drying_required: false,
    });
    expect(validateMaterialCatalogInput({ ...material, process: "resin", resinWavelength: "405", resinExposure: "2.2" }))
      .toMatchObject({ process: "resin", resin_wavelength_nm: 405, resin_exposure_seconds: 2.2 });
  });

  it("rejects inverted ranges, invalid color data, and unverified publication", () => {
    expect(validateMaterialCatalogInput({ ...material, nozzleMin: "240" })).toBeNull();
    expect(validateMaterialCatalogInput({ ...material, colors: "[{\"name\":\"Preto\",\"hex\":\"red\"}]" })).toBeNull();
    expect(validateMaterialCatalogInput({ ...material, sourceUrl: "", verifiedAt: "" })).toBeNull();
  });

  it("validates nozzle specifications without inferring a printer fit", () => {
    expect(validateNozzleCatalogInput(nozzle)).toMatchObject({ diameter_mm: 0.4, original: true, abrasion_resistant: false });
    expect(validateNozzleCatalogInput({ ...nozzle, diameter: "0" })).toBeNull();
    expect(validateNozzleCatalogInput({ ...nozzle, sourceUrl: "", verifiedAt: "" })).toBeNull();
  });

  it("requires sources for published compatibility relationships", () => {
    expect(validateMaterialCompatibilityInput(relation)).toMatchObject({ compatibility: "conditional", catalog_status: "published" });
    expect(validateNozzleCompatibilityInput({ ...relation, fit: "compatible" })).toMatchObject({ fit: "compatible" });
    expect(validateMaterialCompatibilityInput({ ...relation, sourceUrl: "", verifiedAt: "" })).toBeNull();
    expect(validateNozzleCompatibilityInput({ ...relation, printerId: "not-a-uuid", fit: "compatible" })).toBeNull();
  });
});
