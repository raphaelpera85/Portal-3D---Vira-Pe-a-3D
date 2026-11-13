import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateCompatibility } from "./compatibility";
import { mapTechnicalCatalog } from "./technical-catalog-data";
import { materials, nozzles, printers } from "./technical-catalog";

const k2ProMigration = readFileSync(new URL("../../supabase/migrations/20261113223000_seed_creality_k2_pro.sql", import.meta.url), "utf8");
const centauri2Migration = readFileSync(new URL("../../supabase/migrations/20261114000000_seed_elegoo_centauri_2.sql", import.meta.url), "utf8");
const ender3V4Migration = readFileSync(new URL("../../supabase/migrations/20261114010000_seed_creality_ender_3_v4_combo.sql", import.meta.url), "utf8");
const ender5MaxMigration = readFileSync(new URL("../../supabase/migrations/20261114020000_seed_creality_ender_5_max.sql", import.meta.url), "utf8");
const bambuPetgHfMigration = readFileSync(new URL("../../supabase/migrations/20261114030000_seed_bambu_petg_hf.sql", import.meta.url), "utf8");
const qidiMax4Migration = readFileSync(new URL("../../supabase/migrations/20261114110000_seed_qidi_max4.sql", import.meta.url), "utf8");
const prusaMk4sMigration = readFileSync(new URL("../../supabase/migrations/20261113134452_prusa_mk4s_catalog.sql", import.meta.url), "utf8");

describe("verified technical catalog records", () => {
  it("keeps the first official catalog seed variants in the local fallback", () => {
    const seededVariants = [
      ["Bambu Lab", "A1", "standard"],
      ["Bambu Lab", "A1", "Combo"],
      ["Bambu Lab", "A1 mini", "standard"],
      ["Bambu Lab", "A1 mini", "Combo"],
      ["Bambu Lab", "H2S", "standard"],
      ["Bambu Lab", "H2S", "AMS 2 Pro Combo"],
      ["Bambu Lab", "H3C", "AMS 3H Combo"],
      ["Bambu Lab", "P2S", "standard"],
      ["Bambu Lab", "P2S", "AMS 2 Pro Combo"],
      ["Creality", "K2 Plus", "standard"],
      ["Creality", "K2 Pro", "standard"],
      ["Creality", "K2 Pro", "CFS Combo"],
      ["Prusa Research", "CORE One+", "Gen 2"],
      ["Prusa Research", "MK4S", "standard"],
      ["Creality", "Ender-3 V4", "Combo"],
      ["Creality", "Ender-5 Max", "standard"],
      ["ELEGOO", "Centauri 2", "standard"],
      ["ELEGOO", "Centauri 2", "CANVAS Combo"],
      ["Anycubic", "Kobra 3", "standard"],
      ["Creality", "K1C", "standard"],
      ["ELEGOO", "Neptune 4 Pro", "Type-C edition"],
      ["Flashforge", "Adventurer 5M", "standard"],
      ["Sovol", "SV08", "standard"],
      ["QIDI Tech", "Plus4", "standard"],
      ["QIDI Tech", "Max4", "standard"],
      ["Artillery", "M1 Pro", "standard"],
      ["FLSUN", "V400 Max", "standard"],
      ["Raise3D", "Pro3 HS", "standard"],
      ["Formlabs", "Form 4", "standard"],
      ["Phrozen", "Sonic Mighty Revo 16K", "standard"],
      ["Ultimaker", "S7", "standard"],
      ["Snapmaker", "U1", "standard"],
      ["Creality", "Ender-3 V3 KE", "standard"],
      ["ELEGOO", "Saturn 4 Ultra", "12K"],
      ["Anycubic", "Kobra S1", "standard"],
      ["Anycubic", "Kobra S1", "Combo"],
      ["Anycubic", "Photon Mono M7", "standard"],
      ["Anycubic", "Photon Mono M7 Pro", "standard"],
      ["Anycubic", "Photon Mono M7 Max", "standard"],
      ["Anycubic", "Photon P1", "standard"],
      ["Bambu Lab", "H2D", "AMS 2 Pro Combo"],
      ["Bambu Lab", "P1S", "standard"],
      ["Bambu Lab", "P1S", "Combo"],
      ["Creality", "Ender-3 V3", "standard"],
      ["Creality", "Ender-3 V3 Plus", "standard"],
      ["Creality", "Ender-3 V3 SE", "standard"],
      ["ELEGOO", "Centauri Carbon 2", "standard"],
      ["ELEGOO", "Neptune 4 Plus", "Type-C version"],
      ["ELEGOO", "Neptune 4 Max", "Type-C version"],
      ["Flashforge", "AD5X", "standard"],
      ["Flashforge", "Adventurer 5M Pro", "standard"],
    ];

    expect(printers).toEqual(expect.arrayContaining(seededVariants.map(([brand, model, variant]) =>
      expect.objectContaining({ brand, model, variant }))));
    expect(printers).toHaveLength(51);
    expect(new Set(printers.map((printer) => printer.id)).size).toBe(printers.length);
    expect(printers.every((printer) => printer.sources.length > 0)).toBe(true);
  });

  it("keeps the QIDI Max4's verified specifications without presenting toolhead speed as print speed", () => {
    const max4 = printers.find((printer) => printer.id === "qidi-max4");

    expect(max4).toMatchObject({
      brand: "QIDI Tech", model: "Max4", variant: "standard", buildVolumeMm: { x: 390, y: 390, z: 340 },
      filamentDiameterMm: 1.75, maxNozzleTemperatureC: 370,
      maxBedTemperatureC: 120, heatedBed: true, enclosure: true, maximumSpeedMmPerSecond: null,
      multicolorSystem: "QIDI Box (vendido separadamente)",
      technicalProperties: { maxToolheadSpeedMmPerSecond: 800, activeChamberMaximumTemperatureC: 65 },
    });
    expect(max4?.maximumSpeedDescription).toContain("velocidade de impressão não informada");
    expect(nozzles.filter((nozzle) => nozzle.printerCompatibility?.["qidi-max4"] === "compatible").map((nozzle) => nozzle.diameterMm))
      .toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(mapTechnicalCatalog([{
      id: "qidi-max4", manufacturer: "QIDI Tech", model: "Max4", variant: "standard", technology: "FDM",
      technical_properties: { maxToolheadSpeedMmPerSecond: 800, activeChamberMaximumTemperatureC: 65 },
    }], [], [], [], []).printers[0].maximumSpeedDescription).toBe("800 mm/s de deslocamento do cabeçote; velocidade de impressão não informada");
    expect(qidiMax4Migration).toContain("'QIDI Tech', 'Max4', 'standard'");
    expect(qidiMax4Migration).toContain("select 'QIDI Tech', 'Max4 nozzle'");
  });

  it("keeps the Bambu Lab A1 and A1 mini variants in the local fallback with exact hotend compatibility", () => {
    const a1 = printers.filter((item) => item.model === "A1");
    const a1Mini = printers.filter((item) => item.model === "A1 mini");
    const a1Nozzles = nozzles.filter((item) => item.printerCompatibility
      && Object.keys(item.printerCompatibility).some((id) => id === "bambu-a1" || id === "bambu-a1-ams-lite-combo" || id === "bambu-a1-mini-ams-lite" || id === "bambu-a1-mini-standard"));

    expect(a1.map((item) => item.variant)).toEqual(["standard", "Combo"]);
    expect(a1Mini.map((item) => item.variant)).toEqual(["Combo", "standard"]);
    expect(a1).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "bambu-a1", buildVolumeMm: { x: 256, y: 256, z: 256 }, maximumSpeedMmPerSecond: null }),
      expect.objectContaining({ id: "bambu-a1-ams-lite-combo", multicolorSlots: 4, multicolorSystem: "AMS lite" }),
    ]));
    expect(a1Nozzles.map((item) => item.diameterMm).sort()).toEqual([0.2, 0.2, 0.4, 0.4, 0.6, 0.6, 0.8, 0.8]);
    expect(a1Nozzles.find((item) => item.name.includes("A1 hotend") && item.diameterMm === 0.4)?.printerCompatibility)
      .toEqual({ "bambu-a1": "compatible", "bambu-a1-ams-lite-combo": "compatible" });
    expect(a1Nozzles.find((item) => item.id === "bambu-a1-mini-0.4")?.printerCompatibility)
      .toEqual({ "bambu-a1-mini-ams-lite": "compatible", "bambu-a1-mini-standard": "compatible" });
  });

  it("marks the manufacturer-listed A1 mini, PLA Basic, and original nozzle setup compatible", () => {
    const printer = printers.find((item) => item.id === "bambu-a1-mini-ams-lite")!;
    const nozzle = nozzles.find((item) => item.original && item.printerCompatibility?.[printer.id] === "compatible")!;
    const result = evaluateCompatibility(printer, materials[0], nozzle);

    expect(result.status).toBe("compatible");
    expect(result.checks.every((check) => check.status === "compatible")).toBe(true);
  });

  it("marks PPA-CF as not recommended on both A1 variants instead of leaving it unverified", () => {
    const ppaCf = materials.find((material) => material.name === "PPA-CF")!;
    for (const id of ["bambu-a1", "bambu-a1-ams-lite-combo"]) {
      const printer = printers.find((item) => item.id === id)!;
      const materialCheck = evaluateCompatibility(printer, ppaCf).checks.find((check) => check.key === "material");

      expect(materialCheck?.status).toBe("conditional");
    }
  });

  it("includes the source-verified PETG HF profile, colors, and published database seed", () => {
    const petgHf = materials.find((material) => material.id === "bambu-petg-hf");

    expect(petgHf).toMatchObject({
      name: "PETG HF",
      brand: "Bambu Lab",
      densityGPerCm3: 1.28,
      nozzleTemperatureC: { min: 230, max: 260 },
      bedTemperatureC: { min: 60, max: 80 },
      printSpeedMaximumMmPerSecond: 300,
      drying: { required: true, temperatureC: 65, hours: 8 },
      multicolorCompatible: true,
    });
    expect(petgHf?.colors).toHaveLength(14);
    expect(petgHf?.colors.find((color) => color.name === "Azul Lago")?.hex).toBe("#1F79E5");
    expect(petgHf?.sources.length).toBeGreaterThanOrEqual(2);
    expect(bambuPetgHfMigration).toContain("'Bambu Lab', 'PETG HF', 'PETG', 'filament', 'published'");
    expect(bambuPetgHfMigration).toContain('"#1F79E5"');
  });

  it("rejects PPA-CF on the A1 mini because the documented bed temperature is below the material range", () => {
    const printer = printers.find((item) => item.id === "bambu-a1-mini-ams-lite")!;
    const nozzle = nozzles.find((item) => item.original && item.printerCompatibility?.[printer.id] === "compatible")!;
    const result = evaluateCompatibility(printer, materials[1], nozzle);

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

  it("keeps CORE One+ Gen 2 and its official nozzle range available in the local fallback", () => {
    const printer = printers.find((item) => item.id === "prusa-core-one-plus-gen-2");
    const coreNozzles = nozzles.filter((item) => item.printerCompatibility?.["prusa-core-one-plus-gen-2"] === "compatible");
    const originalNozzle = coreNozzles.find((nozzle) => nozzle.original)!;
    const prusamentMaterials = materials.filter((item) => item.brand === "Prusa Polymers");

    expect(printer).toMatchObject({
      model: "CORE One+",
      variant: "Gen 2",
      buildVolumeMm: { x: 250, y: 220, z: 270 },
      filamentDiameterMm: 1.75,
      maxNozzleTemperatureC: 290,
      maxBedTemperatureC: 120,
      enclosure: true,
      maximumSpeedMmPerSecond: null,
      technicalProperties: { chamberMaximumTemperatureC: 55, supportedNozzleDiametersMm: [0.25, 0.4, 0.6, 0.8] },
    });
    expect(coreNozzles.map((nozzle) => nozzle.diameterMm).sort((left, right) => left - right)).toEqual([0.25, 0.4, 0.6, 0.8]);
    expect(originalNozzle.diameterMm).toBe(0.4);
    expect(prusamentMaterials.map((material) => material.id).sort()).toEqual([
      "prusament-asa", "prusament-pa11", "prusament-pa11-cf", "prusament-pc-blend",
      "prusament-petg", "prusament-petg-cf", "prusament-pla", "prusament-tpu-95a",
    ]);
    expect(printer?.supportedMaterials["prusament-pla"]).toMatchObject({ status: "compatible" });
    expect(printer?.supportedMaterials["prusament-pa11"]).toMatchObject({ status: "conditional" });
    expect(printer?.supportedMaterials["prusament-petg-cf"]).toMatchObject({ status: "conditional" });
    expect(printer?.sources[0].url).toBe("https://www.prusa3d.com/en/product/prusa-core-one-12/");
    expect(prusamentMaterials.every((material) => material.sources.length > 0)).toBe(true);
    expect(evaluateCompatibility(printer!, materials.find((item) => item.id === "prusament-pla")!, originalNozzle).status).toBe("compatible");
    expect(evaluateCompatibility(printer!, materials.find((item) => item.id === "prusament-pa11")!, originalNozzle).status).toBe("conditional");
    expect(evaluateCompatibility(printer!, materials.find((item) => item.id === "prusament-pa11-cf")!, originalNozzle).checks)
      .toContainEqual(expect.objectContaining({ key: "hotend-temperature", status: "conditional" }));
  });

  it("keeps MK4S material compatibility and the hardened Nextruder nozzle distinct in the fallback", () => {
    const printer = printers.find((item) => item.id === "prusa-mk4s");
    const mk4sNozzles = nozzles.filter((item) => item.printerCompatibility?.["prusa-mk4s"] === "compatible");
    const hardenedNozzle = mk4sNozzles.find((item) => item.id === "prusa-mk4s-hardened-0.4");

    expect(printer).toMatchObject({
      buildVolumeMm: { x: 250, y: 210, z: 220 },
      filamentDiameterMm: 1.75,
      maxNozzleTemperatureC: 290,
      maxBedTemperatureC: 120,
      enclosure: false,
      multicolorSlots: null,
      technicalProperties: { optionalMultiMaterialUpgrade: "MMU3" },
      supportedMaterials: {
        "prusament-pla": { status: "compatible" },
        "prusament-asa": { status: "conditional" },
        "prusament-pa11-cf": { status: "conditional" },
      },
    });
    expect(mk4sNozzles).toHaveLength(5);
    expect(mk4sNozzles.filter((item) => item.diameterMm === 0.4).map((item) => item.abrasionResistant).sort()).toEqual([false, true]);
    expect(hardenedNozzle).toMatchObject({ original: false, abrasionResistant: true });
    const abrasiveCheck = evaluateCompatibility(printer!, materials.find((item) => item.id === "prusament-petg-cf")!, hardenedNozzle!);
    expect(abrasiveCheck.status).toBe("conditional");
    expect(abrasiveCheck.checks).not.toContainEqual(expect.objectContaining({ key: "abrasion", status: "unverified" }));
    expect(prusaMk4sMigration).toContain("Prusa Hardened Nozzle (Nickel plated)");
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

  it("includes the official Ender-3 V4 Combo and keeps TPU out of its CFS", () => {
    const printer = printers.find((item) => item.id === "creality-ender-3-v4-combo");
    const nozzle = nozzles.find((item) => item.id === "creality-ender-3-v4-0.4");

    expect(printer).toMatchObject({
      model: "Ender-3 V4",
      variant: "Combo",
      buildVolumeMm: { x: 220, y: 220, z: 235 },
      maxNozzleTemperatureC: 300,
      maxBedTemperatureC: 100,
      maximumSpeedMmPerSecond: 500,
      multicolorSlots: 4,
      technicalProperties: { maxAccelerationMmPerSecondSquared: 12000, cfsExtensionsMaximum: 4 },
      supportedMaterials: {
        "creality-hyper-pla": { status: "compatible" },
        "creality-hyper-petg": { status: "compatible" },
        "creality-hp-tpu": { status: "conditional", conditions: expect.stringContaining("CFS") },
      },
    });
    expect(nozzle).toMatchObject({
      diameterMm: 0.4,
      original: true,
      printerCompatibility: { "creality-ender-3-v4-combo": "compatible" },
    });
    expect(evaluateCompatibility(printer!, materials.find((item) => item.id === "creality-hp-tpu")!, nozzle!).status).toBe("conditional");
    expect(printer?.sources[0].url).toBe("https://www.creality.com/products/ender-3-v4-3d-printer");
    expect(ender3V4Migration).toContain("'Ender-3 V4', 'Combo'");
    expect(ender3V4Migration).toContain("o CFS é incompatível com TPU");
  });

  it("includes the 400 mm Ender-5 Max and its three verified nozzle diameters", () => {
    const printer = printers.find((item) => item.id === "creality-ender-5-max");
    const compatibleNozzles = nozzles.filter((item) => item.printerCompatibility?.["creality-ender-5-max"] === "compatible");

    expect(printer).toMatchObject({
      buildVolumeMm: { x: 400, y: 400, z: 400 },
      maxNozzleTemperatureC: 300,
      maxBedTemperatureC: 100,
      maximumSpeedMmPerSecond: 700,
      enclosure: false,
      multicolorSlots: null,
      technicalProperties: { maxAccelerationMmPerSecondSquared: 20000 },
    });
    expect(compatibleNozzles.map((item) => item.diameterMm).sort()).toEqual([0.4, 0.6, 0.8]);
    expect(compatibleNozzles.find((item) => item.original)?.diameterMm).toBe(0.4);
    expect(ender5MaxMigration).toContain("'Ender-5 Max', 'standard'");
    expect(ender5MaxMigration).not.toContain("Creality CFS");
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
