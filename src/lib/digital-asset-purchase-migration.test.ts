import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261115233000_digital_asset_purchase_idempotency.sql", import.meta.url), "utf8");

describe("digital asset purchase migration", () => {
  it("serializes identical purchase intents and returns an existing active request", () => {
    const lookup = migration.indexOf("select q.id into request_id");
    const insert = migration.indexOf("insert into public.product_quote_requests");

    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended(");
    expect(migration).toMatch(/q\.buyer_id = actor_id[\s\S]*?q\.product_id = p_product_id[\s\S]*?q\.license_type = p_license_type[\s\S]*?q\.status = 'accepted'/);
    expect(lookup).toBeGreaterThanOrEqual(0);
    expect(insert).toBeGreaterThan(lookup);
    expect(migration).toContain("p.status in ('paid', 'partially_refunded', 'refunded', 'charged_back')");
    expect(migration).toContain("set unit_price_brl = license_price");
    expect(migration).toContain("p.status in ('creating', 'pending'));");
  });

  it("accepts a licensed digital asset checkout without reserving physical stock", () => {
    expect(migration).toContain("p.listing_type = 'digital' and p.fulfillment_mode = 'digital'");
    expect(migration).toMatch(/digital_assets d where d\.product_id = p\.id and d\.store_id = p\.store_id[\s\S]*?end\) = request_row\.unit_price_brl/);
    expect(migration).toMatch(/if request_row\.license_type is null then[\s\S]*?reserve_seller_order_product_stock[\s\S]*?end if;/);
    expect(migration).toContain("request_row.license_type in ('personal', 'commercial')");
  });
});
