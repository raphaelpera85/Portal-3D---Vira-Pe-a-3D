import { expect, test } from "@playwright/test";

test("public responses include browser security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();

  expect(response.ok()).toBe(true);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers).not.toHaveProperty("x-powered-by");
});
