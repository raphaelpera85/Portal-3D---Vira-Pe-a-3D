import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapFirstAdmin } from "../../scripts/bootstrap-admin.mjs";

describe("first administrator bootstrap", () => {
  let roleQuery: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; limit: ReturnType<typeof vi.fn> };
  let listUsers: ReturnType<typeof vi.fn>;
  let insert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    insert = vi.fn().mockResolvedValue({ error: null });
    roleQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    roleQuery.select.mockReturnValue(roleQuery);
    roleQuery.eq.mockReturnValue(roleQuery);
    listUsers = vi.fn().mockResolvedValue({ data: { users: [{ id: "user-1", email: "owner@example.com", email_confirmed_at: "2026-11-13T00:00:00Z" }] }, error: null });
  });

  it("promotes only the exact confirmed account when no administrator exists", async () => {
    const supabase = { from: vi.fn().mockReturnValue({ select: roleQuery.select, eq: roleQuery.eq, limit: roleQuery.limit, insert }) , auth: { admin: { listUsers } } };

    const result = await bootstrapFirstAdmin(supabase, " Owner@Example.com ");

    expect(roleQuery.eq).toHaveBeenCalledWith("role", "admin");
    expect(listUsers).toHaveBeenCalledWith({ page: 1, perPage: 1000 });
    expect(insert).toHaveBeenCalledWith({ user_id: "user-1", role: "admin" });
    expect(result).toEqual({ userId: "user-1", email: "owner@example.com" });
  });

  it("refuses to create a second first-admin grant", async () => {
    roleQuery.limit.mockResolvedValue({ data: [{ user_id: "existing-admin" }], error: null });
    const supabase = { from: vi.fn().mockReturnValue({ select: roleQuery.select, eq: roleQuery.eq, limit: roleQuery.limit, insert }), auth: { admin: { listUsers } } };

    await expect(bootstrapFirstAdmin(supabase, "owner@example.com")).rejects.toThrow("An administrator already exists");
    expect(listUsers).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("requires the specified account to exist and have a confirmed email", async () => {
    listUsers.mockResolvedValue({ data: { users: [{ id: "user-1", email: "owner@example.com", email_confirmed_at: null }] }, error: null });
    const supabase = { from: vi.fn().mockReturnValue({ select: roleQuery.select, eq: roleQuery.eq, limit: roleQuery.limit, insert }), auth: { admin: { listUsers } } };

    await expect(bootstrapFirstAdmin(supabase, "owner@example.com")).rejects.toThrow("Confirm this account's email first");
    expect(insert).not.toHaveBeenCalled();
  });

  it("validates the requested address before querying Supabase", async () => {
    const supabase = { from: vi.fn(), auth: { admin: { listUsers } } };

    await expect(bootstrapFirstAdmin(supabase, "not-an-email")).rejects.toThrow("Provide a valid email address");
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
