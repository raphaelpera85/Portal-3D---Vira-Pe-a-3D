import { describe, expect, it } from "vitest";
import { classifyCatalogSourceResponse, getAllowedCatalogRedirect, getCatalogSourceCheckCycleStart, hasCatalogSourceBeenCheckedInCycle, isAllowedCatalogSourceUrl } from "./catalog-source-monitor";

describe("weekly catalog source checks", () => {
  it("only permits HTTPS sources on a known or explicitly approved manufacturer host", () => {
    expect(isAllowedCatalogSourceUrl("https://store.anycubic.com/products/kobra-3")).toBe(true);
    expect(isAllowedCatalogSourceUrl("https://bambulab-us.myshopify.com/products/pla-basic-filament")).toBe(true);
    expect(isAllowedCatalogSourceUrl("https://manuals.example.org/model", "example.org")).toBe(true);
    expect(isAllowedCatalogSourceUrl("https://anycubic.com.attacker.invalid/model")).toBe(false);
    expect(isAllowedCatalogSourceUrl("http://store.anycubic.com/model")).toBe(false);
    expect(isAllowedCatalogSourceUrl("https://127.0.0.1/private")).toBe(false);
  });

  it("follows only redirects that remain on an approved HTTPS host", () => {
    expect(getAllowedCatalogRedirect("https://store.anycubic.com/old", "/products/model")).toBe("https://store.anycubic.com/products/model");
    expect(getAllowedCatalogRedirect("https://store.anycubic.com/old", "https://attacker.invalid/model")).toBeNull();
    expect(getAllowedCatalogRedirect("https://store.anycubic.com/old", "http://store.anycubic.com/model")).toBeNull();
  });

  it("queues a review when source validators change and never treats missing validators as proof of stability", () => {
    expect(classifyCatalogSourceResponse({ etag: '"a"', lastModified: null }, { status: 200, etag: '"b"', lastModified: null }).event).toBe("source_changed");
    expect(classifyCatalogSourceResponse({ etag: '"a"', lastModified: null }, { status: 404, etag: null, lastModified: null }).event).toBe("source_unavailable");
    expect(classifyCatalogSourceResponse({ etag: '"a"', lastModified: null }, { status: 200, etag: null, lastModified: null }).state).toBe("uncheckable");
    expect(classifyCatalogSourceResponse({ etag: '"a"', lastModified: null }, { status: 200, etag: null, lastModified: "Mon, 02 Nov 2026 10:00:00 GMT" }).state).toBe("uncheckable");
  });

  it("uses a bounded content fingerprint when a source has no comparable HTTP validators", () => {
    expect(classifyCatalogSourceResponse(null, { status: 200, etag: null, lastModified: null, contentSha256: "a".repeat(64) }).state).toBe("current");
    expect(classifyCatalogSourceResponse(
      { etag: null, lastModified: null, contentSha256: "a".repeat(64) },
      { status: 200, etag: null, lastModified: null, contentSha256: "a".repeat(64) },
    ).state).toBe("current");
    expect(classifyCatalogSourceResponse(
      { etag: null, lastModified: null, contentSha256: "a".repeat(64) },
      { status: 200, etag: null, lastModified: null, contentSha256: "b".repeat(64) },
    ).event).toBe("source_changed");
    expect(classifyCatalogSourceResponse(
      { etag: '"old"', lastModified: null },
      { status: 405, etag: null, lastModified: null, contentSha256: "a".repeat(64) },
    ).state).toBe("uncheckable");
    expect(classifyCatalogSourceResponse(
      { etag: null, lastModified: null },
      { status: 200, etag: null, lastModified: null, contentSha256: null },
    ).state).toBe("uncheckable");
  });

  it("spreads the weekly source check across daily batches from the configured UTC weekday", () => {
    const monday = new Date("2026-11-16T12:00:00Z");
    const tuesday = new Date("2026-11-17T12:00:00Z");
    expect(getCatalogSourceCheckCycleStart(tuesday, "1").toISOString()).toBe("2026-11-16T00:00:00.000Z");
    expect(getCatalogSourceCheckCycleStart(monday, "5").toISOString()).toBe("2026-11-13T00:00:00.000Z");
    expect(hasCatalogSourceBeenCheckedInCycle("2026-11-16T12:00:00.000Z", tuesday, "1")).toBe(true);
    expect(hasCatalogSourceBeenCheckedInCycle("2026-11-09T12:00:00.000Z", tuesday, "1")).toBe(false);
  });
});
