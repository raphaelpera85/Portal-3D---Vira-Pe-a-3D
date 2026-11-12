import { describe, expect, it } from "vitest";
import { validateCredentials, validateRegistration } from "./auth-validation";

describe("auth form validation", () => {
  it("normalizes email and preserves the password exactly", () => {
    expect(validateCredentials("  Pessoa@Exemplo.com ", "senh@ segura")).toEqual({ email: "pessoa@exemplo.com", password: "senh@ segura" });
  });

  it("rejects malformed, oversized, and missing credentials", () => {
    expect(validateCredentials("sem-email", "12345678")).toBeNull();
    expect(validateCredentials("user@example.com", "1234567")).toBeNull();
    expect(validateCredentials("user@example.com", "x".repeat(129))).toBeNull();
    expect(validateCredentials(new File([], "email"), "12345678")).toBeNull();
  });

  it("trims a valid display name and rejects names outside the supported range", () => {
    expect(validateRegistration(" Maria Silva ", "maria@example.com", "12345678")?.displayName).toBe("Maria Silva");
    expect(validateRegistration("A", "maria@example.com", "12345678")).toBeNull();
    expect(validateRegistration("x".repeat(81), "maria@example.com", "12345678")).toBeNull();
  });
});
