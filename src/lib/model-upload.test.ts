import { describe, expect, it } from "vitest";
import { prepareModelUploadFiles } from "./model-upload";

describe("private model upload manifest", () => {
  it("keeps the accepted file names and sizes while removing path separators", () => {
    expect(prepareModelUploadFiles([
      { name: "../Peça.stl", size: 120, type: "model/stl" },
      { name: "Peça.mtl", size: 30, type: "text/plain" },
    ])).toEqual({ error: null, files: [
      { name: ".._Peça.stl", storage_name: "_Peca.stl", size: 120 },
      { name: "Peça.mtl", storage_name: "Peca.mtl", size: 30 },
    ] });
  });

  it("rejects ambiguous associated file names and invalid model bundles", () => {
    expect(prepareModelUploadFiles([
      { name: "scene.obj", size: 20, type: "" },
      { name: "parts/mesh.mtl", size: 20, type: "" },
      { name: "parts\\mesh.mtl", size: 20, type: "" },
    ]).error).toContain("mesmo nome");
    expect(prepareModelUploadFiles([{ name: "scene.pdf", size: 20, type: "application/pdf" }]).error).toContain("modelo principal");
  });
});
