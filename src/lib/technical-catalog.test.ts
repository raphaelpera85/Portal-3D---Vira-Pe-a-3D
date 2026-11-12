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
});
