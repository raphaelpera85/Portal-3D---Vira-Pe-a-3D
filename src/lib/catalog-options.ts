export type CatalogOptionKind = "printer" | "material" | "nozzle" | "category";

export function isCatalogOptionKind(value: unknown): value is CatalogOptionKind {
  return value === "printer" || value === "material" || value === "nozzle" || value === "category";
}

export function normalizeCatalogOptionSearch(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 160) return null;
  return value.trim().replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80);
}
