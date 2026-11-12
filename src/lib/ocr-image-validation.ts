export const MAX_SLICER_OCR_IMAGES = 3;
export const MAX_SLICER_OCR_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_SLICER_OCR_TOTAL_BYTES = 4 * 1024 * 1024;

export type OcrImageInput = { type: string; size: number; bytes: Uint8Array };

function hasSignature(image: OcrImageInput) {
  const bytes = image.bytes;
  if (image.type === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (image.type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (image.type === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export function validateSlicerOcrImages(images: OcrImageInput[]) {
  if (images.length < 1 || images.length > MAX_SLICER_OCR_IMAGES) return "Selecione de 1 a 3 imagens de fatiamento.";
  if (images.some((image) => image.size < 1 || image.size > MAX_SLICER_OCR_IMAGE_BYTES || image.bytes.length !== image.size)) return "Cada imagem precisa ter até 2 MiB.";
  if (images.reduce((total, image) => total + image.size, 0) > MAX_SLICER_OCR_TOTAL_BYTES) return "O conjunto de imagens excede o limite permitido.";
  if (images.some((image) => !hasSignature(image))) return "Use imagens PNG, JPEG ou WebP válidas.";
  return null;
}
