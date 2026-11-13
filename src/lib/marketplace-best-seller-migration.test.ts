import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261113093503_marketplace_best_seller_ranking.sql", import.meta.url), "utf8");
const hierarchyMigration = readFileSync(new URL("../../supabase/migrations/20261113133221_marketplace_category_tree_filter.sql", import.meta.url), "utf8");

describe("marketplace best-seller ranking migration", () => {
  it("counts only accepted, paid purchases and exposes only published catalog items", () => {
    expect(migration).toMatch(/language sql stable security definer set search_path = ''/);
    expect(migration.match(/payment\.status in \('paid', 'partially_refunded'\)/g)).toHaveLength(2);
    expect(migration).toContain("o.status = 'accepted'");
    expect(migration).toContain("request.request_type = 'purchase' and request.status = 'accepted'");
    expect(migration).toContain("product.catalog_status = 'published'");
    expect(migration).toContain("store.status = 'published'");
    expect(migration).toContain("category.active");
    expect(migration).toContain("revoke all on function public.get_marketplace_best_sellers(text, text, integer, integer) from public");
    expect(migration).toContain("to anon, authenticated");
  });
});

describe("marketplace category tree filter migration", () => {
  it("includes active descendants in best-seller category filtering and stops cycles", () => {
    expect(hierarchyMigration).toMatch(/with recursive selected_categories\(id\) as/i);
    expect(hierarchyMigration).toMatch(/union\s+select child\.id/i);
    expect(hierarchyMigration).toContain("where child.active");
    expect(hierarchyMigration).toContain("category.id in (select id from selected_categories)");
    expect(hierarchyMigration).toContain("revoke all on function public.get_marketplace_best_sellers(text, text, integer, integer) from public");
  });
});
