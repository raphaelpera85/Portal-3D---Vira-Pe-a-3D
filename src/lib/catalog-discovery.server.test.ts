import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));

import { runCatalogModelDiscovery } from "./catalog-discovery.server";

describe("scheduled catalog model discovery", () => {
  const upsert = vi.fn();
  const from = vi.fn();
  const cursorUpsert = vi.fn();
  const cursorMaybeSingle = vi.fn();
  const cursorState = new Map<string, number>();
  let activeCursorManufacturer = "";

  beforeEach(() => {
    vi.useRealTimers();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Response(JSON.stringify({ products: [
      { title: "Known Model", handle: "known-model", product_type: "FDM 3D Printers", vendor: "ANYCUBIC", published_at: "2026-11-01T00:00:00Z" },
      { title: "New Model", handle: "new-model", product_type: "FDM 3D Printer", vendor: "ANYCUBIC", published_at: "2026-11-02T00:00:00Z" },
    ] }), { headers: { "content-type": "application/json" } })));
    upsert.mockReset().mockResolvedValue({ error: null });
    cursorState.clear();
    cursorUpsert.mockReset().mockImplementation(async ({ manufacturer, next_page }: { manufacturer: string; next_page: number }) => {
      cursorState.set(manufacturer, next_page);
      return { error: null };
    });
    cursorMaybeSingle.mockReset().mockImplementation(async () => ({ data: cursorState.has(activeCursorManufacturer) ? { next_page: cursorState.get(activeCursorManufacturer) } : null, error: null }));
    const query = { select: vi.fn(), order: vi.fn(), range: vi.fn() };
    query.select.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.range.mockResolvedValue({ data: [{ source_url: "https://store.anycubic.com/products/known-model?variant=123" }], error: null });
    const cursorQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: cursorMaybeSingle };
    cursorQuery.select.mockReturnValue(cursorQuery);
    cursorQuery.eq.mockImplementation((_column, manufacturer) => { activeCursorManufacturer = String(manufacturer); return cursorQuery; });
    from.mockReset();
    from.mockImplementation((table: string) => table === "catalog_discovery_cursors" ? { ...cursorQuery, upsert: cursorUpsert } : table === "printer_models" ? query : { upsert });
    mocks.createSupabaseAdminClient.mockReset().mockReturnValue({ from });
  });

  it("stores only feed products missing from the technical catalog", async () => {
    const result = await runCatalogModelDiscovery();

    expect(result).toEqual({ ok: true, checked: 2, candidates: 1, sourceFailures: 0, storageFailures: 0 });
    expect(from).toHaveBeenCalledWith("catalog_discovery_candidates");
    expect(upsert).toHaveBeenCalledWith([{
      manufacturer: "Anycubic", product_title: "New Model", product_type: "FDM 3D Printer",
      source_url: "https://store.anycubic.com/products/new-model",
    }], { onConflict: "source_url", ignoreDuplicates: true });
  });

  it("queues models from the official ELEGOO and Creality collections", async () => {
    const payloads: Record<string, unknown> = {
      "store.anycubic.com": { products: [] },
      "us.elegoo.com": { products: [
        { title: "Neptune 4 Plus", handle: "neptune-4-plus", product_type: "FDM 3D Printers", vendor: "ELEGOO", published_at: "2026-11-01T00:00:00Z" },
        { title: "Neptune 4 Plus Starter Bundle", handle: "neptune-4-plus-starter-bundle", product_type: "FDM 3D Printers", vendor: "ELEGOO", published_at: "2026-11-01T00:00:00Z" },
      ] },
      "us.store.creality.com": { products: [
        { title: "K2 SE 4C 3D Printer", handle: "k2-se-4c-3d-printer", product_type: "Bundles", vendor: "Creality Official Store", published_at: "2026-11-01T00:00:00Z" },
      ] },
    };
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      return new Response(JSON.stringify(payloads[url.host]), { headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCatalogModelDiscovery();

    expect(result).toEqual({ ok: true, checked: 2, candidates: 2, sourceFailures: 0, storageFailures: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(upsert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ manufacturer: "ELEGOO", product_title: "Neptune 4 Plus" }),
    ]), { onConflict: "source_url", ignoreDuplicates: true });
    expect(upsert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ manufacturer: "Creality", product_title: "K2 SE 4C 3D Printer" }),
    ]), { onConflict: "source_url", ignoreDuplicates: true });
  });

  it("continues other sources after one official feed fails", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const host = new URL(String(input)).host;
      if (host === "store.anycubic.com") throw new Error("feed timeout");
      const product = host === "us.elegoo.com"
        ? { title: "Neptune 4 Plus", handle: "neptune-4-plus", product_type: "FDM 3D Printers", vendor: "ELEGOO", published_at: "2026-11-01T00:00:00Z" }
        : { title: "K2 SE 4C 3D Printer", handle: "k2-se-4c-3d-printer", product_type: "Bundles", vendor: "Creality Official Store", published_at: "2026-11-01T00:00:00Z" };
      return new Response(JSON.stringify({ products: [product] }), { headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCatalogModelDiscovery();

    expect(result).toEqual({ ok: false, checked: 2, candidates: 2, sourceFailures: 1, storageFailures: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("continues to later pages until the final partial page", async () => {
    const firstRotatingPage = 2;
    const firstPage = [
      { title: "Known Model", handle: "known-model", product_type: "FDM 3D Printers", vendor: "ANYCUBIC", published_at: "2026-11-01T00:00:00Z" },
      ...Array.from({ length: 249 }, (_, index) => ({ title: `Accessory ${index}`, handle: `accessory-${index}`, product_type: "Accessory", vendor: "ANYCUBIC", published_at: "2026-11-01T00:00:00Z" })),
    ];
    const secondPage = [{ title: "Later Model", handle: "later-model", product_type: "LCD 3D Printers", vendor: "ANYCUBIC", published_at: "2026-11-02T00:00:00Z" }];
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      const products = url.host === "store.anycubic.com"
        ? url.searchParams.get("page") === "1" ? firstPage : url.searchParams.get("page") === String(firstRotatingPage) ? secondPage : []
        : [];
      return new Response(JSON.stringify({ products }), { headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCatalogModelDiscovery();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[0][0])).toContain("page=1");
    expect(String(fetchMock.mock.calls[1][0])).toContain(`page=${firstRotatingPage}`);
    expect(result).toEqual({ ok: true, checked: 2, candidates: 1, sourceFailures: 0, storageFailures: 0 });
    expect(upsert).toHaveBeenCalledWith([expect.objectContaining({ product_title: "Later Model" })], { onConflict: "source_url", ignoreDuplicates: true });
  });

  it("scans page one daily and rotates the remaining page window", async () => {
    const firstWindowPage = 2;
    const secondWindowPage = firstWindowPage + 4;
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get("page"));
      return new Response(JSON.stringify({ products: url.host === "store.anycubic.com" && (page === 1 || page >= firstWindowPage && page < secondWindowPage + 4) ? Array(250).fill({ title: "Accessory" }) : [] }), { headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const firstResult = await runCatalogModelDiscovery();
    const secondResult = await runCatalogModelDiscovery();

    const anycubicPages = fetchMock.mock.calls.filter(([input]) => new URL(String(input)).host === "store.anycubic.com").map(([input]) => new URL(String(input)).searchParams.get("page"));
    expect(anycubicPages[0]).toBe("1");
    expect(anycubicPages[5]).toBe("1");
    expect(anycubicPages.slice(1, 5)).toEqual(Array.from({ length: 4 }, (_, index) => String(firstWindowPage + index)));
    expect(anycubicPages.slice(6)).toEqual(Array.from({ length: 4 }, (_, index) => String(secondWindowPage + index)));
    expect(firstResult).toMatchObject({ ok: true, truncated: true });
    expect(secondResult).toMatchObject({ ok: true, truncated: true });
  });

  it("keeps the page cursor when a rotating page fails", async () => {
    cursorMaybeSingle.mockResolvedValueOnce({ data: { next_page: 2 }, error: null });
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      if (url.host === "store.anycubic.com" && url.searchParams.get("page") === "3") throw new Error("temporary feed failure");
      return new Response(JSON.stringify({ products: url.host === "store.anycubic.com" ? Array(250).fill({ title: "Accessory" }) : [] }), { headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCatalogModelDiscovery();

    expect(result).toMatchObject({ ok: false, sourceFailures: 1 });
    expect(cursorUpsert).not.toHaveBeenCalledWith({ manufacturer: "Anycubic", next_page: 6 }, { onConflict: "manufacturer" });
  });

  it("wraps the cursor after the last supported page", async () => {
    cursorState.set("Anycubic", 498);
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      return new Response(JSON.stringify({ products: url.host === "store.anycubic.com" ? Array(250).fill({ title: "Accessory" }) : [] }), { headers: { "content-type": "application/json" } });
    }));

    await runCatalogModelDiscovery();

    expect(cursorUpsert).toHaveBeenCalledWith({ manufacturer: "Anycubic", next_page: 2 }, { onConflict: "manufacturer" });
  });

  it("skips cleanly until the candidate-queue migration is applied", async () => {
    upsert.mockResolvedValueOnce({ error: { code: "PGRST205" } });

    const result = await runCatalogModelDiscovery();

    expect(result).toEqual({ ok: true, skipped: "migration-required", checked: 2, candidates: 1, sourceFailures: 0, storageFailures: 0 });
  });

  it("skips feed scans until the persistent cursor migration is applied", async () => {
    cursorMaybeSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST205" } });

    const result = await runCatalogModelDiscovery();

    expect(result).toEqual({ ok: true, skipped: "migration-required", checked: 0, candidates: 0, sourceFailures: 0, storageFailures: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
