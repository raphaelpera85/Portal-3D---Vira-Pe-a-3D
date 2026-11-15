import { describe, expect, it } from "vitest";
import { applySessionCookiePolicy, shouldRememberSession } from "./session-cookie-policy";

describe("Supabase session cookie policy", () => {
  it("keeps a remembered session for 30 days", () => {
    expect(applySessionCookiePolicy({ path: "/", maxAge: 400 * 24 * 60 * 60 }, true)).toEqual({
      path: "/", maxAge: 30 * 24 * 60 * 60,
    });
  });

  it("uses a browser-session cookie when remember me is disabled", () => {
    expect(applySessionCookiePolicy({ path: "/", maxAge: 400 * 24 * 60 * 60 }, false)).toEqual({ path: "/" });
  });

  it("keeps existing sessions remembered unless the user opted out", () => {
    expect(shouldRememberSession(undefined)).toBe(true);
    expect(shouldRememberSession("1")).toBe(true);
    expect(shouldRememberSession("0")).toBe(false);
  });
});
