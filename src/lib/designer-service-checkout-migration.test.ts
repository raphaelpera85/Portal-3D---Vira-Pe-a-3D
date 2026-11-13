import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261114070000_designer_service_checkout.sql", import.meta.url), "utf8");

describe("designer service checkout migration", () => {
  it("accepts only the buyer's quoted service and persists its price and store snapshot", () => {
    expect(migration).toContain("designer_service_request_id uuid references public.designer_service_requests (id)");
    expect(migration).toContain("num_nonnulls(order_id, purchase_request_id, custom_print_request_id, designer_service_request_id) = 1");
    expect(migration).toContain("q.id = p_request_id and q.buyer_id = p_buyer_id");
    expect(migration).toContain("q.status in ('quoted', 'accepted')");
    expect(migration).toContain("d.status = 'published'");
    expect(migration).toContain("s.status = 'published'");
    expect(migration).toContain("request_row.quote_amount_cents");
    expect(migration).toContain("p_marketplace_fee_cents >= request_row.quote_amount_cents");
    expect(migration).toContain("grant execute on function public.create_designer_service_payment(uuid, uuid, bigint) to service_role");
  });

  it("prevents replay after a chargeback and advances the brief only after payment confirmation", () => {
    expect(migration).toContain("new.designer_service_request_id is not null and p.designer_service_request_id = new.designer_service_request_id");
    expect(migration).toContain("new.status = 'paid'");
    expect(migration).toContain("set status = 'paid'");
    expect(migration).toContain("status = 'accepted'");
    expect(migration).toMatch(/create unique index seller_designer_service_payment_one_active[\s\S]*?status in \('creating', 'pending'\)/);
  });
});
