import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261114090000_user_notifications.sql", import.meta.url), "utf8");

describe("user notifications migration", () => {
  it("creates private read-only notification records for designer service milestones", () => {
    expect(migration).toContain("create table public.user_notifications");
    expect(migration).toContain("user_id = (select auth.uid())");
    expect(migration).toContain("grant select on public.user_notifications to authenticated");
    expect(migration).toContain("revoke all on public.user_notifications from anon, authenticated");
    expect(migration).toContain("unique (designer_service_request_id, notification_type)");
    expect(migration).toContain("when 'quoted' then 'designer_service_quote'");
    expect(migration).toContain("when 'paid' then 'designer_service_paid'");
    expect(migration).toContain("when 'in_progress' then 'designer_service_started'");
    expect(migration).toContain("when 'completed' then 'designer_service_completed'");
    expect(migration).toContain("on conflict (designer_service_request_id, notification_type) do nothing");
  });

  it("lets an authenticated user mark only their own notification read", () => {
    expect(migration).toContain("where id = p_notification_id and user_id = (select auth.uid())");
    expect(migration).toContain("public.mark_user_notification_read(uuid) from public, anon");
    expect(migration).toContain("grant execute on function public.mark_user_notification_read(uuid) to authenticated");
  });
});
