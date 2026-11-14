import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClient } = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));

import { loadMarketplaceCatalog } from "./marketplace.server";

describe("offline marketplace catalog", () => {
  beforeEach(() => createSupabaseServerClient.mockResolvedValue(null));

  it("lists and filters keychains by the Chaveiros category", async () => {
    const catalog = await loadMarketplaceCatalog({ category: "chaveiros" });

    expect(catalog.categories.map(({ slug }) => slug)).toContain("chaveiros");
    expect(catalog.products.map(({ slug }) => slug)).toEqual(["chaveiro-monograma"]);
  });

  it("returns no products for an unknown category", async () => {
    const catalog = await loadMarketplaceCatalog({ category: "nao-existe" });

    expect(catalog.products).toEqual([]);
  });
});
