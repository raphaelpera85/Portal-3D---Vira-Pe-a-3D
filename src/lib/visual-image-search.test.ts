import { describe, expect, it } from "vitest";
import { differenceHash, rankVisualCandidates } from "./visual-image-search";

function pixelsFromColumns(columns: number[]) {
  const pixels = new Uint8ClampedArray(9 * 8 * 4);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 9; x++) {
      const offset = (y * 9 + x) * 4;
      pixels[offset] = columns[x];
      pixels[offset + 1] = columns[x];
      pixels[offset + 2] = columns[x];
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

describe("visual image search", () => {
  it("creates a 64-bit difference hash from a 9 by 8 grayscale image", () => {
    expect(differenceHash(pixelsFromColumns([255, 224, 192, 160, 128, 96, 64, 32, 0]))).toBe("ffffffffffffffff");
    expect(differenceHash(pixelsFromColumns([0, 32, 64, 96, 128, 160, 192, 224, 255]))).toBe("0000000000000000");
  });

  it("ranks visual candidates by hash distance and applies the selected category", () => {
    const matches = rankVisualCandidates("0000000000000000", [
      { id: "far", name: "Distante", image: "/far.png", categorySlug: "chaveiros", tags: [], hash: "ffffffffffffffff" },
      { id: "near", name: "Próximo", image: "/near.png", categorySlug: "chaveiros", tags: [], hash: "0000000000000001" },
      { id: "other", name: "Outra categoria", image: "/other.png", categorySlug: "infantil", tags: [], hash: "0000000000000000" },
    ], "chaveiros", 2);

    expect(matches.map(({ id, distance }) => [id, distance])).toEqual([["near", 1], ["far", 64]]);
  });
});
