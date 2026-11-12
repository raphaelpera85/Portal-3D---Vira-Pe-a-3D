import { afterEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn(() => ({ admin: true })) }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));

import { createSupabaseAdminClient } from "./admin";

describe("Supabase admin client credentials", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    createClientMock.mockClear();
  });

  it("prefers the current secret key and accepts the legacy service role key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_current");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy_service_role");
    expect(createSupabaseAdminClient()).toEqual({ admin: true });
    expect(createClientMock).toHaveBeenCalledWith("https://project.supabase.co", "sb_secret_current", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it("keeps legacy service role support while the project rotates keys", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy_service_role");
    createSupabaseAdminClient();
    expect(createClientMock).toHaveBeenCalledWith("https://project.supabase.co", "legacy_service_role", expect.any(Object));
  });
});
