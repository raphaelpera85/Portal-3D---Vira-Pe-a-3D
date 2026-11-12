import type { BufferGeometry, Mesh, Object3D } from "three";
import { modelUnitToMeters, type ModelSourceUnit } from "./model-file";

export function createMeterExportCopy(source: Object3D, unit: ModelSourceUnit) {
  const object = source.clone(true);
  const geometries = new Map<BufferGeometry, BufferGeometry>();
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    let geometry = geometries.get(mesh.geometry);
    if (!geometry) {
      geometry = mesh.geometry.clone();
      geometries.set(mesh.geometry, geometry);
    }
    mesh.geometry = geometry;
  });

  const metersPerUnit = modelUnitToMeters(unit);
  object.position.multiplyScalar(metersPerUnit);
  object.scale.multiplyScalar(metersPerUnit);
  return { object, dispose: () => geometries.forEach((geometry) => geometry.dispose()) };
}
