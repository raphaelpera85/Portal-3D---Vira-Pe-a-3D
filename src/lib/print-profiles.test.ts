import { describe, expect, it } from "vitest";
import { validatePrintProfile } from "./print-profiles";

const sample = {
  productId: "123e4567-e89b-42d3-a456-426614174000",
  name: "PLA detalhado",
  profileType: "detailed",
  printerName: "A1 mini",
  materialName: "PLA fosco",
  nozzleName: "0,4 mm",
  layerHeightMm: "0,12",
  infillPercent: "15",
  wallCount: "3",
  supports: "on",
  orientation: "deitado",
  scalePercent: "100",
  quantity: "2",
  printHours: "3,5",
  materialGrams: "24",
  materialByColor: "#336699; 20\n#FFAA00; 4",
};

describe("validatePrintProfile", () => {
  it("validates slicer settings and parses optional per-color material consumption", () => {
    expect(validatePrintProfile(sample)).toEqual({
      productId: sample.productId,
      name: "PLA detalhado",
      profileType: "detailed",
      sharingScope: "private",
      printerId: null,
      printerName: "A1 mini",
      materialId: null,
      materialName: "PLA fosco",
      nozzleId: null,
      nozzleName: "0,4 mm",
      layerHeightMm: 0.12,
      infillPercent: 15,
      wallCount: 3,
      supports: true,
      orientation: "deitado",
      scalePercent: 100,
      quantity: 2,
      printHours: 3.5,
      materialGrams: 24,
      materialByColor: [{ color: "#336699", grams: 20, lengthMeters: null }, { color: "#FFAA00", grams: 4, lengthMeters: null }],
    });
  });

  it("accepts per-color lengths with optional grams and keeps legacy rows compatible", () => {
    expect(validatePrintProfile({ ...sample, materialByColor: "#336699; 20; 4,8\n#FFAA00; ; 1,2" })?.materialByColor).toEqual([
      { color: "#336699", grams: 20, lengthMeters: 4.8 }, { color: "#FFAA00", grams: null, lengthMeters: 1.2 },
    ]);
    expect(validatePrintProfile({ ...sample, materialByColor: "#336699; 20" })?.materialByColor).toEqual([
      { color: "#336699", grams: 20, lengthMeters: null },
    ]);
  });

  it("rejects unsafe quantities, invalid catalog references, and color totals above the total", () => {
    expect(validatePrintProfile({ ...sample, quantity: "1,5" })).toBeNull();
    expect(validatePrintProfile({ ...sample, materialId: "invalid-id" })).toBeNull();
    expect(validatePrintProfile({ ...sample, materialByColor: "#336699; 25" })).toBeNull();
    expect(validatePrintProfile({ ...sample, materialByColor: "#336699; 20\n#336699; 2" })).toBeNull();
    expect(validatePrintProfile({ ...sample, materialByColor: "#336699; ; " })).toBeNull();
    expect(validatePrintProfile({ ...sample, materialByColor: "#336699; 20; 1000000000,001" })).toBeNull();
  });

  it("accepts catalog selections without requiring duplicate manual names", () => {
    expect(validatePrintProfile({ ...sample, printerId: "123e4567-e89b-42d3-a456-426614174001", printerName: "", materialId: "123e4567-e89b-42d3-a456-426614174002", materialName: "", nozzleId: "123e4567-e89b-42d3-a456-426614174003", nozzleName: "" })).toMatchObject({
      printerId: "123e4567-e89b-42d3-a456-426614174001",
      materialId: "123e4567-e89b-42d3-a456-426614174002",
      nozzleId: "123e4567-e89b-42d3-a456-426614174003",
    });
  });

  it("allows community submissions but never accepts official publication from a maker", () => {
    expect(validatePrintProfile({ ...sample, sharingScope: "community" })?.sharingScope).toBe("community");
    expect(validatePrintProfile({ ...sample, sharingScope: "official" })).toBeNull();
  });
});
