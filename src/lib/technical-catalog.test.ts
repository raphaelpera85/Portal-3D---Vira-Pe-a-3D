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
const qidiQ2Migration = readFileSync(new URL("../../supabase/migrations/20261114120000_seed_qidi_q2.sql", import.meta.url), "utf8");
const qidiPlus5Migration = readFileSync(new URL("../../supabase/migrations/20261114130000_seed_qidi_plus5.sql", import.meta.url), "utf8");
const qidiQ2cMigration = readFileSync(new URL("../../supabase/migrations/20261114140000_seed_qidi_q2c.sql", import.meta.url), "utf8");
const qidiQ2cPowerMigration = readFileSync(new URL("../../supabase/migrations/20261114150000_fix_qidi_q2c_rated_power.sql", import.meta.url), "utf8");
const bambuH2cMigration = readFileSync(new URL("../../supabase/migrations/20261114160000_seed_bambu_h2c.sql", import.meta.url), "utf8");
const bambuX1CarbonMigration = readFileSync(new URL("../../supabase/migrations/20261114170000_seed_bambu_x1_carbon.sql", import.meta.url), "utf8");
const bambuX1CarbonMaterialMigration = readFileSync(new URL("../../supabase/migrations/20261114180000_link_bambu_x1_carbon_materials.sql", import.meta.url), "utf8");
const bambuX1CarbonAdditionalMaterialMigration = readFileSync(new URL("../../supabase/migrations/20261114190000_link_bambu_x1_carbon_additional_materials.sql", import.meta.url), "utf8");
const prusaXlPlusMigration = readFileSync(new URL("../../supabase/migrations/20261114200000_seed_prusa_xl_plus.sql", import.meta.url), "utf8");
const prusaCoreOneLPlusMigration = readFileSync(new URL("../../supabase/migrations/20261114210000_seed_prusa_core_one_l_plus.sql", import.meta.url), "utf8");
const flsunS1SeriesMigration = readFileSync(new URL("../../supabase/migrations/20261114220000_seed_flsun_s1_series.sql", import.meta.url), "utf8");
const flsunT1Migration = readFileSync(new URL("../../supabase/migrations/20261114230000_seed_flsun_t1.sql", import.meta.url), "utf8");
const flsunT1ProMigration = readFileSync(new URL("../../supabase/migrations/20261115000000_seed_flsun_t1_pro.sql", import.meta.url), "utf8");
const flsunT1MaxMigration = readFileSync(new URL("../../supabase/migrations/20261115010000_seed_flsun_t1_max.sql", import.meta.url), "utf8");
const flsunV400Migration = readFileSync(new URL("../../supabase/migrations/20261115020000_seed_flsun_v400.sql", import.meta.url), "utf8");
const elegooNeptune4Migration = readFileSync(new URL("../../supabase/migrations/20261115030000_seed_elegoo_neptune_4_type_c.sql", import.meta.url), "utf8");
const anycubicKobraXMigration = readFileSync(new URL("../../supabase/migrations/20261115060000_seed_anycubic_kobra_x.sql", import.meta.url), "utf8");
const anycubicS1MaxMigration = readFileSync(new URL("../../supabase/migrations/20261115070000_seed_anycubic_kobra_s1_max_and_photon_p1_max.sql", import.meta.url), "utf8");
const crealityK2Migration = readFileSync(new URL("../../supabase/migrations/20261115080000_seed_creality_k2.sql", import.meta.url), "utf8");
const bambuH2dVariantsMigration = readFileSync(new URL("../../supabase/migrations/20261115090000_expand_bambu_h2d_variants.sql", import.meta.url), "utf8");
const crealityEnderV3NeoMegaMigration = readFileSync(new URL("../../supabase/migrations/20261115100000_seed_creality_ender_v3_neo_mega.sql", import.meta.url), "utf8");
const crealitySparkXI7Migration = readFileSync(new URL("../../supabase/migrations/20261115110000_seed_creality_sparkx_i7.sql", import.meta.url), "utf8");
const crealityK2SeMigration = readFileSync(new URL("../../supabase/migrations/20261115120000_seed_creality_k2_se.sql", import.meta.url), "utf8");
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
      ["Bambu Lab", "H2C", "standard"],
      ["Bambu Lab", "H3C", "AMS 3H Combo"],
      ["Bambu Lab", "P2S", "standard"],
      ["Bambu Lab", "P2S", "AMS 2 Pro Combo"],
      ["Bambu Lab", "X1-Carbon", "standard"],
      ["Bambu Lab", "X1-Carbon", "AMS Combo"],
      ["Creality", "K2 Plus", "standard"],
      ["Creality", "K2", "standard"],
      ["Creality", "K2", "CFS Combo"],
      ["Creality", "K2 Pro", "standard"],
      ["Creality", "K2 Pro", "CFS Combo"],
      ["Prusa Research", "CORE One+", "Gen 2"],
      ["Prusa Research", "CORE One L+", "standard"],
      ["Prusa Research", "CORE One L+", "HT Hotend"],
      ["Prusa Research", "XL+", "Single-Tool"],
      ["Prusa Research", "XL+", "Five-Head"],
      ["Prusa Research", "MK4S", "standard"],
      ["Creality", "Ender-3 V4", "Combo"],
      ["Creality", "Ender-5 Max", "standard"],
      ["ELEGOO", "Centauri 2", "standard"],
      ["ELEGOO", "Centauri 2", "CANVAS Combo"],
      ["Anycubic", "Kobra 3", "standard"],
      ["Creality", "K1C", "standard"],
      ["ELEGOO", "Neptune 4 Pro", "Type-C edition"],
      ["ELEGOO", "Neptune 4", "Type-C version"],
      ["Flashforge", "Adventurer 5M", "standard"],
      ["Sovol", "SV08", "standard"],
      ["QIDI Tech", "Plus4", "standard"],
      ["QIDI Tech", "Max4", "standard"],
      ["QIDI Tech", "Q2", "standard"],
      ["QIDI Tech", "Q2", "QIDI Box Combo"],
      ["QIDI Tech", "Plus5", "standard"],
      ["QIDI Tech", "Plus5", "QIDI Box Combo"],
      ["QIDI Tech", "Q2C", "standard"],
      ["QIDI Tech", "Q2C", "QIDI Box Combo"],
      ["Artillery", "M1 Pro", "standard"],
      ["FLSUN", "V400 Max", "standard"],
      ["FLSUN", "S1", "standard"],
      ["FLSUN", "S1 Pro", "standard"],
      ["Raise3D", "Pro3 HS", "standard"],
      ["Formlabs", "Form 4", "standard"],
      ["Phrozen", "Sonic Mighty Revo 16K", "standard"],
      ["Ultimaker", "S7", "standard"],
      ["Snapmaker", "U1", "standard"],
      ["Creality", "Ender-3 V3 KE", "standard"],
      ["ELEGOO", "Saturn 4 Ultra", "12K"],
      ["Anycubic", "Kobra S1", "standard"],
      ["Anycubic", "Kobra S1", "Combo"],
      ["Anycubic", "Kobra 3 Max V2", "standard"],
      ["Anycubic", "Kobra 3 Max V2", "ACE 2 Pro Combo"],
      ["Anycubic", "Kobra X", "standard"],
      ["Anycubic", "Kobra X", "ACE GEN2 + ACE 2 Pro Combo"],
      ["Anycubic", "Kobra 4", "standard"],
      ["Anycubic", "Kobra 4", "ACE 2 Pro Combo"],
      ["Anycubic", "Photon Mono M7", "standard"],
      ["Anycubic", "Photon Mono M7 Pro", "standard"],
      ["Anycubic", "Photon Mono M7 Max", "standard"],
      ["Anycubic", "Photon P1", "standard"],
      ["Bambu Lab", "H2D", "AMS 2 Pro Combo"],
      ["Bambu Lab", "H2D", "standard"],
      ["Bambu Lab", "H2D Pro", "standard"],
      ["Bambu Lab", "P1S", "standard"],
      ["Bambu Lab", "P1S", "Combo"],
      ["Creality", "Ender-3 V3", "standard"],
      ["Creality", "Ender-3 V3 Neo", "standard"],
      ["Creality", "Ender-3 V3 Neo", "CFS nano Combo"],
      ["Creality", "Ender-3 V3 Mega", "standard"],
      ["Creality", "Ender-3 V3 Mega", "CFS nano Combo"],
      ["Creality", "SPARKX i7", "standard"],
      ["Creality", "SPARKX i7", "CFS Lite Color Combo"],
      ["Creality", "SPARKX i7", "CFS Mini AutoFill"],
      ["Creality", "SPARKX i7", "CFS nano Combo"],
      ["Creality", "K2 SE", "standard"],
      ["Creality", "K2 SE", "CFS 4-Color Combo"],
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
    expect(printers).toHaveLength(94);
    expect(new Set(printers.map((printer) => printer.id)).size).toBe(printers.length);
    expect(printers.every((printer) => printer.sources.length > 0)).toBe(true);
  });

  it("distinguishes SPARKX i7 filament system configurations", () => {
    const standard = printers.find((printer) => printer.id === "creality-sparkx-i7");
    const lite = printers.find((printer) => printer.id === "creality-sparkx-i7-cfs-lite");
    const mini = printers.find((printer) => printer.id === "creality-sparkx-i7-cfs-mini");
    const nano = printers.find((printer) => printer.id === "creality-sparkx-i7-cfs-nano");
    const compatibleNozzles = nozzles.filter((nozzle) => nozzle.printerCompatibility?.["creality-sparkx-i7"] === "compatible");

    expect(standard).toMatchObject({ buildVolumeMm: { x: 260, y: 260, z: 255 }, maximumSpeedMmPerSecond: 500, maximumPowerWatts: null });
    expect(standard?.multicolorSlots).toBeNull();
    expect(lite).toMatchObject({ multicolorSystem: "CFS Lite", multicolorSlots: 4, technicalProperties: { cfsLiteIncluded: true, cfsLiteSlots: 4 } });
    expect(mini).toMatchObject({ multicolorSlots: null, multicolorSupported: false, technicalProperties: { includedFilamentSystem: "CFS Mini", cfsMiniSlots: 2 } });
    expect(nano).toMatchObject({ multicolorSystem: "CFS nano", multicolorSlots: 4, technicalProperties: { cfsNanoIncluded: true, cfsNanoSlots: 4 } });
    expect(compatibleNozzles.map(({ diameterMm, material, original }) => ({ diameterMm, material, original }))).toEqual([
      { diameterMm: 0.2, material: "Aço endurecido", original: false },
      { diameterMm: 0.4, material: "Aço endurecido", original: true },
      { diameterMm: 0.6, material: "Aço endurecido", original: false },
      { diameterMm: 0.8, material: "Aço endurecido", original: false },
    ]);
    expect(crealitySparkXI7Migration).toContain("'SPARKX i7', 'CFS Mini AutoFill'");
    expect(crealitySparkXI7Migration).toContain("'SPARKX i7', 'CFS nano Combo'");
    expect(crealitySparkXI7Migration).toContain("'SPARKX i7 hotend'");
  });

  it("keeps K2 SE single-color and CFS configurations distinct", () => {
    const standard = printers.find((printer) => printer.id === "creality-k2-se");
    const combo = printers.find((printer) => printer.id === "creality-k2-se-cfs-combo");

    expect(standard).toMatchObject({
      buildVolumeMm: { x: 220, y: 215, z: 245 },
      maxNozzleTemperatureC: 300,
      maxBedTemperatureC: 100,
      maximumSpeedMmPerSecond: 500,
      multicolorSupported: false,
      technicalProperties: { ratedPowerWatts: 350 },
    });
    expect(combo).toMatchObject({
      multicolorSystem: "CFS",
      multicolorSlots: 4,
      technicalProperties: { cfsIncluded: true, maximumMulticolorFilaments: 16, additionalCfsUnitsForMaximumColors: 3 },
    });
    expect(combo?.supportedMaterials["creality-hp-tpu"]).toMatchObject({ status: "conditional" });
    expect(crealityK2SeMigration).toContain("'K2 SE', 'CFS 4-Color Combo'");
    expect(crealityK2SeMigration).toContain('"additionalCfsUnitsForMaximumColors":3');
  });

  it("keeps Ender-3 V3 Neo and Mega specs and CFS nano bundles distinct", () => {
    const neo = printers.find((printer) => printer.id === "creality-ender-3-v3-neo");
    const neoCombo = printers.find((printer) => printer.id === "creality-ender-3-v3-neo-cfs-nano");
    const mega = printers.find((printer) => printer.id === "creality-ender-3-v3-mega");
    const megaCombo = printers.find((printer) => printer.id === "creality-ender-3-v3-mega-cfs-nano");

    expect(neo).toMatchObject({
      buildVolumeMm: { x: 220, y: 220, z: 220 }, maximumSpeedMmPerSecond: 500,
      multicolorSystem: "CFS nano (vendido separadamente)",
      technicalProperties: { extruder: "Sprite 2 direct drive", builtInCamera: true, supportedTpuHardnessRangeA: [90, 95] },
    });
    expect(neo?.multicolorSlots).toBeNull();
    expect(neoCombo).toMatchObject({ multicolorSystem: "CFS nano", multicolorSlots: 4, technicalProperties: { cfsNanoIncluded: true } });
    expect(mega).toMatchObject({
      buildVolumeMm: { x: 420, y: 420, z: 420 }, maximumSpeedMmPerSecond: 300,
      multicolorSystem: "CFS nano (vendido separadamente)",
      technicalProperties: { maxToolheadSpeedMmPerSecond: 500, autoBedLevelingPoints: 81, supportedTpuHardnessRangeA: [85, 95] },
    });
    expect(megaCombo).toMatchObject({ multicolorSystem: "CFS nano", multicolorSlots: 4, technicalProperties: { cfsNanoIncluded: true } });
    expect(crealityEnderV3NeoMegaMigration).toContain("'Ender-3 V3 Neo', 'CFS nano Combo'");
    expect(crealityEnderV3NeoMegaMigration).toContain("'Ender-3 V3 Mega', 'CFS nano Combo'");
  });

  it("keeps H2D base, AMS combo, and Pro configurations distinct", () => {
    const base = printers.find((printer) => printer.id === "bambu-h2d");
    const combo = printers.find((printer) => printer.id === "bambu-h2d-ams-2-pro-combo");
    const pro = printers.find((printer) => printer.id === "bambu-h2d-pro");

    expect(base).toMatchObject({
      buildVolumeMm: { x: 325, y: 320, z: 325 }, extruders: 2,
      maxNozzleTemperatureC: 350, multicolorSystem: "AMS 2 Pro (vendido separadamente)",
      technicalProperties: { singleNozzleBuildVolumeMm: { x: 325, y: 320, z: 325 } },
    });
    expect(base?.multicolorSlots).toBeNull();
    expect(combo?.multicolorSlots).toBe(4);
    expect(pro).toMatchObject({
      model: "H2D Pro", extruders: 2, maxNozzleTemperatureC: 350,
      multicolorSystem: "AMS 2 Pro + AMS HT",
      technicalProperties: {
        activeChamberHeating: true, activeChamberMaximumTemperatureC: 65,
        nozzleMaterial: "Tungsten carbide", ethernet: true, wpa2EnterpriseWifi: true,
      },
    });
    expect(pro?.buildVolumeMm).toBeNull();
    expect(pro?.multicolorSlots).toBeNull();
    expect(bambuH2dVariantsMigration).toContain("'H2D', 'standard'");
    expect(bambuH2dVariantsMigration).toContain("'H2D Pro', 'standard'");
  });

  it("keeps Kobra X native multicolor separate from the ACE 2 Pro combo and uses its documented nozzles", () => {
    const standard = printers.find((printer) => printer.id === "anycubic-kobra-x");
    const combo = printers.find((printer) => printer.id === "anycubic-kobra-x-ace-2-pro");
    const compatibleNozzles = nozzles.filter((nozzle) => nozzle.printerCompatibility?.["anycubic-kobra-x"] === "compatible");

    expect(standard).toMatchObject({
      buildVolumeMm: { x: 260, y: 260, z: 260 }, maxNozzleTemperatureC: 300, maxBedTemperatureC: 100,
      maximumSpeedMmPerSecond: 600, multicolorSlots: 4, multicolorSystem: "ACE GEN2",
      technicalProperties: { recommendedPrintSpeedMmPerSecond: 300, maximumMulticolorFilaments: 19, extraACE2ProUnitsForMaximumColors: 4 },
    });
    expect(combo).toMatchObject({
      multicolorSlots: 7, multicolorSystem: "ACE GEN2 + ACE 2 Pro",
      technicalProperties: { maximumMulticolorFilaments: 19, extraACE2ProUnitsForMaximumColors: 3 },
    });
    expect(compatibleNozzles.map(({ diameterMm, material, original }) => ({ diameterMm, material, original }))).toEqual([
      { diameterMm: 0.25, material: "Latão", original: false },
      { diameterMm: 0.4, material: "Aço endurecido", original: true },
      { diameterMm: 0.6, material: "Aço endurecido", original: false },
      { diameterMm: 0.8, material: "Aço endurecido", original: false },
    ]);
    expect(nozzles.some((nozzle) => nozzle.printerCompatibility?.["anycubic-kobra-x-ace-2-pro"] === "compatible")).toBe(true);
    expect(anycubicKobraXMigration).toContain("maximumMulticolorFilaments");
    expect(anycubicKobraXMigration).toContain("Anycubic Kobra X quick-release printhead");
  });

  it("keeps S1 Max variants and Photon P1 Max in the local catalog and migration", () => {
    const s1Max = printers.find((printer) => printer.id === "anycubic-kobra-s1-max");
    const s1MaxCombo = printers.find((printer) => printer.id === "anycubic-kobra-s1-max-ace-2-pro");
    const photonP1Max = printers.find((printer) => printer.id === "anycubic-photon-p1-max");
    const s1MaxNozzles = nozzles.filter((nozzle) => nozzle.printerCompatibility?.["anycubic-kobra-s1-max"] === "compatible");

    expect(s1Max).toMatchObject({
      buildVolumeMm: { x: 350, y: 350, z: 350 }, maxNozzleTemperatureC: 350, maxBedTemperatureC: 120,
      maximumSpeedMmPerSecond: 600, multicolorSlots: null,
      technicalProperties: { recommendedPrintSpeedMmPerSecond: 300, activeChamberMaximumTemperatureC: 65, maximumMulticolorFilaments: 16 },
    });
    expect(s1MaxCombo).toMatchObject({ multicolorSystem: "ACE 2 Pro", multicolorSlots: 4, technicalProperties: { maximumMulticolorFilaments: 16, extraACE2ProUnitsForMaximumColors: 3, ace2ProDryingMaxTemperatureC: 65 } });
    expect(s1MaxNozzles.map(({ diameterMm, material, original }) => ({ diameterMm, material, original }))).toEqual([
      { diameterMm: 0.25, material: "Latão", original: false },
      { diameterMm: 0.4, material: "Aço endurecido", original: true },
      { diameterMm: 0.6, material: "Aço endurecido", original: false },
      { diameterMm: 0.8, material: "Aço endurecido", original: false },
    ]);
    expect(photonP1Max).toMatchObject({
      technology: "MSLA", buildVolumeMm: { x: 285.5, y: 214, z: 300 }, maximumPowerWatts: null,
      technicalProperties: { lcdResolution: expect.stringContaining("12K"), xyResolutionMicrons: [24.8, 24.8], resinVatCapacityLiters: 1.9, standardResinPrintSpeedMmPerHour: { min: 15, max: 25, layerHeightMm: 0.05 }, ratedPowerSupplyWatts: 296 },
    });
    expect(anycubicS1MaxMigration).toContain("Anycubic Kobra S1 Max quick-release printhead");
    expect(anycubicS1MaxMigration).toContain("Photon P1 Max");
  });

  it("keeps the Kobra 4 Combo's four-color base and marks TPU conditional for ACE 2 Pro", () => {
    const standard = printers.find((printer) => printer.id === "anycubic-kobra-4");
    const combo = printers.find((printer) => printer.id === "anycubic-kobra-4-ace-2-pro");
    const compatibleNozzles = nozzles.filter((nozzle) => nozzle.printerCompatibility?.["anycubic-kobra-4"] === "compatible");

    expect(standard).toMatchObject({
      buildVolumeMm: { x: 260, y: 260, z: 260 }, maxNozzleTemperatureC: 300, maxBedTemperatureC: 100,
      maximumSpeedMmPerSecond: 600,
    });
    expect(combo).toMatchObject({
      multicolorSystem: "ACE 2 Pro", multicolorSlots: 4,
      supportedMaterials: { TPU: { status: "conditional", conditions: expect.stringContaining("alimentação direta") } },
      technicalProperties: { maximumMulticolorFilaments: 8, eightColorExpansionRequiresAdditionalHardware: true, tpu95aNotCompatibleWithAce2Pro: true },
    });
    expect(compatibleNozzles.map((nozzle) => nozzle.diameterMm)).toEqual([0.25, 0.4, 0.6, 0.8]);
    expect(nozzles.some((nozzle) => nozzle.printerCompatibility?.["anycubic-kobra-4-ace-2-pro"] === "compatible")).toBe(true);
  });

  it("keeps Kobra 3 Max V2 variants and limits its nozzle fit to the V2 hotend", () => {
    const standard = printers.find((printer) => printer.id === "anycubic-kobra-3-max-v2");
    const combo = printers.find((printer) => printer.id === "anycubic-kobra-3-max-v2-ace-2-pro");
    const v2Nozzles = nozzles.filter((nozzle) => nozzle.printerCompatibility?.["anycubic-kobra-3-max-v2"] === "compatible");

    expect(standard).toMatchObject({
      buildVolumeMm: { x: 420, y: 420, z: 500 }, maxNozzleTemperatureC: 300, maxBedTemperatureC: 90,
      maximumSpeedMmPerSecond: 600,
      technicalProperties: { recommendedPrintSpeedMmPerSecond: 300, multicolorUpgradeDescription: expect.stringContaining("ACE 2 Pro") },
    });
    expect(combo).toMatchObject({
      multicolorSystem: "ACE 2 Pro", multicolorSlots: 4,
      technicalProperties: { maximumMulticolorFilaments: 8, ace2ProDryingMaxTemperatureC: 65, tpu95aNotCompatibleWithAce2Pro: true },
    });
    expect(v2Nozzles.map((nozzle) => nozzle.diameterMm)).toEqual([0.25, 0.4, 0.6, 0.8]);
    expect(nozzles.some((nozzle) => nozzle.printerCompatibility?.["anycubic-kobra-3-max-v2-ace-2-pro"] === "compatible")).toBe(true);
  });

  it("keeps Neptune 4 Type-C specifications and its version-specific nozzle compatibility", () => {
    const neptune4 = printers.find((printer) => printer.id === "elegoo-neptune-4-type-c");
    const compatibleNozzles = nozzles.filter((nozzle) => nozzle.printerCompatibility?.["elegoo-neptune-4-type-c"] === "compatible");

    expect(neptune4).toMatchObject({
      buildVolumeMm: { x: 225, y: 225, z: 265 }, filamentDiameterMm: 1.75,
      maxNozzleTemperatureC: 300, maxBedTemperatureC: 110, heatedBed: true,
      maximumSpeedMmPerSecond: null,
      maximumSpeedDescription: expect.stringContaining("deslocamento do cabeçote"),
    });
    expect(compatibleNozzles.map((nozzle) => nozzle.diameterMm)).toEqual([0.4, 0.6, 0.8, 1]);
    expect(compatibleNozzles.every((nozzle) => nozzle.printerCompatibilityConditions?.["elegoo-neptune-4-type-c"]?.includes("Type-C"))).toBe(true);
    expect(elegooNeptune4Migration).toContain("Neptune 4/4 Pro Type-C");
    expect(elegooNeptune4Migration).toContain("0.4, 0.6, 0.8, 1.0");
  });

  it("keeps the H2C's nozzle-specific volumes and optional Vortek-to-AMS filament expansion", () => {
    const h2c = printers.find((printer) => printer.id === "bambu-h2c");
    const h2cNozzles = nozzles.filter((nozzle) => nozzle.printerCompatibility?.["bambu-h2c"] === "compatible");

    expect(h2c).toMatchObject({
      brand: "Bambu Lab", model: "H2C", variant: "standard", buildVolumeMm: { x: 305, y: 320, z: 325 },
      buildVolumeDescription: "305 × 320 × 325 mm (um bico); 300 × 320 × 325 mm (dois bicos); 330 × 320 × 325 mm combinados",
      extruders: 2, maxNozzleTemperatureC: 350, maxBedTemperatureC: 120, heatedBed: true, enclosure: true,
      maximumSpeedMmPerSecond: null, multicolorSlots: 7,
      technicalProperties: {
        activeChamberHeating: true, activeChamberMaximumTemperatureC: 65,
        singleNozzleBuildVolumeMm: { x: 305, y: 320, z: 325 },
        dualNozzleBuildVolumeMm: { x: 300, y: 320, z: 325 },
        combinedNozzleBuildVolumeMm: { x: 330, y: 320, z: 325 },
        interchangeableHotends: 6, maxMulticolorFilamentsWithAms: 24,
      },
    });
    expect(h2cNozzles.map((nozzle) => nozzle.diameterMm)).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(bambuH2cMigration).toContain("'Bambu Lab', 'H2C', 'standard'");
    expect(bambuH2cMigration).toContain("'H2C Vortek hotend'");
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

  it("keeps QIDI Q2 variants, the included four-slot Box, and its distinct compatible nozzle family", () => {
    const q2 = printers.filter((printer) => printer.model === "Q2");
    const q2Nozzles = nozzles.filter((nozzle) => nozzle.printerCompatibility?.["qidi-q2"] === "compatible"
      || nozzle.printerCompatibility?.["qidi-q2-box-combo"] === "compatible");

    expect(q2).toHaveLength(2);
    expect(q2[0]).toMatchObject({
      id: "qidi-q2", variant: "standard", buildVolumeMm: { x: 270, y: 270, z: 256 },
      maximumSpeedMmPerSecond: null, multicolorSystem: "QIDI Box (vendido separadamente)",
    });
    expect(q2[1]).toMatchObject({
      id: "qidi-q2-box-combo", variant: "QIDI Box Combo", multicolorSystem: "QIDI Box", multicolorSlots: 4,
    });
    expect(q2Nozzles).toHaveLength(4);
    expect(q2Nozzles.every((nozzle) => nozzle.printerCompatibility?.["qidi-max4"] === undefined)).toBe(true);
    expect(qidiQ2Migration).toContain("'QIDI Tech', 'Q2', 'QIDI Box Combo'");
    expect(qidiQ2Migration).toContain("and nozzle.model = 'Q2 nozzle'");
  });

  it("keeps QIDI Plus5 variants with verified Q2-family nozzles and toolhead speed semantics", () => {
    const plus5 = printers.filter((printer) => printer.model === "Plus5");
    const compatibleNozzles = nozzles.filter((nozzle) => nozzle.printerCompatibility?.["qidi-plus5"] === "compatible"
      || nozzle.printerCompatibility?.["qidi-plus5-box-combo"] === "compatible");

    expect(plus5).toHaveLength(2);
    expect(plus5[0]).toMatchObject({
      id: "qidi-plus5", variant: "standard", buildVolumeMm: { x: 320, y: 320, z: 300 },
      maxNozzleTemperatureC: 370, maxBedTemperatureC: 120, maximumSpeedMmPerSecond: null,
      multicolorSystem: "QIDI Box (vendido separadamente)",
      technicalProperties: { maxToolheadSpeedMmPerSecond: 600, activeChamberMaximumTemperatureC: 65 },
    });
    expect(plus5[1]).toMatchObject({ id: "qidi-plus5-box-combo", variant: "QIDI Box Combo", multicolorSlots: 4 });
    expect(compatibleNozzles.map((nozzle) => nozzle.diameterMm)).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(compatibleNozzles.every((nozzle) => nozzle.printerCompatibility?.["qidi-q2"] === "compatible"
      && nozzle.printerCompatibility?.["qidi-q2-box-combo"] === "compatible")).toBe(true);
    expect(qidiPlus5Migration).toContain("'QIDI Tech', 'Plus5', 'QIDI Box Combo'");
    expect(qidiPlus5Migration).toContain("'QIDI Q2'");
  });

  it("keeps the QIDI Q2C's differences from Q2 and its four-slot Box Combo", () => {
    const q2c = printers.filter((printer) => printer.model === "Q2C");
    const compatibleNozzles = nozzles.filter((nozzle) => nozzle.printerCompatibility?.["qidi-q2c"] === "compatible"
      || nozzle.printerCompatibility?.["qidi-q2c-box-combo"] === "compatible");

    expect(q2c).toHaveLength(2);
    expect(q2c[0]).toMatchObject({
      id: "qidi-q2c", variant: "standard", buildVolumeMm: { x: 270, y: 270, z: 256 },
      maxNozzleTemperatureC: 370, maxBedTemperatureC: 120, heatedBed: true, enclosure: true,
      maximumSpeedMmPerSecond: null, multicolorSystem: "QIDI Box (vendido separadamente)",
      technicalProperties: { maxToolheadSpeedMmPerSecond: 600, activeChamberHeating: false, camera: "Opcional", airFilter: "Opcional" },
    });
    expect(q2c[1]).toMatchObject({ id: "qidi-q2c-box-combo", variant: "QIDI Box Combo", multicolorSlots: 4 });
    expect(compatibleNozzles.map((nozzle) => nozzle.diameterMm)).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(compatibleNozzles.every((nozzle) => nozzle.printerCompatibility?.["qidi-q2"] === "compatible"
      && nozzle.printerCompatibility?.["qidi-plus5"] === "compatible")).toBe(true);
    expect(qidiQ2cMigration).toContain("'QIDI Tech', 'Q2C', 'QIDI Box Combo'");
    expect(qidiQ2cMigration).toContain("products/q2-bimetal-nozzles2pc");
    expect(qidiQ2cPowerMigration).toContain("maximum_power_w = null");
    expect(qidiQ2cPowerMigration).toContain('"ratedPowerWatts":350');
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

  it("distinguishes Creality K2 without CFS from the included CFS Combo", () => {
    const k2 = printers.find((printer) => printer.id === "creality-k2");
    const combo = printers.find((printer) => printer.id === "creality-k2-cfs-combo");
    const k2Nozzles = nozzles.filter((nozzle) => nozzle.printerCompatibility?.["creality-k2"] === "compatible");

    expect(k2).toMatchObject({
      buildVolumeMm: { x: 260, y: 260, z: 260 }, filamentDiameterMm: 1.75,
      maxNozzleTemperatureC: 300, maxBedTemperatureC: 100, enclosure: true,
      maximumSpeedMmPerSecond: 600, multicolorSlots: null,
      technicalProperties: { maxAccelerationMmPerSecondSquared: 20000, maximumCfsUnits: 4 },
    });
    expect(combo).toMatchObject({
      multicolorSystem: "Creality CFS", multicolorSlots: 4,
      technicalProperties: { includedCfsUnits: 1, maximumCfsUnits: 4, maximumMulticolorFilaments: 16, extraCfsUnitsForMaximumColors: 3 },
    });
    expect(k2Nozzles.map(({ diameterMm, material, original }) => ({ diameterMm, material, original })).sort((left, right) => left.diameterMm - right.diameterMm)).toEqual([
      { diameterMm: 0.2, material: "Aço endurecido", original: false },
      { diameterMm: 0.4, material: "Aço endurecido", original: true },
      { diameterMm: 0.6, material: "Aço endurecido", original: false },
      { diameterMm: 0.8, material: "Aço endurecido", original: false },
    ]);
    expect(k2Nozzles.find((nozzle) => nozzle.original)?.diameterMm).toBe(0.4);
    expect(crealityK2Migration).toContain("'K2', 'CFS Combo'");
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

  it("keeps CORE One L+ hotend versions distinct with exact nozzle and material compatibility", () => {
    const standard = printers.find((item) => item.id === "prusa-core-one-l-plus");
    const ht = printers.find((item) => item.id === "prusa-core-one-l-plus-ht");
    const standardNozzles = nozzles.filter((item) => item.printerCompatibility?.["prusa-core-one-l-plus"] === "compatible");
    const htNozzles = nozzles.filter((item) => item.printerCompatibility?.["prusa-core-one-l-plus-ht"] === "compatible");

    expect(standard).toMatchObject({
      buildVolumeMm: { x: 300, y: 300, z: 330 }, filamentDiameterMm: 1.75,
      maxNozzleTemperatureC: 290, maxBedTemperatureC: 120, enclosure: true, maximumSpeedMmPerSecond: null,
      technicalProperties: { activeChamberHeating: true, activeChamberMaximumTemperatureC: 60, maxNozzleTemperatureWithHighTempHotendC: 400 },
      supportedMaterials: {
        "prusament-pla": { status: "compatible" },
        "prusament-asa": { status: "conditional" },
        "prusament-pa11-cf": { status: "conditional" },
      },
    });
    expect(ht).toMatchObject({
      variant: "HT Hotend", maxNozzleTemperatureC: 400,
      technicalProperties: { includedHotend: "HT Hotend", includedNozzle: "ObXidian 500 endurecido, 0,4 mm" },
    });
    expect(standardNozzles.map((item) => item.diameterMm).sort((a, b) => a - b)).toEqual([0.25, 0.4, 0.4, 0.4, 0.6, 0.8]);
    expect(htNozzles).toEqual([expect.objectContaining({ diameterMm: 0.4, abrasionResistant: true, maxTemperatureC: 400 })]);
    expect(prusaCoreOneLPlusMigration).toContain("'CORE One L+', 'standard'");
    expect(prusaCoreOneLPlusMigration).toContain("'CORE One L+', 'HT Hotend'");
    expect(prusaCoreOneLPlusMigration).toContain("'Prusament PA11 Carbon Fiber'");
    expect(prusaCoreOneLPlusMigration).toContain("'Prusa Nozzle ObXidian 500'");
  });

  it("keeps XL+ single-tool and five-head variants with optional chamber upgrades explicit", () => {
    const singleTool = printers.find((item) => item.id === "prusa-xl-plus-single-tool");
    const fiveHead = printers.find((item) => item.id === "prusa-xl-plus-five-head");
    const expectedProperties = {
      activeChamberHeating: false,
      optionalEnclosureMaximumTemperatureC: 50,
      optionalExternalHeaterMaximumTemperatureC: 60,
    };

    expect(singleTool).toMatchObject({
      model: "XL+", variant: "Single-Tool", buildVolumeMm: { x: 360, y: 360, z: 360 },
      extruders: 1, filamentDiameterMm: 1.75, maxNozzleTemperatureC: 290, maxBedTemperatureC: 115,
      enclosure: false, maximumSpeedMmPerSecond: null, multicolorSlots: null, technicalProperties: expectedProperties,
    });
    expect(fiveHead).toMatchObject({
      model: "XL+", variant: "Five-Head", extruders: 5, multicolorSlots: 5,
      multicolorSystem: "Toolchanger com 5 cabeçotes independentes", technicalProperties: expectedProperties,
    });
    expect(singleTool?.sources[0].url).toBe("https://www.prusa3d.com/product/original-prusa-xl-semi-assembled-single-toolhead-3d-printer/");
    expect(fiveHead?.sources[0].url).toBe("https://www.prusa3d.com/en/product/original-prusa-xl-5-toolhead-3d-printer/");
    expect(prusaXlPlusMigration).toContain("'XL+', 'Single-Tool'");
    expect(prusaXlPlusMigration).toContain("'XL+', 'Five-Head'");
    expect(prusaXlPlusMigration).toContain('"optionalExternalHeaterMaximumTemperatureC":60');
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

  it("includes X1-Carbon and AMS Combo specs while preserving voltage and speed distinctions", () => {
    const standard = printers.find((item) => item.id === "bambu-x1-carbon");
    const combo = printers.find((item) => item.id === "bambu-x1-carbon-ams-combo");
    const x1Nozzles = nozzles.filter((item) => item.printerCompatibility?.["bambu-x1-carbon"] === "compatible");

    expect(standard).toMatchObject({
      buildVolumeMm: { x: 256, y: 256, z: 256 },
      maxNozzleTemperatureC: 300,
      maxBedTemperatureC: null,
      maximumSpeedMmPerSecond: null,
      maximumPowerWatts: null,
      multicolorSlots: null,
      technicalProperties: {
        maxToolheadSpeedMmPerSecond: 500,
        maxBedTemperatureByVoltageC: { "110V": 120, "220V": 110 },
        supportedNozzleDiametersMm: [0.2, 0.4, 0.6, 0.8],
      },
    });
    expect(combo).toMatchObject({ multicolorSlots: 4, technicalProperties: { amsUnitsIncluded: 1, maximumAmsUnits: 4 } });
    expect(x1Nozzles.map((item) => item.diameterMm).sort()).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(x1Nozzles.every((item) => item.abrasionResistant === true)).toBe(true);
    expect(bambuX1CarbonMigration).toContain("'X1-Carbon'");
    expect(bambuX1CarbonMigration).toContain("printer_nozzle_compatibility");
    expect(standard?.supportedMaterials["bambu-pla-basic"]).toMatchObject({ status: "compatible" });
    expect(standard?.supportedMaterials["bambu-petg-hf"]).toMatchObject({ status: "compatible" });
    expect(standard?.supportedMaterials["bambu-ppa-cf"]).toMatchObject({ status: "conditional" });
    expect(combo?.supportedMaterials["bambu-ppa-cf"]).toMatchObject({ status: "conditional" });
    expect(standard?.supportedMaterials["prusament-petg-cf"]).toMatchObject({ status: "compatible" });
    expect(standard?.supportedMaterials["prusament-pa11"]).toMatchObject({ status: "conditional" });
    expect(standard?.supportedMaterials["creality-hp-tpu"]).toMatchObject({ status: "compatible" });
    expect(combo?.supportedMaterials["creality-hp-tpu"]).toMatchObject({ status: "conditional" });
    expect(evaluateCompatibility(standard!, materials.find((item) => item.id === "bambu-pla-basic")!).checks.find((item) => item.key === "material")?.status).toBe("compatible");
    expect(evaluateCompatibility(standard!, materials.find((item) => item.id === "bambu-ppa-cf")!).checks.find((item) => item.key === "material")?.status).toBe("conditional");
    expect(bambuX1CarbonMaterialMigration).toContain("printer_material_compatibility");
    expect(bambuX1CarbonMaterialMigration).toContain("'PPA-CF'");
    expect(bambuX1CarbonAdditionalMaterialMigration).toContain("'Prusament PA11 Carbon Fiber'");
    expect(bambuX1CarbonAdditionalMaterialMigration).toContain("'conditional'");
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

  it("keeps FLSUN S1 volumes and nozzles tied to their exact models", () => {
    const s1 = printers.find((printer) => printer.id === "flsun-s1");
    const s1Pro = printers.find((printer) => printer.id === "flsun-s1-pro");
    const s1Nozzle = nozzles.filter((nozzle) => nozzle.printerCompatibility?.["flsun-s1"] === "compatible");
    const s1ProNozzle = nozzles.filter((nozzle) => nozzle.printerCompatibility?.["flsun-s1-pro"] === "compatible");

    expect(s1).toMatchObject({
      buildVolumeMm: null, buildVolumeDescription: "320 × 320 × 430 mm (geometria do volume não detalhada pela fonte)",
      maxNozzleTemperatureC: 350, maxBedTemperatureC: 120, maximumSpeedMmPerSecond: 1200,
      technicalProperties: { activeChamberHeating: false, maximumChamberTemperatureC: 50, maxAccelerationMmPerSecondSquared: 40000 },
    });
    expect(s1Pro).toMatchObject({
      buildVolumeMm: null, filamentDiameterMm: 1.75, maxNozzleTemperatureC: 350, maxBedTemperatureC: 120,
      technicalProperties: { buildVolumeShape: "cylindrical", buildDiameterMm: 320, buildHeightMm: 430, maximumHeightAtOuterEdgeMm: 383 },
    });
    expect(s1Nozzle).toEqual([expect.objectContaining({ id: "flsun-s1-0.4", diameterMm: 0.4, abrasionResistant: true })]);
    expect(s1ProNozzle).toEqual([expect.objectContaining({ id: "flsun-s1-pro-0.4", diameterMm: 0.4, abrasionResistant: true })]);
    expect(flsunS1SeriesMigration).toContain("('FLSUN', 'S1', 'standard'");
    expect(flsunS1SeriesMigration).toContain("('FLSUN', 'S1 Pro', 'standard'");
    expect(flsunS1SeriesMigration).toContain("and nozzle.model = 'S1 Pro hardened steel nozzle'");
  });

  it("keeps the FLSUN T1 cylindrical volume and factory nozzle explicit", () => {
    const t1 = printers.find((printer) => printer.id === "flsun-t1");

    expect(t1).toMatchObject({
      buildVolumeMm: null, buildVolumeDescription: "Cilíndrico · Ø260 × 330 mm",
      filamentDiameterMm: 1.75, maxNozzleTemperatureC: 300, maxBedTemperatureC: 110,
      maximumSpeedMmPerSecond: 1000, maximumPowerWatts: 400,
      technicalProperties: { buildVolumeShape: "cylindrical", buildDiameterMm: 260, buildHeightMm: 330, originalNozzleMaterial: "latão", originalNozzleDiameterMm: 0.4 },
    });
    expect(nozzles.find((nozzle) => nozzle.id === "flsun-t1-0.4")).toMatchObject({ diameterMm: 0.4, material: "Latão", abrasionResistant: false });
    expect(flsunT1Migration).toContain("'FLSUN', 'T1', 'standard', 'FDM'");
    expect(flsunT1Migration).toContain("T1 brass nozzle");
  });

  it("does not copy unverified T1 specifications onto the T1 Pro", () => {
    const printer = printers.find((entry) => entry.id === "flsun-t1-pro");

    expect(printer).toMatchObject({
      buildVolumeMm: null, buildVolumeDescription: "Cilíndrico · Ø260 × 330 mm",
      maximumSpeedMmPerSecond: 1000, filamentDiameterMm: null, maxNozzleTemperatureC: null,
      technicalProperties: { buildVolumeShape: "cylindrical", buildDiameterMm: 260, buildHeightMm: 330 },
    });
    expect(flsunT1ProMigration).toContain("'FLSUN', 'T1 Pro', 'standard', 'FDM'");
  });

  it("keeps the T1 Max center-to-edge cylinder limit and peak specifications explicit", () => {
    const printer = printers.find((entry) => entry.id === "flsun-t1-max");

    expect(printer).toMatchObject({
      buildVolumeMm: null, buildVolumeDescription: "Cilíndrico · Ø300 × 297 mm (altura máxima de 285 mm nas bordas)",
      filamentDiameterMm: 1.75, maxNozzleTemperatureC: 300, maxBedTemperatureC: 100,
      maximumSpeedMmPerSecond: 1000,
      technicalProperties: { buildVolumeShape: "cylindrical", buildDiameterMm: 300, buildHeightMm: 297, maximumHeightAtOuterEdgeMm: 285, heightLimitAppliesAtCenter: true, accelerationIsPeak: true },
    });
    expect(nozzles.find((nozzle) => nozzle.id === "flsun-t1-max-0.4")).toMatchObject({ diameterMm: 0.4, abrasionResistant: true });
    expect(flsunT1MaxMigration).toContain("'FLSUN', 'T1 Max', 'standard', 'FDM'");
    expect(flsunT1MaxMigration).toContain("T1 Max hardened steel nozzle");
  });

  it("keeps the V400 cylindrical volume and unresolved speed conflict explicit", () => {
    const printer = printers.find((entry) => entry.id === "flsun-v400");

    expect(printer).toMatchObject({
      buildVolumeMm: null, buildVolumeDescription: "Cilíndrico · Ø300 × 410 mm (maior altura anunciada; limite local não detalhado)",
      extruders: 1, maxNozzleTemperatureC: 300, maxBedTemperatureC: 110, maximumSpeedMmPerSecond: null,
      technicalProperties: { buildVolumeShape: "cylindrical", buildDiameterMm: 300, buildHeightMm: 410, heightDefinition: "highestPoint" },
    });
    expect(printer?.maximumSpeedDescription).toContain("600 mm/s");
    expect(printer?.maximumSpeedDescription).toContain("400 mm/s");
    expect(flsunV400Migration).toContain("'FLSUN', 'V400', 'standard', 'FDM'");
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
