import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261114100000_designer_service_deliveries.sql", import.meta.url), "utf8");

describe("designer service delivery migration", () => {
  it("keeps uploaded files private and readable only by the request participants", () => {
    expect(migration).toContain("'designer-service-deliveries', 'designer-service-deliveries', false, 52428800");
    expect(migration).toContain("alter table public.designer_service_delivery_files enable row level security");
    expect(migration).toContain("Participants can read designer service delivery files");
    expect(migration).toContain("Participants can download registered designer deliverables");
    expect(migration).toContain("q.buyer_id = (select auth.uid()) or d.user_id = (select auth.uid())");
    expect(migration).toContain("revoke all on public.designer_service_deliveries, public.designer_service_delivery_files,");
    expect(migration).toContain("designer_service_delivery_uploads from anon, authenticated");
  });

  it("checks file count, extension, size, ownership, and storage existence at completion", () => {
    expect(migration).toContain("jsonb_array_length(p_files) not between 1 and 10");
    expect(migration).toContain("file_row->>'extension'");
    expect(migration).toContain("total_bytes > 104857600");
    expect(migration).toContain("storage_size is distinct from (file_row->>'size')::bigint");
    expect(migration).toContain("u.file_name = file_row->>'name'");
    expect(migration).toContain("u.created_by = actor_id");
    expect(migration).toMatch(/revoke all on function public\.submit_designer_service_delivery\(uuid, text, jsonb\),[\s\S]*?from public, anon/);
  });
});
