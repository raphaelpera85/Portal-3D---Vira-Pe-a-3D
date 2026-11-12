import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { exceedsThreeMfExpansionLimit, formatModelDimensions, getModelColorMatchedComponentIds, getModelFormat, MAX_THREE_MF_UNCOMPRESSED_BYTES, modelUnitToMeters, parseThreeMfColors, parseThreeMfUnit, readThreeMfUnit, validateModelFile, validateModelFiles } from "./model-file";

describe("model upload validation", () => {
  it("accepts STL, OBJ, 3MF, GLB and GLTF files under the size limit", () => {
    expect(validateModelFile({ name: "part.STL", size: 10 })).toBeNull();
    expect(validateModelFile({ name: "part.obj", size: 10 })).toBeNull();
    expect(validateModelFile({ name: "part.3mf", size: 10 })).toBeNull();
    expect(validateModelFile({ name: "part.glb", size: 10 })).toBeNull();
    expect(validateModelFile({ name: "part.gltf", size: 10 })).toBeNull();
    expect(getModelFormat("part.3MF")).toBe("3mf");
    expect(validateModelFile({ name: "part.gcode", size: 10 })).toContain("STL, OBJ, 3MF, GLB ou GLTF");
  });

  it("rejects files above 20 MB", () => {
    expect(validateModelFile({ name: "part.stl", size: 20 * 1024 * 1024 + 1 })).toContain("20 MB");
  });

  it("accepts one model with its external OBJ companions within the aggregate limit", () => {
    expect(validateModelFiles([
      { name: "part.obj", size: 100 },
      { name: "part.mtl", size: 200 },
      { name: "texture.png", size: 300 },
    ])).toBeNull();
  });

  it("requires a single model and rejects unsupported companion files", () => {
    expect(validateModelFiles([{ name: "a.stl", size: 10 }, { name: "b.glb", size: 10 }])).toContain("um modelo");
    expect(validateModelFiles([{ name: "part.obj", size: 10 }, { name: "readme.txt", size: 10 }])).toContain("não é compatível");
  });

  it("applies the file-size limit to the model and all companions together", () => {
    expect(validateModelFiles([
      { name: "scene.gltf", size: 10 },
      { name: "scene.bin", size: 20 * 1024 * 1024 },
    ])).toContain("conjunto");
  });
});

describe("model dimensions", () => {
  it("converts confirmed model units to glTF meters", () => {
    expect(modelUnitToMeters("mm")).toBe(0.001);
    expect(modelUnitToMeters("in")).toBe(0.0254);
    expect(modelUnitToMeters("m")).toBe(1);
  });

  it("converts GLB meters to the selected unit and applies proportional scale", () => {
    expect(formatModelDimensions({ x: 0.1, y: 0.2, z: 0.3 }, "m", "mm", 0.5)).toEqual({
      x: 50,
      y: 100,
      z: 150,
    });
  });

  it("keeps STL coordinates in the explicitly selected unit", () => {
    expect(formatModelDimensions({ x: 10, y: 20.555, z: 30 }, "mm", "mm", 1)).toEqual({
      x: 10,
      y: 20.56,
      z: 30,
    });
  });

  it("converts 3MF inch coordinates to millimeters", () => {
    expect(formatModelDimensions({ x: 1, y: 2, z: 3 }, "in", "mm", 1)).toEqual({
      x: 25.4,
      y: 50.8,
      z: 76.2,
    });
  });

  it("reads a 3MF unit and defaults to millimeters when omitted", () => {
    expect(parseThreeMfUnit('<model unit="inch" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">')).toBe("in");
    expect(parseThreeMfUnit("<model>")).toBe("mm");
    expect(parseThreeMfUnit('<model unit="league">')).toBeNull();
  });

  it("maps Bambu filament slots to build objects and named parts", () => {
    const colors = parseThreeMfColors(
      '<model><resources><object id="2" name="Holder"><components><component objectid="3"/><component objectid="4"/></components></object></resources><build><item objectid="2" /></build></model>',
      '<config><object id="2"><metadata key="name" value="Holder"/><metadata key="extruder" value="1"/><part id="4"><metadata key="name" value="Icon"/><metadata key="extruder" value="2"/><mesh_stat face_count="12"/></part><part id="5"><metadata key="name" value="Mark"/><metadata key="extruder" value="3"/></part></object></config>',
      JSON.stringify({ filament_colour: ["#ff0000", "#00ff00", "#0000ff"] }),
    );
    expect(colors.objectColors).toEqual(["ff0000"]);
    expect(colors.namedColors).toEqual({ Holder: "ff0000", Icon: "00ff00", Mark: "0000ff" });
    expect(colors.faceColors).toEqual({ 12: ["00ff00"] });
    expect(colors.componentPartColors).toEqual([["00ff00", "0000ff"]]);
    expect(colors.palette).toEqual(["ff0000", "00ff00", "0000ff"]);
  });

  it("maps painted Bambu child objects to their root components", () => {
    const colors = parseThreeMfColors(
      '<model><resources><object id="2"><components><component objectid="3" p:path="/3D/Objects/paint.model"/></components></object></resources><build><item objectid="2"/></build></model>',
      '<config><object id="2"><metadata key="extruder" value="1"/></object></config>',
      JSON.stringify({ filament_colour: ["#ff0000", "#00ff00", "#0000ff"] }),
      [{ path: "3D/Objects/paint.model", xml: '<model><resources><object id="3"><mesh><triangles><triangle paint_color="0C"/><triangle paint_color="0C"/></triangles></mesh></object></resources></model>' }],
    );
    expect(colors.objectColors).toEqual(["ff0000"]);
    expect(colors.componentPaintColors).toEqual([["0000ff"]]);
    expect(colors.paintPaletteColors).toEqual(["0000ff"]);
  });

  it("preserves per-triangle paint colors in geometry order", () => {
    const colors = parseThreeMfColors(
      '<model><resources><object id="2"><components><component objectid="3" p:path="/3D/Objects/paint.model"/></components></object></resources><build><item objectid="2"/></build></model>',
      "",
      JSON.stringify({ filament_colour: ["#ff0000", "#00ff00", "#0000ff"] }),
      [{ path: "3D/Objects/paint.model", xml: '<model><resources><object id="3"><mesh><triangles><triangle paint_color="0C"/><triangle/></triangles></mesh></object></resources></model>' }],
    );
    expect(colors.componentTriangleColors).toEqual([[ ["0000ff", ""] ]]);
  });

  it("maps painted Bambu components stored inside the main model package", () => {
    const modelXml = '<model><resources><object id="2"><components><component objectid="3"/></components></object><object id="3"><mesh><triangles><triangle paint_color="4"/></triangles></mesh></object></resources><build><item objectid="2"/></build></model>';
    const colors = parseThreeMfColors(
      modelXml,
      "",
      JSON.stringify({ filament_colour: ["#ff0000"] }),
      [{ path: "3D/3dmodel.model", xml: modelXml }],
    );
    expect(colors.componentTriangleColors).toEqual([[ ["ff0000"] ]]);
  });

  it("reads multi-color Bambu selectors into the palette without flattening the component", () => {
    const colors = parseThreeMfColors(
      '<model><resources><object id="2"><components><component objectid="3" p:path="/3D/Objects/paint.model"/></components></object></resources><build><item objectid="2"/></build></model>',
      '<config><object id="2"><metadata key="extruder" value="1"/></object></config>',
      JSON.stringify({ filament_colour: ["#ff0000", "#00ff00"] }),
      [{ path: "3D/Objects/paint.model", xml: '<model><resources><object id="3"><mesh><triangles><triangle paint_color="418"/></triangles></mesh></object></resources></model>' }],
    );
    expect(colors.componentPaintColors).toEqual([[""]]);
    expect(colors.componentTriangleColors).toEqual([[ [""] ]]);
    expect(colors.paintPaletteColors).toEqual(["ff0000", "00ff00"]);
  });

  it("reads the unit from the 3MF model inside its zip package", async () => {
    const archive = zipSync({ "3D/3dmodel.model": strToU8('<model unit="inch"/>') });
    await expect(readThreeMfUnit(archive)).resolves.toBe("in");
    await expect(readThreeMfUnit(zipSync({ "readme.txt": strToU8("no model") }))).rejects.toThrow("modelo principal");
  });

  it("caps the combined uncompressed size of 3MF package entries", () => {
    expect(exceedsThreeMfExpansionLimit(MAX_THREE_MF_UNCOMPRESSED_BYTES - 10, 10)).toBe(false);
    expect(exceedsThreeMfExpansionLimit(MAX_THREE_MF_UNCOMPRESSED_BYTES - 10, 11)).toBe(true);
  });
});

describe("model color selection", () => {
  it("matches only components that use the selected file color", () => {
    const components = [
      { id: "body", colors: ["161616"] },
      { id: "detail", colors: ["ff8000", "ffffff"] },
      { id: "uncolored", colors: [] },
    ];
    expect(getModelColorMatchedComponentIds(components, "ff8000")).toEqual(["detail"]);
    expect(getModelColorMatchedComponentIds(components, null)).toEqual([]);
  });
});
