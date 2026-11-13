import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261114050000_designer_service_request_notifications.sql", import.meta.url), "utf8");

describe("designer service notification migration", () => {
  it("queues only a minimal email to the designer's registered store contact", () => {
    expect(migration).toContain("designer_service_request_id uuid references public.designer_service_requests (id)");
    expect(migration).toContain("num_nonnulls(request_id, order_id, custom_print_target_id, support_message_id, designer_service_request_id) = 1");
    expect(migration).toContain("create policy \"Designers can read delivery status for their service requests\"");
    expect(migration).toContain("insert into public.store_notification_deliveries (designer_service_request_id, channel, destination, payload)");
    expect(migration).toMatch(/jsonb_build_object\([\s\S]*'notification_type', 'designer_service_request',[\s\S]*'project_title', left\(new\.title, 120\)/);
    expect(migration).toContain("where s.owner_user_id = profile_row.user_id");
    expect(migration).not.toContain("new.brief");
    expect(migration).toContain("where c.store_id = designer_store_id");
    expect(migration).not.toMatch(/select new\.id, 'whatsapp'/);
  });
});
