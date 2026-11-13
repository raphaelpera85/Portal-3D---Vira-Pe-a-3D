import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261113123021_melhor_envio_multi_volume.sql", import.meta.url), "utf8");

describe("Mejor Envio multi-volume migration", () => {
  it("persists validated quotes and exposes provider labels as child shipments", () => {
    expect(migration).toContain("shipping_quote_packages jsonb not null default '[]'::jsonb");
    expect(migration).toContain("is_valid_melhor_envio_packages(p_packages)");
    expect(migration).toContain("set_seller_order_shipping_quote_with_packages");
    expect(migration).toContain("set_custom_print_shipping_quote_with_packages");
    expect(migration).toContain("create table public.seller_order_shipping_label_packages");
    expect(migration).toContain("provider_order_id text not null unique");
    expect(migration).toContain("add column package_count smallint not null default 1");
    expect(migration).toContain("from public.seller_order_shipping_labels where provider_order_id is not null");
  });

  it("keeps package rows private to shipping participants", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on public.seller_order_shipping_label_packages from public, anon, authenticated");
    expect(migration).toContain("create function public.get_shipping_label_packages()");
    expect(migration).toContain("where o.buyer_id = (select auth.uid()) or q.buyer_id = (select auth.uid())");
    expect(migration).toContain("grant execute on function public.get_shipping_label_packages() to authenticated");
  });
});
