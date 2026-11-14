import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), loadAdminUserDirectory: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/admin-user-directory.server", () => ({ loadAdminUserDirectory: mocks.loadAdminUserDirectory }));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));

import AdminUsersPage from "./page";

describe("admin users page", () => {
  beforeEach(() => { mocks.getUserWithRole.mockReset(); mocks.loadAdminUserDirectory.mockReset(); });

  it("redirects unauthenticated and non-admin users before loading personal data", async () => {
    mocks.getUserWithRole.mockResolvedValue({ supabase: null, authorized: false });
    await expect(AdminUsersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/conta");
    mocks.getUserWithRole.mockResolvedValue({ supabase: {}, authorized: false });
    await expect(AdminUsersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/conta");
    expect(mocks.loadAdminUserDirectory).not.toHaveBeenCalled();
  });

  it("passes a validated page number to the directory loader", async () => {
    mocks.getUserWithRole.mockResolvedValue({ supabase: {}, authorized: true });
    mocks.loadAdminUserDirectory.mockResolvedValue({ users: [], page: 2, pageSize: 25, total: 26, pages: 2, error: false });
    await AdminUsersPage({ searchParams: Promise.resolve({ page: "2", q: "maker" }) });
    expect(mocks.loadAdminUserDirectory).toHaveBeenCalledWith(2);
  });
});
