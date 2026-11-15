import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { recognizeSlicerImages } from "./google-vision-ocr";
import { mergeSlicerFilamentColors, sampleSlicerFilamentColors } from "./slicer-swatch-colors";

describe("slicer filament swatch colors", () => {
  it("samples the small swatch beside the OCR-recognized filament row", () => {
    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4).fill(45);
    for (let y = 49; y <= 51; y++) for (let x = 50; x <= 52; x++) {
      const offset = (y * width + x) * 4;
      data.set([228, 189, 104, 255], offset);
    }

    expect(sampleSlicerFilamentColors({ width, height, data }, [{ index: 1, x: 0.6, y: 0.5, height: 0.1 }]))
      .toEqual([{ index: 1, color: "#e4bd68" }]);
  });

  it("reads all five color swatches from the Anycubic screenshot fixture", async () => {
    const bytes = readFileSync(new URL("./fixtures/anycubic-slicer-next-filament-panel.png", import.meta.url));
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rowY = [80, 124, 167, 209, 252];
    const words = rowY.map((y, index) => ({
      symbols: [{ text: String(index + 1) }],
      boundingBox: { vertices: [
        { x: 58, y: y - 7 }, { x: 66, y: y - 7 }, { x: 66, y: y + 7 }, { x: 58, y: y + 7 },
      ] },
    }));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ responses: [{
      fullTextAnnotation: { text: "Anycubic Slicer Next", pages: [{
        width: info.width, height: info.height, blocks: [{ paragraphs: [{ words }] }],
      }] },
    }] }), { status: 200 }));
    const [recognized] = await recognizeSlicerImages([{ content: new Uint8Array(bytes), mimeType: "image/png" }], "test-key", fetcher);

    expect(recognized.filamentRows).toHaveLength(5);
    expect(sampleSlicerFilamentColors({ width: info.width, height: info.height, data: new Uint8ClampedArray(data) }, recognized.filamentRows)).toEqual([
      { index: 1, color: "#e4bd68" }, { index: 2, color: "#47a2fc" }, { index: 3, color: "#c12e1f" },
      { index: 4, color: "#6f5034" }, { index: 5, color: "#d4b996" },
    ]);
  });

  it("does not mistake the dark slicer panel for a filament color", () => {
    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4).fill(45);

    expect(sampleSlicerFilamentColors({ width, height, data }, [{ index: 1, x: 0.6, y: 0.5, height: 0.1 }])).toEqual([]);
  });

  it("fills only missing filament colors and keeps colors recognized in text", () => {
    expect(mergeSlicerFilamentColors([
      { index: 1, color: null }, { index: 2, color: "blue" },
    ], [{ index: 1, color: "#e4bd68" }, { index: 3, color: "#c12e1f" }])).toEqual([
      { index: 1, color: "#e4bd68" }, { index: 2, color: "blue" },
    ]);
  });
});
