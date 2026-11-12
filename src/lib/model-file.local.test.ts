import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { readThreeMfPackage } from "./model-file";

it("reads painted triangles from the user's Painted.3mf sample", async () => {
  const { colors } = await readThreeMfPackage(new Uint8Array(readFileSync("D:/Users/Raphael/Pictures/3D/Painted.3mf")));
  const paintedComponent = colors.componentTriangleColors[1][0];
  expect(colors.paintPaletteColors).toContain("ff8000");
  expect(paintedComponent.filter(Boolean)).toHaveLength(3347);
});
