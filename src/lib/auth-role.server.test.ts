import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { getUserWithRole } from "./auth-role.server";

describe("getUserWithRole", () => {
  beforeEach(() => mocks.createSupabaseServerClient.mockReset());

  it.each(["maker", "designer"] as const)("authorizes the %s role for creator tools", async (role) => {
    const roleFilter = vi.fn().mockResolvedValue({ data: [{ role }], error: null });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ in: roleFilter })) })) })),
    };
    mocks.createSupabaseServerClient.mockResolvedValue(client);

    const result = await getUserWithRole(["maker", "designer"]);

    expect(result).toMatchObject({ authorized: true, roles: [role] });
    expect(roleFilter).toHaveBeenCalledWith("role", ["maker", "designer"]);
  });

  it("does not authorize buyer accounts for creator tools", async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) })) })) })),
    };
    mocks.createSupabaseServerClient.mockResolvedValue(client);

    const result = await getUserWithRole(["maker", "designer"]);

    expect(result.authorized).toBe(false);
    expect(result.roles).toEqual([]);
  });
});
