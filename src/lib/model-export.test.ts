import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { createMeterExportCopy } from "./model-export";

describe("model GLB export copy", () => {
  it("converts preview transforms to meters and isolates cloned geometry from the original", () => {
    const source = new Group();
    source.position.set(10, 20, 30);
    source.scale.setScalar(0.5);
    const sourceMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
    sourceMesh.visible = false;
    source.add(sourceMesh);

    const copy = createMeterExportCopy(source, "mm");
    const copiedMesh = copy.object.children[0] as Mesh;

    expect(copy.object.position.toArray()).toEqual([0.01, 0.02, 0.03]);
    expect(copy.object.scale.toArray()).toEqual([0.0005, 0.0005, 0.0005]);
    expect(copiedMesh.visible).toBe(false);
    expect(copiedMesh.geometry).not.toBe(sourceMesh.geometry);
    expect(source.position.toArray()).toEqual([10, 20, 30]);
    expect(source.scale.toArray()).toEqual([0.5, 0.5, 0.5]);

    copy.dispose();
  });
});
