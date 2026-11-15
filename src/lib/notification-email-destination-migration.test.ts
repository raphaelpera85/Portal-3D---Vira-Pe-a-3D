import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261115015552_vendor_notification_status_and_current_email.sql", import.meta.url), "utf8");

describe("seller notification status and email destination migration", () => {
  it("publishes delivery state changes while keeping email lookup service-role-only", () => {
    expect(migration).toContain("tablename = 'store_notification_deliveries'");
    expect(migration).toContain("returns text");
    expect(migration).toContain("d.channel = 'email' and d.status = 'sending'");
    expect(migration).toContain("set destination = current_email");
    expect(migration).toContain("set status = 'cancelled', last_error = 'Email contact unavailable'");
    expect(migration).toContain("revoke all on function public.authorize_store_notification_email_delivery(uuid) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.authorize_store_notification_email_delivery(uuid) to service_role");
    expect(migration).toMatch(/drop policy "Makers can read delivery status for their requests and orders"[\s\S]*?\(request_id is not null[\s\S]*?\) or \(order_id is not null[\s\S]*?\)\s*\) and exists \([\s\S]*?r\.role = 'maker'::public\.app_role/);
    expect(migration).toMatch(/drop policy "Designers can read delivery status for their service requests"[\s\S]*?designer_service_request_id is not null[\s\S]*?r\.role = 'designer'::public\.app_role/);
    expect(migration).toMatch(/drop policy "Makers read custom print notification delivery status"[\s\S]*?custom_print_target_id is not null[\s\S]*?r\.role = 'maker'::public\.app_role/);
  });
});
