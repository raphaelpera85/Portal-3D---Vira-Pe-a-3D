import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261113230000_calculator_variant_price_rpc.sql", import.meta.url), "utf8");

describe("calculator product variant price migration", () => {
  it("locks the seller-owned listing, rejects stale or reserved variants and refreshes the minimum listing price", () => {
    expect(migration).toMatch(/security definer\s+set search_path = ''/);
    expect(migration).toMatch(/p\.created_by = \(select auth\.uid\(\)\) and s\.owner_user_id = \(select auth\.uid\(\)\)[\s\S]*?for update of p/);
    expect(migration).toMatch(/round\(variant_row\.price_brl \* 100\)::bigint <> p_expected_price_cents/);
    expect(migration).toMatch(/seller_order_payment_variant_reservations[\s\S]*?r\.released_at is null and r\.fulfilled_at is null/);
    expect(migration).toMatch(/select min\(v\.price_brl\)[\s\S]*?set price_brl = minimum_price/);
    expect(migration).toContain("to authenticated");
  });
});
