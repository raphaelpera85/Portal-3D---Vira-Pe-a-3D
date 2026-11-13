import { describe, expect, it } from "vitest";
import { isDesignerServiceDeliveryPath, normalizeDesignerServiceDeliveryFiles } from "./designer-service-delivery";

describe("designer service delivery files", () => {
  it("accepts supported 3D deliverables within file and batch limits", () => {
    expect(normalizeDesignerServiceDeliveryFiles([
      { name: "Final model.3mf", size: 2_000_000 },
      { name: "Source.step", size: 1_000_000 },
      { name: "Textures.zip", size: 3_000_000 },
    ])).toEqual([
      { name: "Final model.3mf", size: 2_000_000, extension: "3mf" },
      { name: "Source.step", size: 1_000_000, extension: "step" },
      { name: "Textures.zip", size: 3_000_000, extension: "zip" },
    ]);
  });

  it("rejects unsupported, malformed, oversized, or excessive uploads", () => {
    expect(normalizeDesignerServiceDeliveryFiles([{ name: "script.html", size: 10 }])).toBeNull();
    expect(normalizeDesignerServiceDeliveryFiles([{ name: "../unsafe.stl", size: 10 }])).toBeNull();
    expect(normalizeDesignerServiceDeliveryFiles([{ name: "empty.stl", size: 0 }])).toBeNull();
    expect(normalizeDesignerServiceDeliveryFiles([{ name: "large.3mf", size: 50 * 1024 * 1024 + 1 }])).toBeNull();
    expect(normalizeDesignerServiceDeliveryFiles(Array.from({ length: 11 }, (_, i) => ({ name: `${i}.stl`, size: 1 })))).toBeNull();
    expect(normalizeDesignerServiceDeliveryFiles([{ name: "1.3mf", size: 60 * 1024 * 1024 }, { name: "2.3mf", size: 50 * 1024 * 1024 }])).toBeNull();
  });

  it("accepts only request-scoped UUID object paths with supported extensions", () => {
    const requestId = "8a90f57e-fd2f-4b5e-9849-16dd914c9cb7";
    expect(isDesignerServiceDeliveryPath(requestId, `${requestId}/4d06021f-c27c-43c9-a8f5-d421a48ed48e.3mf`)).toBe(true);
    expect(isDesignerServiceDeliveryPath(requestId, "another-request/4d06021f-c27c-43c9-a8f5-d421a48ed48e.3mf")).toBe(false);
    expect(isDesignerServiceDeliveryPath(requestId, `${requestId}/../../private.3mf`)).toBe(false);
    expect(isDesignerServiceDeliveryPath(requestId, `${requestId}/4d06021f-c27c-43c9-a8f5-d421a48ed48e.pdf`)).toBe(false);
  });
});
