import type { SavedSlicerMetrics } from "./saved-calculation";

export const modelProfileTypes = ["economic", "fast", "detailed", "multicolor", "custom"] as const;
export const modelProfileSlicers = ["Arquivo 3MF", "Anycubic Slicer Next", "OrcaSlicer", "Bambu Studio", "Cura", "PrusaSlicer", "Manual"] as const;
export type ModelPrintProfileInput = {
  id: string | null; modelSlug: string; name: string; profileType: typeof modelProfileTypes[number];
  slicer: string; sharingScope: "private" | "community"; printerName: string; materialName: string; nozzleName: string;
  layerHeightMm: number | null; infillPercent: number | null; wallCount: number | null;
  supports: boolean; orientation: string; scalePercent: number; quantity: number; metrics: SavedSlicerMetrics;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const decimal = (value: unknown): number | null | undefined => {
  const raw = text(value);
  if (!raw) return null;
  if (!/^\d{1,9}(?:[,.]\d{1,3})?$/.test(raw)) return undefined;
  const number = Number(raw.replace(",", "."));
  return Number.isFinite(number) ? number : undefined;
};
const nullableMetric = (value: unknown): value is number | null => value === null || typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000;

function parseManualFilaments(value: unknown, materialName: string) {
  const lines = text(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 32) return undefined;
  if (!lines.length) return [];
  const filaments = lines.map((line, index) => {
    const match = line.match(/^\s*(#[0-9a-f]{6})?\s*;\s*([^;]{0,40})\s*;\s*(\d{1,9}(?:[,.]\d{1,3})?)?\s*;\s*(\d{1,9}(?:[,.]\d{1,3})?)?\s*$/i);
    if (!match || !match[3] && !match[4]) return null;
    const grams = match[3] ? Number(match[3].replace(",", ".")) : null;
    const lengthMeters = match[4] ? Number(match[4].replace(",", ".")) : null;
    if ([grams, lengthMeters].some((item) => item !== null && (!Number.isFinite(item) || item < 0))) return null;
    return { index: index + 1, grams, lengthMeters, pricePerKg: null, material: match[2].trim() || materialName || null, color: match[1]?.toUpperCase() ?? null };
  });
  if (filaments.some((item) => item === null)) return undefined;
  const validFilaments = filaments.filter((item): item is NonNullable<typeof item> => item !== null);
  const colors = validFilaments.map((item) => item.color).filter((item): item is string => item !== null);
  return new Set(colors).size === colors.length ? validFilaments : undefined;
}

function validateImportedMetrics(value: unknown): SavedSlicerMetrics | null {
  if (typeof value !== "string" || value.length > 20_000) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return null; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const metrics = parsed as Record<string, unknown>;
  const metricFields = ["modelGrams", "supportGrams", "totalGrams", "purgeGrams", "wipeTowerGrams", "filamentGrams", "lengthMeters", "printHours", "filamentChanges", "estimatedCost"];
  if (typeof metrics.slicer !== "string" || metrics.slicer.length > 40 || typeof metrics.derivedMass !== "boolean"
    || !metricFields.every((field) => nullableMetric(metrics[field]))
    || !Array.isArray(metrics.materials) || metrics.materials.length > 20 || metrics.materials.some((item) => typeof item !== "string" || item.length > 40)
    || !Array.isArray(metrics.conflicts) || metrics.conflicts.length > 30 || metrics.conflicts.some((item) => typeof item !== "string" || item.length > 80)
    || !Array.isArray(metrics.filaments) || metrics.filaments.length > 32) return null;
  const filaments = metrics.filaments as Record<string, unknown>[];
  if (filaments.some((item) => !item || !Number.isSafeInteger(item.index) || (item.index as number) < 0
    || !(item.grams === null || nullableMetric(item.grams))
    || !(item.lengthMeters === null || nullableMetric(item.lengthMeters))
    || !(item.pricePerKg === null || nullableMetric(item.pricePerKg))
    || !(item.material === null || typeof item.material === "string" && item.material.length <= 40)
    || !(item.color === null || typeof item.color === "string" && /^#[0-9a-f]{6}$/i.test(item.color)))) return null;
  if (metrics.estimatedCost !== null || metrics.estimatedCostCurrency != null || metrics.filamentChanges !== null && !Number.isSafeInteger(metrics.filamentChanges)) return null;
  const colors = filaments.map((item) => typeof item.color === "string" ? item.color.toUpperCase() : null).filter((item): item is string => item !== null);
  const colorGrams = filaments.reduce((sum, item) => sum + (typeof item.grams === "number" ? item.grams : 0), 0);
  if (new Set(colors).size !== colors.length || metrics.filamentGrams !== null && colorGrams > (metrics.filamentGrams as number) + 0.001) return null;
  return parsed as SavedSlicerMetrics;
}

export function validateModelPrintProfile(values: Record<string, unknown>): ModelPrintProfileInput | null {
  const id = text(values.id) || null;
  const modelSlug = text(values.modelSlug);
  const name = text(values.name);
  const profileType = values.profileType;
  const slicer = text(values.slicer);
  const sharingScope = text(values.sharingScope) || "private";
  const printerName = text(values.printerName);
  const materialName = text(values.materialName);
  const nozzleName = text(values.nozzleName);
  const orientation = text(values.orientation);
  const layerHeightMm = decimal(values.layerHeightMm);
  const infillPercent = decimal(values.infillPercent);
  const wallCount = decimal(values.wallCount);
  const scalePercent = decimal(values.scalePercent);
  const quantity = decimal(values.quantity);
  if (!/^[a-z0-9]{6,16}$/.test(modelSlug) || id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    || name.length < 2 || name.length > 80 || !modelProfileTypes.includes(profileType as typeof modelProfileTypes[number])
    || !modelProfileSlicers.includes(slicer as typeof modelProfileSlicers[number]) || !["private", "community"].includes(sharingScope)
    || printerName.length > 120 || materialName.length > 120 || nozzleName.length > 80 || orientation.length > 80
    || [layerHeightMm, infillPercent, wallCount, scalePercent, quantity].some((value) => value === undefined || value !== null && (!Number.isFinite(value) || value < 0))
    || layerHeightMm !== null && layerHeightMm !== undefined && (layerHeightMm <= 0 || layerHeightMm > 5)
    || infillPercent !== null && infillPercent !== undefined && infillPercent > 100
    || wallCount !== null && wallCount !== undefined && (!Number.isSafeInteger(wallCount) || wallCount > 100)
    || scalePercent === null || scalePercent === undefined || scalePercent < 10 || scalePercent > 300
    || quantity === null || quantity === undefined || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000) return null;

  const imported = text(values.importedMetrics);
  let metrics: SavedSlicerMetrics;
  if (imported) {
    const parsed = validateImportedMetrics(imported);
    if (!parsed) return null;
    const fieldNames = ["modelGrams", "supportGrams", "totalGrams", "purgeGrams", "wipeTowerGrams", "filamentGrams", "lengthMeters", "printHours", "filamentChanges"] as const;
    const manualFields = new Set(text(values.manualOverrideFields).split(","));
    const overrides: Partial<Record<typeof fieldNames[number], number | null>> = {};
    let invalidOverride = false;
    fieldNames.forEach((field) => {
      if (!manualFields.has(field)) return;
      const raw = text(values[field]);
      if (!raw) { overrides[field] = null; return; }
      const value = decimal(raw);
      if (value === undefined) invalidOverride = true;
      else overrides[field] = value;
    });
    const manualFilaments = manualFields.has("filamentLines") ? parseManualFilaments(values.filamentLines, materialName) : null;
    if (invalidOverride
      || overrides.filamentChanges !== undefined && !Number.isSafeInteger(overrides.filamentChanges)
      || manualFilaments === undefined) return null;
    const filaments = manualFilaments ?? parsed.filaments;
    const hasFilamentGramsOverride = manualFields.has("filamentGrams");
    const filamentGrams = hasFilamentGramsOverride ? overrides.filamentGrams ?? null : parsed.filamentGrams;
    const colorGrams = filaments.reduce((sum, item) => sum + (item.grams ?? 0), 0);
    if (filamentGrams !== null && colorGrams > filamentGrams + 0.001) return null;
    metrics = {
      ...parsed, ...overrides, filaments,
      ...(manualFilaments ? { materials: [...new Set(manualFilaments.map((item) => item.material).filter((item): item is string => item !== null))].slice(0, 20) } : {}),
      ...(hasFilamentGramsOverride ? { derivedMass: false } : {}),
    };
  } else {
    const fieldNames = ["modelGrams", "supportGrams", "totalGrams", "purgeGrams", "wipeTowerGrams", "filamentGrams", "lengthMeters", "printHours", "filamentChanges"] as const;
    const valuesByField = Object.fromEntries(fieldNames.map((field) => [field, decimal(values[field])])) as Record<typeof fieldNames[number], number | null | undefined>;
    if (Object.values(valuesByField).some((value) => value === undefined)
      || valuesByField.filamentChanges !== null && !Number.isSafeInteger(valuesByField.filamentChanges)) return null;
    const manualFilaments = parseManualFilaments(values.filamentLines, materialName);
    if (manualFilaments === undefined) return null;
    const validFilaments = manualFilaments ?? [];
    const colorGrams = validFilaments.reduce((sum, item) => sum + (item.grams ?? 0), 0);
    if (valuesByField.filamentGrams != null && colorGrams > valuesByField.filamentGrams + 0.001) return null;
    const derivedMass = valuesByField.filamentGrams === null && validFilaments.length > 0 && validFilaments.every((item) => item.grams !== null);
    const filamentGrams = valuesByField.filamentGrams ?? (derivedMass ? colorGrams : null);
    metrics = {
      slicer, modelGrams: valuesByField.modelGrams!, supportGrams: valuesByField.supportGrams!, totalGrams: valuesByField.totalGrams!,
      purgeGrams: valuesByField.purgeGrams!, wipeTowerGrams: valuesByField.wipeTowerGrams!, filamentGrams, derivedMass,
      lengthMeters: valuesByField.lengthMeters!, printHours: valuesByField.printHours!, filamentChanges: valuesByField.filamentChanges!, estimatedCost: null,
      materials: materialName ? [materialName.slice(0, 40)] : [], filaments: validFilaments, conflicts: [],
    };
  }
  return {
    id, modelSlug, name, profileType: profileType as ModelPrintProfileInput["profileType"], slicer, sharingScope: sharingScope as ModelPrintProfileInput["sharingScope"],
    printerName, materialName, nozzleName, layerHeightMm: layerHeightMm ?? null, infillPercent: infillPercent ?? null,
    wallCount: wallCount ?? null, supports: values.supports === true || values.supports === "on" || values.supports === "true",
    orientation, scalePercent, quantity, metrics,
  };
}
