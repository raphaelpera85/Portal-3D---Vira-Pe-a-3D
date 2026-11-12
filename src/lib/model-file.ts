export const MAX_MODEL_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_THREE_MF_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

export type ModelUnit = "mm" | "cm" | "m";
export type ModelSourceUnit = ModelUnit | "um" | "in" | "ft";
export type ModelFormat = "stl" | "obj" | "3mf" | "glb" | "gltf";
export type ModelDimensions = { x: number; y: number; z: number };

export function exceedsThreeMfExpansionLimit(expandedBytes: number, nextEntryBytes: number) {
  return nextEntryBytes > MAX_THREE_MF_UNCOMPRESSED_BYTES - expandedBytes;
}

export function getModelFormat(fileName: string): ModelFormat | null {
  const extension = fileName.toLowerCase().match(/\.([^.]+)$/)?.[1];
  return extension === "stl" || extension === "obj" || extension === "3mf" || extension === "glb" || extension === "gltf"
    ? extension
    : null;
}

export function validateModelFile(file: Pick<File, "name" | "size">): string | null {
  if (!getModelFormat(file.name)) return "Escolha um arquivo STL, OBJ, 3MF, GLB ou GLTF.";
  if (file.size > MAX_MODEL_FILE_BYTES) return "O arquivo precisa ter até 20 MB.";
  if (file.size === 0) return "O arquivo está vazio.";
  return null;
}

export function validateModelFiles(files: Array<Pick<File, "name" | "size">>): string | null {
  const models = files.filter((file) => getModelFormat(file.name));
  if (models.length !== 1) return "Selecione um modelo principal por vez.";
  const companions = new Set(["mtl", "bin", "png", "jpg", "jpeg", "webp"]);
  if (files.some((file) => !getModelFormat(file.name) && !companions.has(file.name.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? ""))) {
    return "Um dos arquivos associados não é compatível.";
  }
  if (files.some((file) => file.size === 0)) return "Um dos arquivos selecionados está vazio.";
  if (files.reduce((total, file) => total + file.size, 0) > MAX_MODEL_FILE_BYTES) return "O conjunto de arquivos precisa ter até 20 MB.";
  return null;
}

export function parseThreeMfUnit(modelXml: string): ModelSourceUnit | null {
  const value = modelXml.match(/<model\b[^>]*\bunit=["']([^"']+)["']/i)?.[1]?.toLowerCase();
  if (!value) return "mm";
  const units: Record<string, ModelSourceUnit> = {
    micron: "um",
    millimeter: "mm",
    centimeter: "cm",
    meter: "m",
    inch: "in",
    foot: "ft",
  };
  return units[value] ?? null;
}

export async function readThreeMfUnit(data: Uint8Array): Promise<ModelSourceUnit | null> {
  const { unzipSync } = await import("fflate");
  let expandedBytes = 0;
  const archive = unzipSync(data, { filter: (entry) => {
    if (exceedsThreeMfExpansionLimit(expandedBytes, entry.originalSize)) {
      throw new Error("O pacote 3MF ultrapassa o limite de extração de 100 MB.");
    }
    expandedBytes += entry.originalSize;
    return true;
  } });
  const modelPart = Object.entries(archive).find(([name]) => /^3d\/[^/]+\.model$/i.test(name))?.[1];
  if (!modelPart) throw new Error("O pacote 3MF não contém o modelo principal.");
  return parseThreeMfUnit(new TextDecoder().decode(modelPart));
}

export function modelUnitToMeters(unit: ModelSourceUnit) {
  const metersPerUnit: Record<ModelSourceUnit, number> = { um: 0.000001, mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 };
  return metersPerUnit[unit];
}

export function formatModelDimensions(
  dimensions: ModelDimensions,
  sourceUnit: ModelSourceUnit,
  displayUnit: ModelUnit,
  scale: number,
): ModelDimensions {
  const factor = (modelUnitToMeters(sourceUnit) / modelUnitToMeters(displayUnit)) * scale;
  const round = (value: number) => Math.round(value * factor * 100) / 100;
  return { x: round(dimensions.x), y: round(dimensions.y), z: round(dimensions.z) };
}
