export const DESIGNER_DELIVERY_MAX_FILES = 10;
export const DESIGNER_DELIVERY_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const DESIGNER_DELIVERY_MAX_TOTAL_BYTES = 100 * 1024 * 1024;

// shortcut: files are download-only and validated by name/size; parse formats before adding previews or processing uploads.
const extensions = new Set(["stl", "3mf", "obj", "mtl", "gltf", "glb", "step", "stp", "blend", "zip"]);
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

export type DesignerDeliveryFile = { name: string; type?: string; size: number };

export function normalizeDesignerServiceDeliveryFiles(files: DesignerDeliveryFile[]) {
  if (!Array.isArray(files) || files.length < 1 || files.length > DESIGNER_DELIVERY_MAX_FILES) return null;
  if (files.some((file) => !file || typeof file !== "object" || typeof file.name !== "string" || typeof file.size !== "number")) return null;
  const normalized = files.map((file) => ({ ...file, extension: file.name.split(".").at(-1)?.toLowerCase() ?? "" }));
  if (normalized.some(({ name, size, extension }) => typeof name !== "string" || name.length < 1 || name.length > 200
    || /[\\/\u0000-\u001f]/.test(name) || !extensions.has(extension) || !Number.isSafeInteger(size)
    || size < 1 || size > DESIGNER_DELIVERY_MAX_FILE_BYTES)) return null;
  if (normalized.reduce((total, file) => total + file.size, 0) > DESIGNER_DELIVERY_MAX_TOTAL_BYTES) return null;
  return normalized.map(({ name, type, size, extension }) => ({ name, ...(type ? { type } : {}), size, extension }));
}

export function isDesignerServiceDeliveryPath(requestId: string, path: string) {
  return new RegExp(`^${uuid}$`, "i").test(requestId)
    && typeof path === "string" && new RegExp(`^${requestId}/${uuid}\\.(?:${[...extensions].join("|")})$`, "i").test(path);
}
