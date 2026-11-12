const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const number = (value: unknown, min: number, max: number) => {
  const raw = text(value);
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
};
const qualityOptions = ["standard", "fine", "fast", "custom"] as const;

export function validateCustomPrintRequest(values: Record<string, unknown>, today = new Date().toISOString().slice(0, 10)) {
  const uploadId = text(values.uploadId);
  const materialId = text(values.materialId);
  const rawQuantity = text(values.quantity);
  const quantity = /^\d{1,4}$/.test(rawQuantity) ? Number(rawQuantity) : NaN;
  const scalePercent = number(values.scalePercent, 1, 1000);
  const x = number(values.dimensionsX, 0.01, 10000);
  const y = number(values.dimensionsY, 0.01, 10000);
  const z = number(values.dimensionsZ, 0.01, 10000);
  const color = text(values.color);
  const quality = text(values.quality);
  const dueDate = text(values.dueDate);
  const notes = text(values.notes);
  const dueDateValid = !dueDate || (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
    && Number.isFinite(new Date(`${dueDate}T00:00:00Z`).getTime())
    && new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) === dueDate
    && dueDate >= today);

  if (!uuid.test(uploadId) || !uuid.test(materialId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000
    || scalePercent == null || x == null || y == null || z == null || color.length > 80
    || !qualityOptions.includes(quality as typeof qualityOptions[number]) || !dueDateValid || notes.length > 1000) return null;

  return {
    uploadId, materialId, quantity, scalePercent, dimensionsMm: { x, y, z },
    color, quality: quality as typeof qualityOptions[number], dueDate: dueDate || null, notes,
  };
}
