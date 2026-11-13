import { describe, expect, it } from "vitest";
import { getIntegrationHealth } from "./integration-health";

describe("getIntegrationHealth", () => {
  it("reports required runtime integrations without exposing configured values", () => {
    const result = getIntegrationHealth({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-secret-value",
      SUPABASE_SECRET_KEY: "sb_secret_private-value",
      GOOGLE_CLOUD_VISION_API_KEY: "vision-private-value",
      NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "google-verification-token",
      RESEND_API_KEY: "resend-private-value",
      RESEND_FROM_EMAIL: "mail@example.com",
      WHATSAPP_ACCESS_TOKEN: "whatsapp-private-value",
      WHATSAPP_PHONE_NUMBER_ID: "123456",
      WHATSAPP_GRAPH_API_VERSION: "v23.0",
      WHATSAPP_TEMPLATE_NAME: "virapeca_novo_orcamento",
      WHATSAPP_TEMPLATE_LANGUAGE: "pt_BR",
      NEXT_PUBLIC_SITE_URL: "https://virapeca.example",
      CRON_SECRET: "cron-private-value",
      MP_CLIENT_ID: "client-id",
      MP_CLIENT_SECRET: "client-secret",
      MP_TOKEN_ENCRYPTION_KEY: "a".repeat(64),
      MP_WEBHOOK_SECRET: "webhook-secret",
      MP_MARKETPLACE_FEE_PERCENT: "12.5",
      ME_CLIENT_ID: "me-client-id",
      ME_CLIENT_SECRET: "me-client-secret",
      ME_TOKEN_ENCRYPTION_KEY: "b".repeat(64),
    });

    expect(result.every((item) => item.status === "configured")).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/secret-value|private-value/);
  });

  it("recognizes the legacy Supabase key and validates payment settings", () => {
    const result = Object.fromEntries(getIntegrationHealth({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-secret",
      NEXT_PUBLIC_SITE_URL: "https://virapeca.example",
      MP_CLIENT_ID: "client-id",
      MP_CLIENT_SECRET: "client-secret",
      MP_TOKEN_ENCRYPTION_KEY: "a".repeat(64),
      MP_WEBHOOK_SECRET: "webhook-secret",
      MP_MARKETPLACE_FEE_PERCENT: "0",
      ME_CLIENT_ID: "me-client-id",
      ME_CLIENT_SECRET: "me-client-secret",
      ME_TOKEN_ENCRYPTION_KEY: "b".repeat(64),
    }).map((item) => [item.id, item]));

    expect(result.supabase.status).toBe("configured");
    expect(result.mercadoPago.status).toBe("configured");
  });

  it("marks incomplete channels and malformed critical values as missing", () => {
    const result = Object.fromEntries(getIntegrationHealth({
      NEXT_PUBLIC_SUPABASE_URL: "",
      RESEND_API_KEY: "present",
      WHATSAPP_ACCESS_TOKEN: "present",
      MP_CLIENT_ID: "present",
      MP_CLIENT_SECRET: "present",
      MP_TOKEN_ENCRYPTION_KEY: "not-64-hex",
      MP_WEBHOOK_SECRET: "present",
      MP_MARKETPLACE_FEE_PERCENT: "100",
    }).map((item) => [item.id, item]));

    expect(result.supabase.status).toBe("missing");
    expect(result.email.status).toBe("missing");
    expect(result.whatsapp.status).toBe("missing");
    expect(result.mercadoPago.status).toBe("missing");
    expect(result.googleVision.status).toBe("missing");
    expect(result.googleSearchConsole.status).toBe("missing");
    expect(result.googleSearchConsole.missingVariables).toContain("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION");
    expect(result.melhorEnvio.status).toBe("missing");
  });

  it("reports Google Search Console configured without returning its token", () => {
    const result = getIntegrationHealth({ NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "verification-token" })
      .find((item) => item.id === "googleSearchConsole");

    expect(result?.status).toBe("configured");
    expect(JSON.stringify(result)).not.toContain("verification-token");
    expect(result?.setupHref).toContain("google-search-console.md");
  });

  it("marks an invalid WhatsApp template language as missing", () => {
    const result = getIntegrationHealth({
      WHATSAPP_ACCESS_TOKEN: "token",
      WHATSAPP_PHONE_NUMBER_ID: "123456",
      WHATSAPP_GRAPH_API_VERSION: "v23.0",
      WHATSAPP_TEMPLATE_NAME: "virapeca_novo_orcamento",
      WHATSAPP_TEMPLATE_LANGUAGE: "pt_br",
    }).find((item) => item.id === "whatsapp");

    expect(result?.status).toBe("missing");
    expect(result?.missingVariables).toContain("WHATSAPP_TEMPLATE_LANGUAGE");
  });

  it("does not trim WhatsApp values that the delivery worker will reject", () => {
    const result = getIntegrationHealth({
      WHATSAPP_ACCESS_TOKEN: "token",
      WHATSAPP_PHONE_NUMBER_ID: " 123456 ",
      WHATSAPP_GRAPH_API_VERSION: " v23.0 ",
      WHATSAPP_TEMPLATE_NAME: " virapeca_novo_orcamento ",
    }).find((item) => item.id === "whatsapp");

    expect(result?.missingVariables).toEqual(expect.arrayContaining([
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_GRAPH_API_VERSION",
      "WHATSAPP_TEMPLATE_NAME",
    ]));
  });
});
