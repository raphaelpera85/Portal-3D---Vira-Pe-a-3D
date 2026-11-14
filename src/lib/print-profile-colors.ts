export function readPrintProfileColors(value: unknown): Array<{ color: string; grams: number | null; lengthMeters: number | null }> {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { color, grams, lengthMeters } = item as { color?: unknown; grams?: unknown; lengthMeters?: unknown };
    const validGrams = grams == null || typeof grams === "number" && Number.isFinite(grams) && grams > 0 && grams <= 1_000_000;
    const validLength = lengthMeters == null || typeof lengthMeters === "number" && Number.isFinite(lengthMeters) && lengthMeters > 0 && lengthMeters <= 1_000_000_000;
    if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color) || !validGrams || !validLength || (grams == null && lengthMeters == null)) return [];
    const normalized = color.toUpperCase();
    if (seen.has(normalized)) return [];
    seen.add(normalized);
    return [{ color: normalized, grams: typeof grams === "number" ? grams : null, lengthMeters: typeof lengthMeters === "number" ? lengthMeters : null }];
  }).slice(0, 12);
}
