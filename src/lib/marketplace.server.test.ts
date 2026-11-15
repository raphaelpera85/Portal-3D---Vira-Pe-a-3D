import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn(), loadPublishedCreatorModel: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/lib/creator-models.server", () => ({ loadPublishedCreatorModel: mocks.loadPublishedCreatorModel }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn(() => null) }));

import { loadMarketplaceCatalog, loadMarketplaceProduct } from "./marketplace.server";

describe("offline marketplace catalog", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockResolvedValue(null);
    mocks.loadPublishedCreatorModel.mockReset();
  });

  it("lists and filters keychains by the Chaveiros category", async () => {
    const catalog = await loadMarketplaceCatalog({ category: "chaveiros" });

    expect(catalog.categories.map(({ slug }) => slug)).toContain("chaveiros");
    expect(catalog.products.map(({ slug }) => slug)).toEqual(["chaveiro-monograma"]);
  });

  it("returns no products for an unknown category", async () => {
    const catalog = await loadMarketplaceCatalog({ category: "nao-existe" });

    expect(catalog.products).toEqual([]);
  });

  it("resolves a seller's published creator model as a product preview", async () => {
    const modelId = "4d06021fc27c";
    const row = {
      id: "product-creator-preview", slug: "suporte-de-mesa", name: "Suporte de mesa", listing_type: "physical",
      price_mode: "quote", product_properties: { model_preview_id: modelId },
      store: { name: "Oficina", slug: "oficina" }, category: { name: "Acessórios", slug: "acessorios" },
    };
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
    mocks.createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => query) });
    mocks.loadPublishedCreatorModel.mockResolvedValue({ id: modelId, name: "Suporte de mesa", filePath: "", assetUrl: "https://signed.example/model.3mf" });

    const product = await loadMarketplaceProduct(row.slug);

    expect(mocks.loadPublishedCreatorModel).toHaveBeenCalledWith(modelId);
    expect(product?.modelPreview).toEqual({ name: "Suporte de mesa", url: "https://signed.example/model.3mf" });
  });
});
