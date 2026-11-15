export const CREATOR_MODEL_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const CREATOR_MODEL_MAX_PREVIEW_BYTES = 5 * 1024 * 1024;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const previewFormats = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

export function normalizeCreatorModelUpload(file: { name: string; size: number }) {
  if (!file || typeof file.name !== "string" || typeof file.size !== "number") return null;
  const name = file.name.trim();
  if (name.length < 5 || name.length > 200 || !/\.3mf$/i.test(name) || /[\\/\u0000-\u001f\u007f]/.test(name)
    || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > CREATOR_MODEL_MAX_UPLOAD_BYTES) return null;
  return { name, size: file.size };
}

export function isCreatorModelUploadPath(userId: string, path: string, id: string) {
  return uuid.test(userId) && /^[a-f0-9]{12}$/.test(id) && path === `${userId}/${id}.3mf`;
}

export function normalizeCreatorModelPreview(file: { name: string; size: number; type?: string }) {
  if (!file || typeof file.name !== "string" || typeof file.size !== "number") return null;
  const name = file.name.trim();
  const extension = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase();
  const contentType = file.type || (extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "");
  const expectedExtension = previewFormats[contentType as keyof typeof previewFormats];
  if (!expectedExtension || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > CREATOR_MODEL_MAX_PREVIEW_BYTES
    || !/^[^\\/\u0000-\u001f\u007f]{1,200}$/.test(name)
    || !(extension === expectedExtension || (contentType === "image/jpeg" && extension === "jpeg"))) return null;
  return { name, size: file.size, contentType, extension: expectedExtension };
}

export function isCreatorModelPreviewPath(userId: string, path: string, id: string) {
  return uuid.test(userId) && /^[a-f0-9]{12}$/.test(id)
    && new RegExp(`^${userId}/${id}-preview\\.(png|jpg|webp)$`).test(path);
}

export function isCreatorModelPreviewPathForId(path: string, id: string) {
  const userId = path.split("/")[0];
  return isCreatorModelPreviewPath(userId, path, id);
}
