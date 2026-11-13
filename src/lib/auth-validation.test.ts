import { describe, expect, it } from "vitest";
import { validateEmailAddress } from "./auth-validation";

describe("email validation", () => {
  it("normalizes valid email addresses for authentication", () => {
    expect(validateEmailAddress(" RaphaelPera85@Gmail.com ")).toBe("raphaelpera85@gmail.com");
  });

  it("rejects malformed, non-string, and overlong email addresses", () => {
    expect(validateEmailAddress("not-an-email")).toBeNull();
    expect(validateEmailAddress(null)).toBeNull();
    expect(validateEmailAddress(`${"a".repeat(243)}@example.com`)).toBeNull();
  });
});
