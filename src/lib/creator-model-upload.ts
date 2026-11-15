export const CREATOR_MODEL_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
