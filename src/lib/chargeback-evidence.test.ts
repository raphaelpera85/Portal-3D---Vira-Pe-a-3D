import { describe, expect, it } from "vitest";
import { isChargebackEvidenceBytes, isChargebackEvidencePath, validateChargebackEvidence } from "./chargeback-evidence";

describe("chargeback evidence", () => {
  it("accepts up to ten supported files within the total size limit", () => {
    expect(validateChargebackEvidence([{ name: "nota.pdf", type: "application/pdf", size: 10 * 1024 * 1024 }])).toBeNull();
    expect(validateChargebackEvidence(Array.from({ length: 10 }, (_, i) => ({ name: `${i}.jpg`, type: "image/jpeg", size: 1 })))).toBeNull();
    expect(validateChargebackEvidence(Array.from({ length: 11 }, (_, i) => ({ name: `${i}.jpg`, type: "image/jpeg", size: 1 })))).toContain("10 arquivos");
    expect(validateChargebackEvidence([{ name: "a.pdf", type: "application/pdf", size: 10 * 1024 * 1024 }, { name: "b.pdf", type: "application/pdf", size: 1 }])).toContain("10 MB");
  });

  it("rejects unsupported, mismatched, empty, and malformed files", () => {
    expect(validateChargebackEvidence([{ name: "script.html", type: "text/html", size: 5 }])).not.toBeNull();
    expect(validateChargebackEvidence([{ name: "nota.jpg", type: "application/pdf", size: 5 }])).not.toBeNull();
    expect(validateChargebackEvidence([{ name: "nota.pdf", type: "application/pdf", size: 0 }])).not.toBeNull();
  });

  it("checks file signatures before forwarding evidence", () => {
    expect(isChargebackEvidenceBytes("application/pdf", new Uint8Array([37, 80, 68, 70, 45]))).toBe(true);
    expect(isChargebackEvidenceBytes("application/pdf", new Uint8Array([0, 1, 37, 80, 68, 70, 45]))).toBe(true);
    expect(isChargebackEvidenceBytes("image/png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
    expect(isChargebackEvidenceBytes("image/jpeg", new Uint8Array([255, 216, 255, 1]))).toBe(true);
    expect(isChargebackEvidenceBytes("application/pdf", new Uint8Array([60, 104, 116, 109, 108]))).toBe(false);
    expect(validateChargebackEvidence(null as unknown as [])).not.toBeNull();
  });

  it("allows only generated paths belonging to the selected seller and case", () => {
    const path = "store-1/123456/550e8400-e29b-41d4-a716-446655440000.pdf";
    expect(isChargebackEvidencePath(path, "store-1", "123456")).toBe(true);
    expect(isChargebackEvidencePath(path, "store-2", "123456")).toBe(false);
    expect(isChargebackEvidencePath(path, "store-1", "654321")).toBe(false);
    expect(isChargebackEvidencePath(`${path}/other`, "store-1", "123456")).toBe(false);
  });
});
