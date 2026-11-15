import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));

import CalculatorPage from "./page";

describe("calculator page access", () => {
  beforeEach(() => mocks.getUserWithRole.mockReset());

  it("redirects unauthenticated visitors to the account page", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: null, authorized: false, roles: [], supabase: null });

    await expect(CalculatorPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/conta");
  });

  it("explains the creator approval requirement to authenticated buyers", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "buyer-1" }, authorized: false, roles: ["buyer"], supabase: {} });

    await expect(CalculatorPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/conta?acesso=calculadora");
  });
});
