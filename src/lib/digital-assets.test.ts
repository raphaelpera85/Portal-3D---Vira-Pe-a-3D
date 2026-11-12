import { describe, expect, it } from "vitest";
import { MAX_DIGITAL_MODEL_BYTES, MAX_DIGITAL_PREVIEW_BYTES, validateDigitalAsset, validateDigitalLicense, validateDigitalPreview } from "./digital-assets";

describe("digital asset validation", () => {
  it("accepts only bounded GLB previews for public product pages", () => {
    expect(validateDigitalPreview({ filename: "preview.glb", size: 1024 })).toEqual({ filename: "preview.glb", sizeBytes: 1024 });
    expect(validateDigitalPreview({ filename: "preview.glb", size: MAX_DIGITAL_PREVIEW_BYTES + 1 })).toBeNull();
    expect(validateDigitalPreview({ filename: "modelo.stl", size: 1024 })).toBeNull();
    expect(validateDigitalPreview({ filename: "../preview.glb", size: 1024 })).toBeNull();
  });

  it("accepts only the supported personal and commercial license choices", () => {
    expect(validateDigitalLicense("personal")).toBe("personal");
    expect(validateDigitalLicense("commercial")).toBe("commercial");
    expect(validateDigitalLicense("unlimited")).toBeNull();
  });

  it("accepts an STL or 3MF file with a personal license and optional commercial license", () => {
    expect(validateDigitalAsset({ filename: "modelo.3mf", size: 1024, personalPriceBrl: "19.90", rightsAccepted: "on" }))
      .toEqual({ filename: "modelo.3mf", sizeBytes: 1024, personalPriceBrl: 19.9, commercialPriceBrl: null });
    expect(validateDigitalAsset({ filename: "modelo.stl", size: 2048, personalPriceBrl: "19.90", commercialPriceBrl: "89.90", rightsAccepted: true }))
      .toMatchObject({ commercialPriceBrl: 89.9 });
  });

  it.each([
    { filename: "modelo.exe", size: 1024, personalPriceBrl: "19.90", rightsAccepted: true },
    { filename: "modelo.stl", size: MAX_DIGITAL_MODEL_BYTES + 1, personalPriceBrl: "19.90", rightsAccepted: true },
    { filename: "modelo.stl", size: 1024, personalPriceBrl: "0", rightsAccepted: true },
    { filename: "modelo.stl", size: 1024, personalPriceBrl: "19.999", rightsAccepted: true },
    { filename: "modelo.stl", size: 1024, personalPriceBrl: "19.90", commercialPriceBrl: "abc", rightsAccepted: true },
    { filename: "modelo.stl", size: 1024, personalPriceBrl: "19.90", rightsAccepted: false },
  ])("rejects unsafe or incomplete asset data %#", (input) => {
    expect(validateDigitalAsset(input)).toBeNull();
  });
});
