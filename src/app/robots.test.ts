import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "./robots";

describe("robots metadata", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps the creator-only calculator out of crawler access", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://virapeca.example");

    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rules.disallow).toContain("/calculadora");
    expect(rules.allow).toBe("/");
    expect(result.sitemap).toBe("https://virapeca.example/sitemap.xml");
  });
});
