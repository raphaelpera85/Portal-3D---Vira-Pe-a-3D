export const MAX_DIGITAL_MODEL_BYTES = 50 * 1024 * 1024;
export const MAX_DIGITAL_PREVIEW_BYTES = 20 * 1024 * 1024;

export type DigitalAssetInput = {
  filename: string;
  sizeBytes: number;
  personalPriceBrl: number;
  commercialPriceBrl: number | null;
};
export type DigitalLicenseType = "personal" | "commercial";

export function validateDigitalLicense(value: unknown): DigitalLicenseType | null {
  return value === "personal" || value === "commercial" ? value : null;
}

export function validateDigitalPreview(values: Record<string, unknown>): { filename: string; sizeBytes: number } | null {
  const filename = text(values.filename);
  const sizeBytes = Number(values.size);
  if (!filename || filename.length > 200 || /[/\\\u0000-\u001f\u007f]/.test(filename)
    || !/\.glb$/i.test(filename) || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_DIGITAL_PREVIEW_BYTES) return null;
  return { filename, sizeBytes };
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const price = (value: unknown): number | null => {
  const raw = text(value);
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : null;
};

export function validateDigitalAsset(values: Record<string, unknown>): DigitalAssetInput | null {
  const filename = text(values.filename);
  const sizeBytes = Number(values.size);
  const personalPriceBrl = price(values.personalPriceBrl);
  const rawCommercial = text(values.commercialPriceBrl);
  const commercialPriceBrl = rawCommercial ? price(rawCommercial) : null;
  const rightsAccepted = values.rightsAccepted === true || values.rightsAccepted === "on";
  if (!filename || filename.length > 200 || /[/\\\u0000-\u001f\u007f]/.test(filename)
    || !/\.(stl|3mf)$/i.test(filename) || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_DIGITAL_MODEL_BYTES
    || personalPriceBrl == null || (rawCommercial && commercialPriceBrl == null) || !rightsAccepted) return null;
  return { filename, sizeBytes, personalPriceBrl, commercialPriceBrl };
}
