import type { SavedSlicerMetrics } from "./saved-calculation";

export type CalculatorProfileSource = {
  name: string;
  materialName: string;
  quantity: number;
  printHours: number | null;
  materialGrams: number | null;
  materialByColor: Array<{ color: string; grams: number }>;
};

export function mapModelPrintProfileToCalculator(profile: { name: string; materialName: string; quantity: number; metrics: SavedSlicerMetrics }, batchQuantity: number, existingFilaments: SavedSlicerMetrics["filaments"] = []) {
  if (!Number.isSafeInteger(profile.quantity) || profile.quantity < 1 || !Number.isSafeInteger(batchQuantity) || batchQuantity < 1 || batchQuantity > 1_000_000) return null;
  const runs = Math.ceil(batchQuantity / profile.quantity);
  const filamentGrams = profile.metrics.filamentGrams ?? (profile.metrics.filaments.length > 0 && profile.metrics.filaments.every((item) => item.grams !== null)
    ? profile.metrics.filaments.reduce((total, item) => total + item.grams!, 0)
    : null);
  const scale = (value: number | null) => value === null ? null : value * runs;
  const scaledGrams = scale(filamentGrams);
  const printHours = scale(profile.metrics.printHours);
  if (scaledGrams !== null && (!Number.isFinite(scaledGrams) || scaledGrams > 1_000_000)
    || printHours !== null && (!Number.isFinite(printHours) || printHours > 100_000)) return null;
  const slicerMetrics: SavedSlicerMetrics = {
    ...profile.metrics,
    modelGrams: scale(profile.metrics.modelGrams), supportGrams: scale(profile.metrics.supportGrams), totalGrams: scale(profile.metrics.totalGrams),
    purgeGrams: scale(profile.metrics.purgeGrams), wipeTowerGrams: scale(profile.metrics.wipeTowerGrams), filamentGrams: scaledGrams,
    lengthMeters: scale(profile.metrics.lengthMeters), printHours, filamentChanges: profile.metrics.filamentChanges === null ? null : profile.metrics.filamentChanges * runs,
    estimatedCost: scale(profile.metrics.estimatedCost),
    filaments: profile.metrics.filaments.map((item) => ({
      ...item, grams: scale(item.grams), lengthMeters: scale(item.lengthMeters),
      pricePerKg: existingFilaments.find((existing) => existing.color?.toUpperCase() === item.color?.toUpperCase())?.pricePerKg ?? item.pricePerKg,
    })),
  };
  return { material: profile.materialName, filamentGrams: scaledGrams, printHours, slicerMetrics };
}

export function mapPrintProfileToCalculator(
  profile: CalculatorProfileSource,
  batchQuantity: number,
  existingFilaments: SavedSlicerMetrics["filaments"] = [],
) {
  if (!Number.isSafeInteger(profile.quantity) || profile.quantity < 1 || !Number.isSafeInteger(batchQuantity) || batchQuantity < 1 || batchQuantity > 1_000_000) return null;
  const runs = Math.ceil(batchQuantity / profile.quantity);
  const colorTotal = profile.materialByColor.reduce((sum, item) => sum + item.grams, 0);
  const sourceGrams = profile.materialGrams ?? colorTotal;
  if (!Number.isFinite(sourceGrams) || sourceGrams < 0 || colorTotal > sourceGrams + 0.001
    || profile.materialByColor.length > 12 || profile.materialByColor.some((item) => !Number.isFinite(item.grams) || item.grams <= 0 || !/^#[0-9a-f]{6}$/i.test(item.color))) return null;
  const filamentGrams = sourceGrams * runs;
  const printHours = profile.printHours == null ? null : profile.printHours * runs;
  if (!Number.isFinite(filamentGrams) || filamentGrams > 1_000_000 || printHours !== null && (!Number.isFinite(printHours) || printHours < 0 || printHours > 100_000)) return null;

  const filaments: SavedSlicerMetrics["filaments"] = profile.materialByColor.map((item, index) => ({
    index: index + 1,
    grams: item.grams * runs,
    lengthMeters: null,
    pricePerKg: existingFilaments.find((existing) => existing.color?.toUpperCase() === item.color.toUpperCase())?.pricePerKg ?? null,
    material: profile.materialName || null,
    color: item.color,
  }));
  const unassignedGrams = filamentGrams - filaments.reduce((sum, item) => sum + (item.grams ?? 0), 0);
  if (unassignedGrams > 0.001) filaments.push({
    index: filaments.length + 1, grams: unassignedGrams, lengthMeters: null, pricePerKg: null,
    material: profile.materialName || null, color: null,
  });

  const slicerMetrics: SavedSlicerMetrics = {
    slicer: `Perfil · ${profile.name}`.slice(0, 40), modelGrams: null, supportGrams: null,
    totalGrams: filamentGrams || null, purgeGrams: null, wipeTowerGrams: null,
    filamentGrams: filamentGrams || null, derivedMass: false, lengthMeters: null,
    printHours, filamentChanges: null, estimatedCost: null,
    materials: profile.materialName ? [profile.materialName.slice(0, 40)] : [],
    filaments, conflicts: [],
  };
  return { material: profile.materialName, filamentGrams: filamentGrams || null, printHours, slicerMetrics };
}
