import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import sitemap from "./sitemap";

describe("public sitemap", () => {
  const tables = new Map<string, { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; order: ReturnType<typeof vi.fn>; range: ReturnType<typeof vi.fn> }>();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://virapeca.example");
    tables.clear();
    mocks.createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        const query = {
          select: vi.fn(),
          eq: vi.fn(),
          order: vi.fn(),
          range: vi.fn().mockResolvedValue({ data: [] }),
        };
        query.select.mockReturnValue(query);
        query.eq.mockReturnValue(query);
        query.order.mockReturnValue(query);
        tables.set(table, query);
        return query;
      }),
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("includes products only when their store is published and category is active", async () => {
    await sitemap();

    const products = tables.get("marketplace_products");
    expect(products?.select).toHaveBeenCalledWith("slug, updated_at, media, store:stores!inner(status), category:product_categories!inner(active)");
    expect(products?.eq).toHaveBeenCalledWith("catalog_status", "published");
    expect(products?.eq).toHaveBeenCalledWith("store.status", "published");
    expect(products?.eq).toHaveBeenCalledWith("category.active", true);
  });
});
