import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseAdminClient } = vi.hoisted(() => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient }));

import { loadAdminUserDirectory } from "./admin-user-directory.server";

function makeQuery(data: unknown[] | null, error: unknown = null) {
  const query = { select: vi.fn(), in: vi.fn() };
  query.select.mockReturnValue(query);
  query.in.mockResolvedValue({ data, error });
  return query;
}

describe("admin user directory loader", () => {
  beforeEach(() => createSupabaseAdminClient.mockReset());

  it("loads a bounded auth page and joins only profile names and current roles", async () => {
    const listUsers = vi.fn().mockResolvedValue({ data: { users: [{ id: "u1", email: "maker@example.com", created_at: "2026-11-01T00:00:00Z", email_confirmed_at: null }], total: 26 }, error: null });
    const profiles = makeQuery([{ id: "u1", display_name: "Maker" }]);
    const roles = makeQuery([{ user_id: "u1", role: "maker" }, { user_id: "u1", role: "buyer" }]);
    const from = vi.fn((table: string) => table === "profiles" ? profiles : roles);
    createSupabaseAdminClient.mockReturnValue({ auth: { admin: { listUsers } }, from });

    const result = await loadAdminUserDirectory(2);

    expect(listUsers).toHaveBeenCalledWith({ page: 2, perPage: 25 });
    expect(profiles.in).toHaveBeenCalledWith("id", ["u1"]);
    expect(roles.in).toHaveBeenCalledWith("user_id", ["u1"]);
    expect(result).toMatchObject({ page: 2, pageSize: 25, total: 26, pages: 2, error: false,
      users: [{ id: "u1", displayName: "Maker", roles: ["buyer", "maker"] }] });
  });

  it("fails closed when auth or role/profile lookup fails", async () => {
    createSupabaseAdminClient.mockReturnValue({ auth: { admin: { listUsers: vi.fn().mockResolvedValue({ data: { users: [], total: 0 }, error: new Error("auth failed") }) } } });
    expect(await loadAdminUserDirectory(1)).toMatchObject({ users: [], error: true });

    createSupabaseAdminClient.mockReturnValue({ auth: { admin: { listUsers: vi.fn().mockResolvedValue({ data: { users: [{ id: "u1", created_at: "2026-11-01" }], total: 1 }, error: null }) } },
      from: vi.fn((table: string) => table === "profiles" ? makeQuery([], new Error("profile lookup failed")) : makeQuery([])) });
    expect(await loadAdminUserDirectory(1)).toMatchObject({ users: [], error: true });
  });

  it("clamps pages beyond the last account page", async () => {
    const listUsers = vi.fn()
      .mockResolvedValueOnce({ data: { users: [], total: 26 }, error: null })
      .mockResolvedValueOnce({ data: { users: [], total: 26 }, error: null });
    createSupabaseAdminClient.mockReturnValue({ auth: { admin: { listUsers } } });

    expect(await loadAdminUserDirectory(99)).toMatchObject({ page: 2, pages: 2, total: 26, error: false });
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 25 });
  });
});
