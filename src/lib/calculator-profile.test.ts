import { describe, expect, it } from "vitest";
import { mapPrintProfileToCalculator } from "./calculator-profile";

const profile = {
  name: "PLA bicolor",
  materialName: "PLA fosco",
  quantity: 2,
  printHours: 3.5,
  materialGrams: 24,
  materialByColor: [{ color: "#336699", grams: 20 }, { color: "#FFAA00", grams: 4 }],
};

describe("mapPrintProfileToCalculator", () => {
  it("scales profile consumption to enough plates and preserves matching filament prices", () => {
    expect(mapPrintProfileToCalculator(profile, 3, [
      { index: 1, grams: 1, pricePerKg: 99, material: "PLA", color: "#336699" },
    ])).toMatchObject({
      material: "PLA fosco", filamentGrams: 48, printHours: 7,
      slicerMetrics: {
        slicer: "Perfil · PLA bicolor", filamentGrams: 48, printHours: 7,
        filaments: [
          { index: 1, grams: 40, pricePerKg: 99, material: "PLA fosco", color: "#336699" },
          { index: 2, grams: 8, pricePerKg: null, material: "PLA fosco", color: "#FFAA00" },
        ],
      },
    });
  });

  it("adds an unassigned row when the profile total exceeds its color breakdown", () => {
    const result = mapPrintProfileToCalculator({ ...profile, materialByColor: [{ color: "#336699", grams: 20 }] }, 1);
    expect(result?.slicerMetrics.filaments).toHaveLength(2);
    expect(result?.slicerMetrics.filaments[1]).toMatchObject({ grams: 4, color: null, material: "PLA fosco" });
  });

  it("uses the color total when the profile has no overall material weight", () => {
    expect(mapPrintProfileToCalculator({ ...profile, materialGrams: null }, 1)?.filamentGrams).toBe(24);
  });

  it("rejects profiles whose scaled values exceed calculator limits", () => {
    expect(mapPrintProfileToCalculator({ ...profile, materialGrams: 1_000_000 }, 1_000_000)).toBeNull();
  });

  it("rejects profile data where color consumption exceeds the saved total", () => {
    expect(mapPrintProfileToCalculator({ ...profile, materialGrams: 10 }, 1)).toBeNull();
  });
});
