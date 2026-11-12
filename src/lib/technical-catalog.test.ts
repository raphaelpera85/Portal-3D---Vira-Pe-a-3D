import { describe, expect, it } from "vitest";
import { evaluateCompatibility } from "./compatibility";
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
});
