import { describe, expect, it } from "vitest";
import { evaluateCompatibility } from "./compatibility";
import { mapTechnicalCatalog } from "./technical-catalog-data";
import { materials, nozzles, printers } from "./technical-catalog";

describe("verified technical catalog records", () => {
  it("marks the manufacturer-listed A1 mini, PLA Basic, and original nozzle setup compatible", () => {
    const result = evaluateCompatibility(printers[0], materials[0], nozzles.find((item) => item.original)!);

    expect(result.status).toBe("compatible");
    expect(result.checks.every((check) => check.status === "compatible")).toBe(true);
  });

  it("rejects PPA-CF on the A1 mini because the documented bed temperature is below the material range", () => {
    const result = evaluateCompatibility(printers[0], materials[1], nozzles.find((item) => item.original)!);

    expect(result.status).toBe("incompatible");
    expect(result.checks.find((check) => check.key === "heated-bed")?.status).toBe("incompatible");
    expect(materials.every((material) => material.sources.length > 0)).toBe(true);
  });

  it("includes the officially documented K2 Plus volume, limits and supported nozzle diameters", () => {
    const printer = printers.find((item) => item.id === "creality-k2-plus");
    const k2Nozzles = nozzles.filter((item) => item.printerCompatibility?.["creality-k2-plus"] === "compatible");

    expect(printer).toMatchObject({
      buildVolumeMm: { x: 350, y: 350, z: 350 },
      maxNozzleTemperatureC: 350,
      maxBedTemperatureC: 120,
      maximumSpeedMmPerSecond: 600,
      maximumPowerWatts: 1200,
      multicolorSlots: 16,
    });
    expect(k2Nozzles.map((nozzle) => nozzle.diameterMm).sort()).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(k2Nozzles.find((nozzle) => nozzle.original)?.diameterMm).toBe(0.4);
    expect(printer?.sources[0].url).toBe("https://www.creality.com/eu/products/k2-series-3d-printer");
  });

  it("includes confirmed P2S specifications while leaving unpublished values unknown", () => {
    const printer = printers.find((item) => item.id === "bambu-p2s");
    const p2sNozzles = nozzles.filter((item) => item.printerCompatibility?.["bambu-p2s"] === "compatible");

    expect(printer).toMatchObject({
      buildVolumeMm: { x: 256, y: 256, z: 256 },
      maxNozzleTemperatureC: 300,
      maxBedTemperatureC: 110,
      filamentDiameterMm: null,
      maximumSpeedMmPerSecond: null,
      maximumPowerWatts: null,
    });
    expect(p2sNozzles.map((nozzle) => nozzle.diameterMm).sort()).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(p2sNozzles.find((nozzle) => nozzle.original)?.diameterMm).toBe(0.4);
  });

  it("includes official H2S build and chamber data without treating toolhead speed as print speed", () => {
    const printer = printers.find((item) => item.id === "bambu-h2s");

    expect(printer).toMatchObject({
      buildVolumeMm: { x: 340, y: 320, z: 340 },
      maxNozzleTemperatureC: 350,
      maxBedTemperatureC: null,
      heatedBed: null,
      filamentDiameterMm: null,
      maximumSpeedMmPerSecond: null,
      enclosure: true,
      technicalProperties: {
        activeChamberHeating: true,
        maximumChamberTemperatureC: 65,
        maxToolheadSpeedMmPerSecond: 1000,
        maxToolheadAccelerationMmPerSecondSquared: 20000,
      },
    });
    expect(printer?.sources[0].url).toBe("https://blog.bambulab.com/h2s-the-ultimate-single-nozzle-3d-printer-now-bigger-than-ever/");
  });

  it("records the H2S AMS 2 Pro Combo without assuming a filament count", () => {
    expect(printers.find((item) => item.id === "bambu-h2s-ams-2-pro-combo")).toMatchObject({
      model: "H2S",
      variant: "AMS 2 Pro Combo",
      multicolorSystem: "AMS 2 Pro",
      multicolorSlots: null,
      technicalProperties: { ams2ProIncluded: true },
    });
  });

  it("keeps cylindrical build volume descriptive instead of treating it as a rectangular box", () => {
    const catalog = mapTechnicalCatalog([{
      id: "flsun-v400-max",
      manufacturer: "FLSUN",
      model: "V400 Max",
      variant: "standard",
      technology: "FDM",
      technical_properties: { buildVolumeDescription: "Cilíndrico · Ø500 × 550 mm" },
    }], [], [], [], []);

    expect(catalog.printers[0].buildVolumeMm).toBeNull();
    expect(catalog.printers[0].buildVolumeDescription).toBe("Cilíndrico · Ø500 × 550 mm");
  });

  it("keeps Raise3D single- and dual-extrusion volumes distinct", () => {
    const catalog = mapTechnicalCatalog([{
      id: "raise3d-pro3-plus-hs",
      manufacturer: "Raise3D",
      model: "Pro3 Plus HS",
      variant: "standard",
      technology: "FDM",
      technical_properties: {
        buildVolumeDescription: "300 × 300 × 605 mm (extrusão simples) · 255 × 300 × 605 mm (dupla)",
        singleExtrusionVolumeMm: { x: 300, y: 300, z: 605 },
        dualExtrusionVolumeMm: { x: 255, y: 300, z: 605 },
      },
    }], [], [], [], []);

    expect(catalog.printers[0].buildVolumeMm).toBeNull();
    expect(catalog.printers[0].buildVolumeDescription).toBe("300 × 300 × 605 mm (extrusão simples) · 255 × 300 × 605 mm (dupla)");
  });
});
