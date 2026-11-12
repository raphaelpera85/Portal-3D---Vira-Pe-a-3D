import { describe, expect, it } from "vitest";
import { validateCustomPrintRequest } from "./custom-print-request";

const validRequest = {
  uploadId: "2c9f3718-9f16-4db5-bf3f-a483705bd2a1",
  materialId: "6b5e6b25-daf4-43a3-bfcc-30c0273886d4",
  quantity: "3",
  scalePercent: "125",
  dimensionsX: "40",
  dimensionsY: "35.5",
  dimensionsZ: "22",
  color: "Azul",
  quality: "fine",
  dueDate: "2030-05-30",
  notes: "Acabamento uniforme",
};

describe("validateCustomPrintRequest", () => {
  it("normalizes a complete print request without changing the measured model dimensions", () => {
    expect(validateCustomPrintRequest(validRequest, "2030-05-01")).toEqual({
      uploadId: validRequest.uploadId,
      materialId: validRequest.materialId,
      quantity: 3,
      scalePercent: 125,
      dimensionsMm: { x: 40, y: 35.5, z: 22 },
      color: "Azul",
      quality: "fine",
      dueDate: "2030-05-30",
      notes: "Acabamento uniforme",
    });
  });

  it("rejects malformed IDs, nonpositive dimensions, excessive scale, and past deadlines", () => {
    expect(validateCustomPrintRequest({ ...validRequest, uploadId: "not-a-uuid" }, "2030-05-01")).toBeNull();
    expect(validateCustomPrintRequest({ ...validRequest, dimensionsZ: "0" }, "2030-05-01")).toBeNull();
    expect(validateCustomPrintRequest({ ...validRequest, scalePercent: "1001" }, "2030-05-01")).toBeNull();
    expect(validateCustomPrintRequest({ ...validRequest, dueDate: "2030-04-30" }, "2030-05-01")).toBeNull();
  });

  it("rejects unrecognized quality and oversized buyer notes", () => {
    expect(validateCustomPrintRequest({ ...validRequest, quality: "instant" }, "2030-05-01")).toBeNull();
    expect(validateCustomPrintRequest({ ...validRequest, notes: "x".repeat(1001) }, "2030-05-01")).toBeNull();
  });
});
