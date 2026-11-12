import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./site-url";

describe("resolveSiteUrl", () => {
  it("uses the configured HTTPS origin and normalizes the root", () => {
    expect(resolveSiteUrl("https://virapeca.example/", true)?.origin).toBe("https://virapeca.example");
  });

  it("does not publish a localhost or insecure production canonical URL", () => {
    expect(resolveSiteUrl("http://localhost:3000", true)).toBeNull();
    expect(resolveSiteUrl("http://virapeca.example", true)).toBeNull();
    expect(resolveSiteUrl(undefined, true)).toBeNull();
  });
});
