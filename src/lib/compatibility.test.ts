import { describe, expect, it } from "vitest";
import { evaluateCompatibility, evaluateMaterialCompatibility, type CatalogMaterial, type CatalogNozzle, type CatalogPrinter } from "./compatibility";

const printer: CatalogPrinter = {
  id: "printer", name: "A1 mini", technology: "FDM", buildVolumeMm: { x: 180, y: 180, z: 180 },
  filamentDiameterMm: 1.75, maxNozzleTemperatureC: 300, maxBedTemperatureC: 80,
  heatedBed: true, enclosure: false, multicolorSlots: 4, supportedMaterials: { PLA: "recommended" },
};
const material: CatalogMaterial = {
  id: "pla", name: "PLA Basic", family: "PLA", process: "filament", filamentDiameterMm: 1.75,
  nozzleTemperatureC: { min: 190, max: 230 }, bedTemperatureC: { min: 35, max: 65 },
  nozzleDiametersMm: null,
  enclosureRequired: false, abrasive: false, multicolorCompatible: true,
};
const nozzle: CatalogNozzle = {
  id: "nozzle", name: "0.4 mm", diameterMm: 0.4, material: "Aço inoxidável",
  maxTemperatureC: 300, abrasionResistant: false, printerCompatibility: { printer: "compatible" },
};

describe("evaluateCompatibility", () => {
  it("evaluates material and printer compatibility without claiming a nozzle check", () => {
    const result = evaluateMaterialCompatibility(printer, material);

    expect(result.status).toBe("compatible");
    expect(result.checks.some(({ key }) => key.startsWith("nozzle"))).toBe(false);
  });

  it("includes the selected catalog nozzle in the material compatibility result", () => {
    const result = evaluateMaterialCompatibility(printer, material, nozzle);

    expect(result.checks.find(({ key }) => key === "nozzle-fit")).toMatchObject({ status: "compatible" });
  });

  it("confirms a sourced setup when its material, nozzle, and dimensions meet known limits", () => {
    expect(evaluateCompatibility(printer, material, nozzle, { partDimensionsMm: { x: 100, y: 100, z: 100 } }).status).toBe("compatible");
  });

  it("rejects a part outside the printer volume and a material above its hotend limit", () => {
    const result = evaluateCompatibility(
      { ...printer, maxNozzleTemperatureC: 200 },
      { ...material, nozzleTemperatureC: { min: 220, max: 240 } },
      nozzle,
      { partDimensionsMm: { x: 181, y: 20, z: 20 } },
    );

    expect(result.status).toBe("incompatible");
    expect(result.checks.filter((check) => check.status === "incompatible")).toHaveLength(2);
  });

  it("marks partially reachable material temperature ranges as conditional", () => {
    const result = evaluateCompatibility(
      { ...printer, maxNozzleTemperatureC: 290, maxBedTemperatureC: 110 },
      { ...material, nozzleTemperatureC: { min: 275, max: 295 }, bedTemperatureC: { min: 100, max: 120 } },
    );

    expect(result.checks.find((check) => check.key === "hotend-temperature")).toMatchObject({ status: "conditional", detail: expect.stringContaining("temperatura máxima é 290 °C") });
    expect(result.checks.find((check) => check.key === "heated-bed")).toMatchObject({ status: "conditional", detail: expect.stringContaining("temperatura máxima é 110 °C") });
  });

  it("requires an external spool when AMS Lite cannot feed the selected material", () => {
    const result = evaluateCompatibility(printer, { ...material, multicolorCompatible: false }, nozzle, { useMulticolor: true });

    expect(result.status).toBe("conditional");
    expect(result.checks.some((check) => check.key === "multicolor" && check.status === "conditional")).toBe(true);
  });

  it("returns unverified instead of assuming compatibility when critical catalog facts are missing", () => {
    const result = evaluateCompatibility(
      { ...printer, maxNozzleTemperatureC: null, supportedMaterials: {} },
      { ...material, nozzleTemperatureC: null },
      { ...nozzle, printerCompatibility: null },
    );

    expect(result.status).toBe("unverified");
  });

  it("rejects resin on an FDM printer", () => {
    expect(evaluateCompatibility(printer, { ...material, process: "resin" }, nozzle).status).toBe("incompatible");
  });

  it("uses a verified printer and material relation for resin without requiring a nozzle fit", () => {
    const resinPrinter: CatalogPrinter = { ...printer, id: "resin-printer", technology: "SLA", filamentDiameterMm: null, supportedMaterials: { "ABS-LIKE": "compatible" } };
    const resinMaterial: CatalogMaterial = { ...material, id: "resin", family: "ABS-like", process: "resin", filamentDiameterMm: null, nozzleTemperatureC: null, bedTemperatureC: null };
    const result = evaluateCompatibility(resinPrinter, resinMaterial, { ...nozzle, printerCompatibility: null });
    expect(result.status).toBe("compatible");
    expect(result.checks.some((check) => check.key === "nozzle-fit")).toBe(false);
  });

  it("allows a part that fits after the axes are oriented to the available build volume", () => {
    const result = evaluateCompatibility(
      { ...printer, buildVolumeMm: { x: 220, y: 180, z: 180 } },
      material,
      nozzle,
      { partDimensionsMm: { x: 190, y: 170, z: 150 } },
    );

    expect(result.checks.find((check) => check.key === "volume")?.status).toBe("compatible");
  });

  it("rejects a nozzle diameter explicitly excluded by the material manufacturer", () => {
    const result = evaluateCompatibility(
      printer,
      { ...material, nozzleDiametersMm: [0.4, 0.6, 0.8] },
      { ...nozzle, diameterMm: 0.2 },
    );

    expect(result.checks.find((check) => check.key === "nozzle-diameter")?.status).toBe("incompatible");
  });

  it("keeps an unlisted printer and nozzle pairing unverified instead of assuming it cannot fit", () => {
    const result = evaluateCompatibility({ ...printer, id: "other-printer" }, material, nozzle);

    expect(result.checks.find((check) => check.key === "nozzle-fit")?.status).toBe("unverified");
    expect(result.status).toBe("unverified");
  });
});
