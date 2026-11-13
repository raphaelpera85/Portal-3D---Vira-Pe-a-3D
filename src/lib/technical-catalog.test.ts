import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateCompatibility } from "./compatibility";
import { mapTechnicalCatalog } from "./technical-catalog-data";
import { materials, nozzles, printers } from "./technical-catalog";

const k2ProMigration = readFileSync(new URL("../../supabase/migrations/20261113223000_seed_creality_k2_pro.sql", import.meta.url), "utf8");
const centauri2Migration = readFileSync(new URL("../../supabase/migrations/20261114000000_seed_elegoo_centauri_2.sql", import.meta.url), "utf8");

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

  it("distinguishes the K2 Pro from its CFS Combo and records the supported nozzle sizes", () => {
    const printer = printers.find((item) => item.id === "creality-k2-pro");
    const combo = printers.find((item) => item.id === "creality-k2-pro-cfs-combo");
    const proNozzles = nozzles.filter((item) => item.printerCompatibility?.["creality-k2-pro"] === "compatible");

    expect(printer).toMatchObject({
      buildVolumeMm: { x: 300, y: 300, z: 300 },
      maxNozzleTemperatureC: 300,
      maxBedTemperatureC: 110,
      maximumSpeedMmPerSecond: 600,
      maximumPowerWatts: 1300,
      multicolorSlots: null,
    });
    expect(combo).toMatchObject({
      variant: "CFS Combo",
      multicolorSystem: "Creality CFS",
      multicolorSlots: 4,
      technicalProperties: { includedCfsUnits: 1, maximumCfsUnits: 4 },
    });
    expect(proNozzles.map((nozzle) => nozzle.diameterMm).sort()).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(proNozzles.find((nozzle) => nozzle.original)?.diameterMm).toBe(0.4);
    expect(k2ProMigration).toContain("'K2 Pro', 'standard'");
    expect(k2ProMigration).toContain("'K2 Pro', 'CFS Combo'");
    expect(k2ProMigration).toContain('"includedCfsUnits":1');
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

  it("records the P2S AMS 2 Pro Combo without assuming a filament count", () => {
    expect(printers.find((item) => item.id === "bambu-p2s-ams-2-pro-combo")).toMatchObject({
      model: "P2S",
      variant: "AMS 2 Pro Combo",
      buildVolumeMm: { x: 256, y: 256, z: 256 },
      maxNozzleTemperatureC: 300,
      maxBedTemperatureC: 110,
      multicolorSystem: "AMS 2 Pro",
      multicolorSlots: null,
      technicalProperties: { ams2ProIncluded: true, amsFilamentDrying: true },
    });
  });

  it("includes Centauri 2 variants and keeps the CANVAS upgrade distinct from the included Combo", () => {
    const standard = printers.find((item) => item.id === "elegoo-centauri-2");
    const combo = printers.find((item) => item.id === "elegoo-centauri-2-canvas-combo");
    const originalNozzle = nozzles.find((item) => item.id === "elegoo-centauri-2-0.4");

    expect(standard).toMatchObject({
      buildVolumeMm: { x: 256, y: 256, z: 256 },
      filamentDiameterMm: 1.75,
      maxNozzleTemperatureC: 350,
      maxBedTemperatureC: 110,
      maximumSpeedMmPerSecond: 500,
      multicolorSlots: null,
      multicolorSystem: "ELEGOO CANVAS (vendido separadamente)",
      technicalProperties: { recommendedPrintSpeedMmPerSecond: 250, multicolorUpgradeAvailable: true },
    });
    expect(combo).toMatchObject({
      model: "Centauri 2",
      variant: "CANVAS Combo",
      multicolorSystem: "ELEGOO CANVAS",
      multicolorSlots: 4,
      technicalProperties: { includedCanvas: true },
    });
    expect(originalNozzle).toMatchObject({
      diameterMm: 0.4,
      material: "Latão com ponta de aço endurecido",
      original: true,
      printerCompatibility: { "elegoo-centauri-2": "compatible", "elegoo-centauri-2-canvas-combo": "compatible" },
    });
    expect(standard?.sources[0].url).toBe("https://us.elegoo.com/products/centauri-2");
    expect(centauri2Migration).toContain("'Centauri 2', 'standard'");
    expect(centauri2Migration).toContain("'Centauri 2', 'CANVAS Combo'");
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

  it("includes official H3C specifications without treating toolhead speed or tools as print speed or filament count", () => {
    const printer = printers.find((item) => item.id === "bambu-h3c-ams-3h-combo");

    expect(printer).toMatchObject({
      buildVolumeMm: { x: 330, y: 320, z: 325 },
      maxNozzleTemperatureC: 350,
      maxBedTemperatureC: 120,
      filamentDiameterMm: null,
      maximumSpeedMmPerSecond: null,
      maximumSpeedDescription: "1.400 mm/s de deslocamento do cabeçote; velocidade de impressão não informada",
      multicolorSlots: null,
      multicolorSystem: "SwapTek + AMS 3H",
      technicalProperties: {
        activeChamberHeating: true,
        maximumChamberTemperatureC: 65,
        maxToolheadSpeedMmPerSecond: 1400,
        maxToolheadAccelerationMmPerSecondSquared: 25000,
        printToolCount: 9,
        supportedFilamentDiametersMm: [1.75, 2.85],
      },
    });
    expect(printer?.sources[0].url).toBe("https://blog.bambulab.com/tool-changer-game-changer-bambu-lab-presents-h3c-the-defining-new-generation-of-3d-printers/");
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
