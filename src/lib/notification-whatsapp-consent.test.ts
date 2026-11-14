import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261115232000_whatsapp_notification_consent.sql", import.meta.url), "utf8");

describe("WhatsApp notification consent migration", () => {
  it("cancels delivery when the current contact no longer matches or consents", () => {
    expect(migration).toContain("'failed', 'cancelled'");
    expect(migration).toMatch(/join public\.store_notification_contacts c on c\.whatsapp = d\.destination and c\.whatsapp_opt_in/);
    expect(migration).toContain("q.id = d.request_id and q.store_id = c.store_id");
    expect(migration).toContain("o.id = d.order_id and o.store_id = c.store_id");
    expect(migration).toContain("t.id = d.custom_print_target_id and t.store_id = c.store_id");
    expect(migration).toContain("r.id = d.designer_service_request_id and s.id = c.store_id");
    expect(migration).toContain("status = 'cancelled', last_error = 'WhatsApp consent revoked or contact changed'");
    expect(migration).toMatch(/authorize_store_notification_whatsapp_delivery\(uuid\) to service_role/);
  });

  it("requires active consent before seller retry actions can requeue WhatsApp", () => {
    expect(migration).toMatch(/retry_store_notification_delivery\(delivery_id uuid\)[\s\S]*?d\.channel <> 'whatsapp' or public\.store_notification_whatsapp_consent_is_current\(d\.id\)/);
    expect(migration).toMatch(/retry_custom_print_notification_delivery\(p_delivery_id uuid\)[\s\S]*?d\.channel <> 'whatsapp' or public\.store_notification_whatsapp_consent_is_current\(d\.id\)/);
  });
});
