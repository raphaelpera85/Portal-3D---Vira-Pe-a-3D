import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TechnicalCatalog } from "./technical-catalog";
import { mapTechnicalCatalog } from "../lib/technical-catalog-data";

describe("TechnicalCatalog manufacturer conditions", () => {
  it("shows a known non-multicolor configuration instead of calling it unknown", () => {
    const catalog = mapTechnicalCatalog(
      [{
        id: "sparkx-mini", manufacturer: "Creality", model: "SPARKX i7", variant: "CFS Mini AutoFill", technology: "FDM",
        multicolor_system: null, multicolor_filament_count: null,
        technical_properties: { multicolorSupported: false, includedFilamentSystem: "CFS Mini", cfsMiniSlots: 2 },
        source_url: "https://example.com/sparkx", verified_at: "2026-11-14",
      }],
      [{ id: "pla", manufacturer: "Creality", product: "PLA", family: "PLA", process: "filament", source_url: "https://example.com/pla", verified_at: "2026-11-14" }],
      [], [], [],
    );

    const markup = renderToStaticMarkup(<TechnicalCatalog {...catalog} notice={null} />);
    expect(markup).toContain("Não oferece impressão multicolor nesta configuração");
  });

  it("shows supported filaments, material/nozzle conditions and model-specific nozzle restrictions", () => {
    const catalog = mapTechnicalCatalog(
      [{
        id: "ad5x", manufacturer: "Flashforge", model: "AD5X", variant: "standard", technology: "FDM",
        build_volume_x_mm: 220, build_volume_y_mm: 220, build_volume_z_mm: 220,
        multicolor_system: "Intelligent Filament System (IFS)", multicolor_filament_count: 4,
        technical_properties: {
          manufacturerSupportedMaterials: ["PLA", "TPU 95A"],
          materialNozzleConditions: { "TPU 95A": "0,4/0,6/0,8 mm; não compatível com IFS" },
          manufacturerSpecificationNotes: ["A fonte classifica o conjunto de bico a 280 °C."],
        }, source_url: "https://example.com/ad5x", verified_at: "2026-11-13",
      }],
      [{ id: "pla", manufacturer: "Flashforge", product: "PLA", family: "PLA", process: "filament", source_url: "https://example.com/pla", verified_at: "2026-11-13" }],
      [{ id: "nozzle-04", manufacturer: "Flashforge", model: "AD5X nozzle", diameter_mm: 0.4, original: true, source_url: "https://example.com/nozzle", verified_at: "2026-11-13" }],
      [],
      [{ printer_id: "ad5x", nozzle_id: "nozzle-04", fit: "compatible", conditions: "TPU 95A apenas em cor única; não usar pelo IFS." }],
    );

    const markup = renderToStaticMarkup(<TechnicalCatalog {...catalog} notice={null} />);
    expect(markup).toContain("Filamentos citados pelo fabricante: PLA · TPU 95A");
    expect(markup).toContain("TPU 95A: 0,4/0,6/0,8 mm; não compatível com IFS");
    expect(markup).toContain("A fonte classifica o conjunto de bico a 280 °C.");
    expect(markup).toContain("TPU 95A apenas em cor única; não usar pelo IFS.");
  });

  it("shows the Q2C's chamber, camera, filter and rated power without calling it measured consumption", () => {
    const catalog = mapTechnicalCatalog(
      [{
        id: "q2c", manufacturer: "QIDI Tech", model: "Q2C", variant: "standard", technology: "FDM",
        build_volume_x_mm: 270, build_volume_y_mm: 270, build_volume_z_mm: 256,
        maximum_power_w: null,
        technical_properties: { activeChamberHeating: false, camera: "Opcional", airFilter: "Opcional", ratedPowerWatts: 350, maximumMulticolorFilamentsWithExtraBoxes: 16 },
        source_url: "https://example.com/q2c", verified_at: "2026-11-13",
      }],
      [{ id: "pla", manufacturer: "QIDI Tech", product: "PLA", family: "PLA", process: "filament", source_url: "https://example.com/pla", verified_at: "2026-11-13" }],
      [{ id: "nozzle", manufacturer: "QIDI Tech", model: "Q2 nozzle", diameter_mm: 0.4, original: true, source_url: "https://example.com/nozzle", verified_at: "2026-11-13" }],
      [],
      [{ printer_id: "q2c", nozzle_id: "nozzle", fit: "compatible" }],
    );

    const markup = renderToStaticMarkup(<TechnicalCatalog {...catalog} notice={null} />);
    expect(markup).toContain("Aquecimento ativo da câmara");
    expect(markup).toContain(">Não<");
    expect(markup).toContain("Câmera");
    expect(markup).toContain("Filtro de ar");
    expect(markup).toContain("Potência nominal");
    expect(markup).toContain("350 W");
    expect(markup).toContain("Até 16 filamentos com caixas adicionais");
    expect(markup).not.toContain("Potência média medida</dt><dd>350 W");
  });

  it("renders chamber temperatures from the catalog's supported field names", () => {
    for (const [key, temperature] of [["maximumChamberTemperatureC", 65], ["chamberMaximumTemperatureC", 55], ["activeChamberMaximumTemperatureC", 60]] as const) {
      const catalog = mapTechnicalCatalog(
        [{
          id: key, manufacturer: "Bambu Lab", model: "H2S", variant: "standard", technology: "FDM",
          technical_properties: { [key]: temperature }, source_url: "https://example.com/h2s", verified_at: "2026-11-13",
        }],
        [{ id: "pla", manufacturer: "Bambu Lab", product: "PLA", family: "PLA", process: "filament", source_url: "https://example.com/pla", verified_at: "2026-11-13" }],
        [{ id: "nozzle", manufacturer: "Bambu Lab", model: "H2S nozzle", diameter_mm: 0.4, original: true, source_url: "https://example.com/nozzle", verified_at: "2026-11-13" }],
        [],
        [{ printer_id: key, nozzle_id: "nozzle", fit: "compatible" }],
      );

      const markup = renderToStaticMarkup(<TechnicalCatalog {...catalog} notice={null} />);
      expect(markup).toContain(`<dt>Câmara ativa máxima</dt><dd>${temperature} °C</dd>`);
    }
  });

  it("shows the H2D's single, dual and combined nozzle build volumes separately", () => {
    const catalog = mapTechnicalCatalog(
      [{
        id: "h2d", manufacturer: "Bambu Lab", model: "H2D", variant: "AMS 2 Pro Combo", technology: "FDM",
        build_volume_x_mm: 325, build_volume_y_mm: 320, build_volume_z_mm: 325,
        technical_properties: {
          singleNozzleBuildVolumeMm: { x: 325, y: 320, z: 325 },
          dualNozzleBuildVolumeMm: { x: 300, y: 320, z: 325 },
          combinedNozzleBuildVolumeMm: { x: 350, y: 320, z: 325 },
        }, source_url: "https://example.com/h2d", verified_at: "2026-11-13",
      }],
      [{ id: "pla", manufacturer: "Bambu Lab", product: "PLA", family: "PLA", process: "filament", source_url: "https://example.com/pla", verified_at: "2026-11-13" }],
      [{ id: "nozzle", manufacturer: "Bambu Lab", model: "H2D nozzle", diameter_mm: 0.4, original: true, source_url: "https://example.com/nozzle", verified_at: "2026-11-13" }],
      [],
      [{ printer_id: "h2d", nozzle_id: "nozzle", fit: "compatible" }],
    );

    const markup = renderToStaticMarkup(<TechnicalCatalog {...catalog} notice={null} />);
    expect(markup).toContain("Volume útil · 1 bico</dt><dd>325 × 320 × 325 mm");
    expect(markup).toContain("Volume útil · 2 bicos</dt><dd>300 × 320 × 325 mm");
    expect(markup).toContain("Volume útil combinado</dt><dd>350 × 320 × 325 mm");
    expect(markup).not.toContain("<dt>Volume útil</dt>");
  });
});
