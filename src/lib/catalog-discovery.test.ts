import { describe, expect, it } from "vitest";
import { getUnknownPrinterCandidates, parseAnycubicPrinterFeed, readLimitedResponseText } from "./catalog-discovery";

describe("Anycubic official product feed", () => {
  it("returns only published printer products with canonical source URLs", () => {
    expect(parseAnycubicPrinterFeed({ products: [
      { title: "Kobra Model", handle: "kobra-model", product_type: "FDM 3D Printers", vendor: "ANYCUBIC", published_at: "2026-11-01T00:00:00Z" },
      { title: "Photon Model", handle: "photon-model", product_type: "LCD 3D Printer", vendor: "Anycubic", published_at: "2026-11-02T00:00:00Z" },
      { title: "Hotend", handle: "hotend", product_type: "3D Printer Parts", vendor: "ANYCUBIC", published_at: "2026-11-03T00:00:00Z" },
      { title: "Unpublished Model", handle: "unpublished", product_type: "FDM 3D Printer", vendor: "ANYCUBIC", published_at: null },
      { title: "Other Brand", handle: "other", product_type: "FDM 3D Printer", vendor: "OTHER", published_at: "2026-11-03T00:00:00Z" },
      { title: "Bad Handle", handle: "https://example.com", product_type: "FDM 3D Printer", vendor: "ANYCUBIC", published_at: "2026-11-03T00:00:00Z" },
    ] })).toEqual([
      { manufacturer: "Anycubic", title: "Kobra Model", productType: "FDM 3D Printers", sourceUrl: "https://store.anycubic.com/products/kobra-model" },
      { manufacturer: "Anycubic", title: "Photon Model", productType: "LCD 3D Printer", sourceUrl: "https://store.anycubic.com/products/photon-model" },
    ]);
  });

  it("rejects malformed feed responses", () => {
    expect(parseAnycubicPrinterFeed(null)).toEqual([]);
    expect(parseAnycubicPrinterFeed({ products: "not an array" })).toEqual([]);
  });

  it("rejects feed bodies larger than the configured byte limit", async () => {
    await expect(readLimitedResponseText(new Response("12345"), 4)).rejects.toThrow("Feed response too large");
  });

  it("skips products already linked to a catalog model, including URLs with variants", () => {
    const feed = { products: [
      { title: "Kobra Model", handle: "kobra-model", product_type: "FDM 3D Printers", vendor: "ANYCUBIC", published_at: "2026-11-01T00:00:00Z" },
      { title: "New Model", handle: "new-model", product_type: "FDM 3D Printer", vendor: "ANYCUBIC", published_at: "2026-11-03T00:00:00Z" },
    ] };
    expect(getUnknownPrinterCandidates(feed, ["https://store.anycubic.com/products/kobra-model?variant=123"]).map(({ title }) => title)).toEqual(["New Model"]);
  });
});
