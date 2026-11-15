import { describe, expect, it } from "vitest";
import { validateSlicerOcrFileSelections, validateSlicerOcrImages, type OcrImageInput } from "./ocr-image-validation";

const png: OcrImageInput = { type: "image/png", size: 8, bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) };

describe("validateSlicerOcrImages", () => {
  it("accepts a supported image with a matching file signature", () => {
    expect(validateSlicerOcrImages([png])).toBeNull();
  });

  it("rejects unsupported, oversized, and mismatched file content", () => {
    expect(validateSlicerOcrImages([])).toContain("1 a 3");
    expect(validateSlicerOcrImages([{ ...png, type: "image/svg+xml" }])).toContain("PNG, JPEG ou WebP");
    expect(validateSlicerOcrImages([{ ...png, size: 2 * 1024 * 1024 + 1 }])).toContain("até 2 MiB");
    expect(validateSlicerOcrImages([{ ...png, bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) }])).toContain("válidas");
  });
});

describe("validateSlicerOcrFileSelections", () => {
  it("rejects unsupported, oversized, and excessive screenshot selections before upload", () => {
    expect(validateSlicerOcrFileSelections([])).toContain("1 a 3");
    expect(validateSlicerOcrFileSelections([{ type: "image/gif", size: 100 }])).toContain("PNG, JPEG ou WebP");
    expect(validateSlicerOcrFileSelections([{ type: "image/png", size: 2 * 1024 * 1024 + 1 }])).toContain("até 2 MiB");
    expect(validateSlicerOcrFileSelections(Array.from({ length: 3 }, () => ({ type: "image/png", size: 1.5 * 1024 * 1024 })))).toContain("excede 4 MiB");
  });
});
