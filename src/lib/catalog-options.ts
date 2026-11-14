export type CatalogOptionKind = "printer" | "material" | "nozzle";

export function normalizeCatalogOptionSearch(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 160) return null;
  return value.trim().replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80);
}
