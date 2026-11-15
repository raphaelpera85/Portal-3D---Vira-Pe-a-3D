import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/creator-models.server", () => ({ loadPublishedCreatorModels: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import sitemap from "./sitemap";

describe("public sitemap", () => {
  const tables = new Map<string, { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; order: ReturnType<typeof vi.fn>; range: ReturnType<typeof vi.fn> }>();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://virapeca.example");
    vi.stubEnv("SITE_LEGAL_PAGES_APPROVED", "false");
    vi.stubEnv("SITE_LEGAL_NAME", "");
    vi.stubEnv("SITE_LEGAL_ID", "");
    vi.stubEnv("SITE_LEGAL_ADDRESS", "");
    vi.stubEnv("SITE_PRIVACY_EMAIL", "");
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

  it("keeps legal pages out of the sitemap until approved with complete contact details", async () => {
    vi.stubEnv("SITE_LEGAL_PAGES_APPROVED", "true");
    vi.stubEnv("SITE_LEGAL_NAME", "ViraPeça 3D");
    vi.stubEnv("SITE_LEGAL_ID", "00.000.000/0001-00");
    vi.stubEnv("SITE_LEGAL_ADDRESS", "Santos, SP");

    const urls = (await sitemap()).map((page) => page.url);

    expect(urls).not.toContain("https://virapeca.example/privacidade");
    expect(urls).not.toContain("https://virapeca.example/termos");
  });

  it("adds legal pages when approval and all required identity fields are configured", async () => {
    vi.stubEnv("SITE_LEGAL_PAGES_APPROVED", "true");
    vi.stubEnv("SITE_LEGAL_NAME", "ViraPeça 3D");
    vi.stubEnv("SITE_LEGAL_ID", "00.000.000/0001-00");
    vi.stubEnv("SITE_LEGAL_ADDRESS", "Santos, SP");
    vi.stubEnv("SITE_PRIVACY_EMAIL", "privacidade@virapeca3d.com.br");

    const urls = (await sitemap()).map((page) => page.url);

    expect(urls).toContain("https://virapeca.example/privacidade");
    expect(urls).toContain("https://virapeca.example/termos");
  });
});
