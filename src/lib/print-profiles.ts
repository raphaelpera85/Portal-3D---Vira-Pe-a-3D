export type PrintProfileType = "economic" | "fast" | "detailed" | "multicolor" | "custom";
export type PrintProfileSharingScope = "private" | "community";
export type PrintProfileInput = {
  productId: string;
  name: string;
  profileType: PrintProfileType;
  sharingScope: PrintProfileSharingScope;
  printerId: string | null;
  printerName: string;
  materialId: string | null;
  materialName: string;
  nozzleId: string | null;
  nozzleName: string;
  layerHeightMm: number | null;
  infillPercent: number | null;
  wallCount: number | null;
  supports: boolean;
  orientation: string;
  scalePercent: number;
  quantity: number;
  printHours: number | null;
  materialGrams: number | null;
  materialByColor: Array<{ color: string; grams: number }>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const optionalUuid = (value: unknown) => text(value) || null;
const decimal = (value: unknown) => {
  const raw = text(value);
  if (!raw) return null;
  if (!/^\d{1,9}(?:[,.]\d{1,3})?$/.test(raw)) return Number.NaN;
  return Number(raw.replace(",", "."));
};

export function validatePrintProfile(values: Record<string, unknown>): PrintProfileInput | null {
  const productId = text(values.productId);
  const name = text(values.name);
  const profileType = values.profileType;
  const sharingScope = values.sharingScope === "community" ? "community" : values.sharingScope === "private" || values.sharingScope == null ? "private" : null;
  const printerId = optionalUuid(values.printerId);
  const printerName = text(values.printerName);
  const materialId = optionalUuid(values.materialId);
  const materialName = text(values.materialName);
  const nozzleId = optionalUuid(values.nozzleId);
  const nozzleName = text(values.nozzleName);
  const layerHeightMm = decimal(values.layerHeightMm);
  const infillPercent = decimal(values.infillPercent);
  const wallCount = decimal(values.wallCount);
  const orientation = text(values.orientation);
  const rawScale = text(values.scalePercent);
  const scalePercent = rawScale ? decimal(rawScale) : 100;
  const quantity = decimal(values.quantity);
  const printHours = decimal(values.printHours);
  const materialGrams = decimal(values.materialGrams);
  const profileTypes: PrintProfileType[] = ["economic", "fast", "detailed", "multicolor", "custom"];
  const materialByColorText = text(values.materialByColor);

  if (!uuidPattern.test(productId) || name.length < 2 || name.length > 100 || !profileTypes.includes(profileType as PrintProfileType) || !sharingScope) return null;
  if ((printerId && !uuidPattern.test(printerId)) || printerName.length > 120 || (!printerId && printerName.length < 2)) return null;
  if ((materialId && !uuidPattern.test(materialId)) || materialName.length > 120 || (!materialId && materialName.length < 2)) return null;
  if ((nozzleId && !uuidPattern.test(nozzleId)) || nozzleName.length > 120 || (!nozzleId && nozzleName.length < 2)) return null;
  if (orientation.length > 80) return null;
  if ([layerHeightMm, infillPercent, wallCount, scalePercent, quantity, printHours, materialGrams].some((value) => value != null && (!Number.isFinite(value) || value < 0))) return null;
  if ((layerHeightMm != null && (layerHeightMm <= 0 || layerHeightMm > 5))
    || (infillPercent != null && infillPercent > 100)
    || (wallCount != null && (!Number.isSafeInteger(wallCount) || wallCount > 100))
    || scalePercent == null || !Number.isFinite(scalePercent) || scalePercent < 10 || scalePercent > 300
    || quantity == null || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000
    || (printHours != null && printHours > 100_000)
    || (materialGrams != null && materialGrams > 1_000_000)) return null;

  const validScalePercent = scalePercent as number;
  const validQuantity = quantity as number;
  const lines = materialByColorText ? materialByColorText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
  if (lines.length > 12) return null;
  const materialByColor = lines.map((line) => {
    const match = line.match(/^#?([0-9a-f]{6})\s*[;=]\s*(\d{1,9}(?:[,.]\d{1,3})?)$/i);
    if (!match) return null;
    const grams = Number(match[2].replace(",", "."));
    return Number.isFinite(grams) && grams > 0 ? { color: `#${match[1].toUpperCase()}`, grams } : null;
  });
  if (materialByColor.some((item) => item === null)) return null;
  const validColorConsumption = materialByColor.filter((item): item is { color: string; grams: number } => item !== null);
  if (new Set(validColorConsumption.map(({ color }) => color)).size !== validColorConsumption.length) return null;
  if (materialGrams != null && validColorConsumption.reduce((sum, item) => sum + item.grams, 0) > materialGrams + 0.001) return null;

  return {
    productId, name, profileType: profileType as PrintProfileType, sharingScope,
    printerId, printerName, materialId, materialName, nozzleId, nozzleName,
    layerHeightMm, infillPercent, wallCount: wallCount as number | null,
    supports: values.supports === true || values.supports === "on" || values.supports === "true",
    orientation, scalePercent: validScalePercent, quantity: validQuantity,
    printHours, materialGrams, materialByColor: validColorConsumption,
  };
}
