import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261114060000_designer_service_whatsapp.sql", import.meta.url), "utf8");

describe("designer service WhatsApp notification migration", () => {
  it("queues WhatsApp only for designers with a stored number and opt-in", () => {
    expect(migration).toContain("c.whatsapp is not null and c.whatsapp_opt_in");
    expect(migration).toContain("insert into public.store_notification_deliveries (designer_service_request_id, channel, destination, payload)");
    expect(migration).toContain("select new.id, 'whatsapp', c.whatsapp");
    expect(migration).toContain("on conflict (designer_service_request_id, channel) where designer_service_request_id is not null do nothing");
    expect(migration).not.toContain("new.brief");
  });
});
