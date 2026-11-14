import { describe, expect, it } from "vitest";
import { isCatalogOptionKind, normalizeCatalogOptionSearch } from "./catalog-options";

describe("isCatalogOptionKind", () => {
  it("accepts supported catalog kinds, including product categories", () => {
    expect(isCatalogOptionKind("category")).toBe(true);
    expect(isCatalogOptionKind("printer")).toBe(true);
    expect(isCatalogOptionKind("unknown")).toBe(false);
  });
});

describe("normalizeCatalogOptionSearch", () => {
  it("keeps ordinary names and removes filter syntax", () => {
    expect(normalizeCatalogOptionSearch(" Bambu Lab, P1S (Combo)% ")).toBe("Bambu Lab P1S Combo");
  });

  it("rejects non-string or oversized input and bounds search length", () => {
    expect(normalizeCatalogOptionSearch(null)).toBeNull();
    expect(normalizeCatalogOptionSearch("a".repeat(161))).toBeNull();
    expect(normalizeCatalogOptionSearch("a".repeat(100))).toHaveLength(80);
  });
});
