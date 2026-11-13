import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TechnicalCatalog } from "./technical-catalog";
import { mapTechnicalCatalog } from "../lib/technical-catalog-data";

describe("TechnicalCatalog manufacturer conditions", () => {
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
        technical_properties: { activeChamberHeating: false, camera: "Opcional", airFilter: "Opcional", ratedPowerWatts: 350 },
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
    expect(markup).not.toContain("Potência média medida</dt><dd>350 W");
  });
});
