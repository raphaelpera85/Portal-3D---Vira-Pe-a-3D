import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261115095921_authenticated_definer_wrapper_guards.sql", import.meta.url), "utf8");
const wrappers = [
  ["create_maker_consignment_item_with_fees", "create_maker_consignment_item"],
  ["set_seller_order_shipping_quote_with_packages", "set_seller_order_shipping_quote"],
  ["set_custom_print_shipping_quote_with_packages", "set_custom_print_shipping_quote"],
] as const;

describe("authenticated SECURITY DEFINER wrappers", () => {
  it.each(wrappers)("checks maker identity before %s delegates authorization", (name, delegatedFunction) => {
    const start = migration.indexOf(`create or replace function public.${name}(`);
    const end = migration.indexOf("\n", migration.indexOf(`grant execute on function public.${name}(`, start));
    const definition = migration.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(definition).toContain("security definer");
    expect(definition).toContain("set search_path = ''");
    expect(definition).toContain("if (select auth.uid()) is null");
    expect(definition).toContain("r.role = 'maker'::public.app_role");
    expect(definition).toContain(`public.${delegatedFunction}(`);
    expect(definition).toContain(`revoke all on function public.${name}(`);
    expect(definition).toContain("from public, anon");
    expect(definition).toContain(`grant execute on function public.${name}(`);
    expect(definition).toContain("to authenticated");
  });
});
