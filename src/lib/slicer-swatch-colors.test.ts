import { describe, expect, it } from "vitest";
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
