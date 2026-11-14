import { describe, expect, it } from "vitest";
import { getUnknownPrinterCandidates, officialPrinterFeeds, parseAnycubicPrinterFeed, parseOfficialPrinterFeed, readLimitedResponseText } from "./catalog-discovery";

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

describe("additional official printer feeds", () => {
  it("accepts ELEGOO printer types and skips accessory bundles", () => {
    expect(parseOfficialPrinterFeed({ products: [
      { title: "Centauri 2 Combo", handle: "centauri-2-combo", product_type: "FDM 3D Printers", vendor: "ELEGOO", published_at: "2026-11-01T00:00:00Z" },
      { title: "Saturn 4 Ultra Starter Bundle", handle: "saturn-4-ultra-starter-bundle", product_type: "LCD 3D Printers", vendor: "ELEGOO", published_at: "2026-11-01T00:00:00Z" },
      { title: "Unrelated", handle: "unrelated", product_type: "FDM 3D Printers", vendor: "Other", published_at: "2026-11-01T00:00:00Z" },
    ] }, officialPrinterFeeds[1])).toEqual([{
      manufacturer: "ELEGOO", title: "Centauri 2 Combo", productType: "FDM 3D Printers", sourceUrl: "https://us.elegoo.com/products/centauri-2-combo",
    }]);
  });

  it("accepts only Creality printer listings from its official printer collection", () => {
    expect(parseOfficialPrinterFeed({ products: [
      { title: "K2 SE 4C 3D Printer", handle: "k2-se-4c-3d-printer", product_type: "Bundles", vendor: "Creality Official Store", published_at: "2026-11-01T00:00:00Z" },
      { title: "CFS Spare Part", handle: "cfs-spare-part", product_type: "Accessories", vendor: "Creality Official Store", published_at: "2026-11-01T00:00:00Z" },
      { title: "Other Brand 3D Printer", handle: "other-printer", product_type: "FDM 3D Printers", vendor: "Other", published_at: "2026-11-01T00:00:00Z" },
    ] }, officialPrinterFeeds[2])).toEqual([{
      manufacturer: "Creality", title: "K2 SE 4C 3D Printer", productType: "3D Printer", sourceUrl: "https://us.store.creality.com/products/k2-se-4c-3d-printer",
    }]);
  });
});
