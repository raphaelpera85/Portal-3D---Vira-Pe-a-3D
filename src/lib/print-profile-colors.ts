export function readPrintProfileColors(value: unknown): Array<{ color: string; grams: number }> {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { color, grams } = item as { color?: unknown; grams?: unknown };
    if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color) || typeof grams !== "number" || !Number.isFinite(grams) || grams <= 0) return [];
    const normalized = color.toUpperCase();
    if (seen.has(normalized)) return [];
    seen.add(normalized);
    return [{ color: normalized, grams }];
  }).slice(0, 12);
}
