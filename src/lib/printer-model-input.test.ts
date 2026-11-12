import { describe, expect, it } from "vitest";
import { validatePrinterModelInput } from "./printer-model-input";

const model = {
  manufacturer: "Bambu Lab",
  model: "A1 mini",
  variant: "Combo",
  modelYear: "2024",
  technology: "FDM",
  catalogStatus: "published",
  buildVolumeX: "180",
  buildVolumeY: "180",
  buildVolumeZ: "180",
  extruderCount: "",
  filamentDiameter: "1.75",
  nozzleInterface: "",
  originalNozzleDiameter: "0.4",
  maxNozzleTemperature: "300",
  maxBedTemperature: "80",
  heatedBed: "true",
  enclosure: "",
  maxPrintSpeed: "500",
  maximumPower: "150",
  measuredAveragePower: "",
  averagePowerConditions: "",
  multicolorSystem: "AMS lite",
  multicolorFilamentCount: "4",
  technicalProperties: "{}",
  documentationUrl: "https://example.com/manual.pdf",
  sourceUrl: "https://example.com/specs",
  verifiedAt: "2026-11-11",
};

describe("validatePrinterModelInput", () => {
  it("normalizes a sourced printer model for the database", () => {
    expect(validatePrinterModelInput(model)).toMatchObject({
      manufacturer: "Bambu Lab", model: "A1 mini", variant: "Combo", technology: "FDM",
      catalog_status: "published", build_volume_x_mm: 180, extruder_count: null,
      heated_bed: true, enclosure: null, technical_properties: {},
      source_url: "https://example.com/specs", verified_at: "2026-11-11",
    });
  });

  it("keeps incomplete records in draft and requires a verified source to publish", () => {
    expect(validatePrinterModelInput({ ...model, catalogStatus: "draft", sourceUrl: "", verifiedAt: "" })?.catalog_status).toBe("draft");
    expect(validatePrinterModelInput({ ...model, sourceUrl: "", verifiedAt: "" })).toBeNull();
    expect(validatePrinterModelInput({ ...model, sourceUrl: "http://example.com", verifiedAt: "2026-11-11" })).toBeNull();
  });

  it("rejects invalid measurements and non-object technical data", () => {
    expect(validatePrinterModelInput({ ...model, buildVolumeX: "-1" })).toBeNull();
    expect(validatePrinterModelInput({ ...model, maxNozzleTemperature: "0" })).toBeNull();
    expect(validatePrinterModelInput({ ...model, technicalProperties: "[]" })).toBeNull();
    expect(validatePrinterModelInput({ ...model, modelYear: "2101" })).toBeNull();
    expect(validatePrinterModelInput({ ...model, extruderCount: "2.5" })).toBeNull();
    expect(validatePrinterModelInput({ ...model, verifiedAt: "2026-02-30" })).toBeNull();
  });
});
