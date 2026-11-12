import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }));

import { proxy } from "./proxy";

describe("Supabase session proxy", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    createServerClientMock.mockImplementation((_url, _key, { cookies }) => ({
      auth: {
        getClaims: async () => {
          cookies.setAll(
            [{ name: "verifier", value: "", options: { path: "/", maxAge: 0 } }],
            { "cache-control": "private, no-store", expires: "0", pragma: "no-cache" },
          );
          cookies.setAll([{ name: "session", value: "fresh", options: { path: "/" } }], {});
          return { data: { claims: {} }, error: null };
        },
      },
    }));
  });

  it("keeps all cookie writes and cache headers when refreshing a session", async () => {
    const response = await proxy(new NextRequest("http://localhost/"));

    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.cookies.getAll().map(({ name }) => name)).toEqual(
      expect.arrayContaining(["verifier", "session"]),
    );
  });
});
