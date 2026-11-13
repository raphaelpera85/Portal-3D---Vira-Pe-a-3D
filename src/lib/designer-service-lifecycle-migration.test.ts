import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261114080000_designer_service_lifecycle.sql", import.meta.url), "utf8");

describe("designer service lifecycle migration", () => {
  it("records work dates only in valid paid and completed states", () => {
    expect(migration).toContain("status in ('pending', 'quoted', 'accepted', 'paid', 'in_progress', 'completed')");
    expect(migration).toContain("work_started_at timestamptz");
    expect(migration).toContain("work_completed_at timestamptz");
    expect(migration).toContain("status = 'in_progress' and work_started_at is not null and work_completed_at is null");
    expect(migration).toContain("status = 'completed' and work_started_at is not null and work_completed_at is not null");
  });

  it("authorizes the assigned designer and requires a paid checkout for both transitions", () => {
    expect(migration).toContain("d.user_id = actor_id");
    expect(migration).toContain("r.role = 'designer'::public.app_role");
    expect(migration).toContain("request_row.status = 'paid' and p_next_status = 'in_progress'");
    expect(migration).toContain("request_row.status = 'in_progress' and p_next_status = 'completed'");
    expect(migration).toContain("payment_status is distinct from 'paid'");
    expect(migration).toContain("revoke all on function public.advance_designer_service_work(uuid, text) from public, anon");
    expect(migration).toContain("grant execute on function public.advance_designer_service_work(uuid, text) to authenticated");
  });
});
