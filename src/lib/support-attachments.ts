export const SUPPORT_ATTACHMENT_MAX_COUNT = 3;
export const SUPPORT_ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;
export const SUPPORT_ATTACHMENT_MAX_TOTAL_BYTES = 4 * 1024 * 1024;

const allowedTypes: Record<string, RegExp> = {
  "application/pdf": /\.pdf$/i,
  "image/jpeg": /\.(?:jpe?g)$/i,
  "image/png": /\.png$/i,
  "image/webp": /\.webp$/i,
};

export function validateSupportAttachments(files: Pick<File, "name" | "size" | "type">[]) {
  if (files.length > SUPPORT_ATTACHMENT_MAX_COUNT) return `Anexe no máximo ${SUPPORT_ATTACHMENT_MAX_COUNT} arquivos por resposta.`;
  if (files.some((file) => file.name.length < 1 || file.name.length > 200 || /[\\/\u0000-\u001f]/.test(file.name))) return "Confira os nomes dos arquivos anexados.";
  if (files.some((file) => !allowedTypes[file.type]?.test(file.name))) return "Use arquivos PDF, JPEG, PNG ou WebP com a extensão correspondente.";
  if (files.some((file) => file.size < 1 || file.size > SUPPORT_ATTACHMENT_MAX_BYTES)) return "Cada anexo precisa ter até 2 MiB.";
  if (files.reduce((total, file) => total + file.size, 0) > SUPPORT_ATTACHMENT_MAX_TOTAL_BYTES) return "Os anexos excedem 4 MiB no total.";
  return null;
}
