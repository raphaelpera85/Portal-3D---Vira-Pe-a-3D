import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { decryptMercadoPagoToken, encryptMercadoPagoToken } from "./mercado-pago-token";
import { buildMercadoPagoAuthorizationUrl, createMercadoPagoPkce, createMercadoPagoState, verifyMercadoPagoState } from "./mercado-pago-oauth";

const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("Mercado Pago token encryption", () => {
  it("encrypts tokens so only the same configured key can recover them", () => {
    const encrypted = encryptMercadoPagoToken("APP_USR-secret-access-token", key);
    expect(encrypted).not.toContain("APP_USR-secret-access-token");
    expect(decryptMercadoPagoToken(encrypted, key)).toBe("APP_USR-secret-access-token");
    expect(() => decryptMercadoPagoToken(encrypted, "f".repeat(64))).toThrow();
  });

  it("rejects missing keys and malformed ciphertext", () => {
    expect(() => encryptMercadoPagoToken("token", "short")).toThrow();
    expect(() => decryptMercadoPagoToken("v1:invalid", key)).toThrow();
  });

  it("binds OAuth state to the authenticated maker and builds a fixed Mercado Pago callback", () => {
    const state = createMercadoPagoState("maker-1", "app-secret");
    const { challenge, verifier } = createMercadoPagoPkce();
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(verifyMercadoPagoState(state, "maker-1", "app-secret")).toBe(true);
    expect(verifyMercadoPagoState(state, "maker-2", "app-secret")).toBe(false);
    expect(verifyMercadoPagoState(`${state}x`, "maker-1", "app-secret")).toBe(false);
    const url = new URL(buildMercadoPagoAuthorizationUrl("123", "https://site.example/api/payments/mercado-pago/callback", state, challenge));
    expect(url.origin).toBe("https://auth.mercadopago.com");
    expect(url.searchParams.get("redirect_uri")).toBe("https://site.example/api/payments/mercado-pago/callback");
    expect(url.searchParams.get("state")).toBe(state);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(challenge);
  });
});
