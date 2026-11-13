import { describe, expect, it, vi } from "vitest";
import { isNotificationChannelConfigured, sendNotificationDelivery } from "./notification-delivery";

const delivery = (channel: "email" | "whatsapp", requestType: "quote" | "purchase" = "quote") => ({ id: "delivery-1", channel, destination: channel === "email" ? "vendedor@example.com" : "+5511000000000", payload: { request_type: requestType, product_name: "Suporte", quantity: 2 }, attempts: 1 });

describe("notification delivery", () => {
  it("keeps unconfigured providers queued", () => {
    expect(isNotificationChannelConfigured("email", {})).toBe(false);
    expect(isNotificationChannelConfigured("whatsapp", { WHATSAPP_ACCESS_TOKEN: "token" })).toBe(false);
  });

  it("does not treat whitespace-only credentials as configured", () => {
    expect(isNotificationChannelConfigured("email", { RESEND_API_KEY: "  ", RESEND_FROM_EMAIL: "pedidos@example.com" })).toBe(false);
    expect(isNotificationChannelConfigured("whatsapp", {
      WHATSAPP_ACCESS_TOKEN: " ", WHATSAPP_PHONE_NUMBER_ID: "12345", WHATSAPP_GRAPH_API_VERSION: "v23.0", WHATSAPP_TEMPLATE_NAME: "virapeca_novo_orcamento",
    })).toBe(false);
  });

  it("sends an idempotent email through Resend", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));
    const result = await sendNotificationDelivery(delivery("email"), "https://virapeca.example/painel/maker", { RESEND_API_KEY: "secret", RESEND_FROM_EMAIL: "pedidos@virapeca.example" }, fetcher);
    expect(result).toEqual({ ok: true, messageId: "email-1" });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("virapeca/quote/delivery-1");
    expect(JSON.parse(String(init?.body)).to).toEqual(["vendedor@example.com"]);
  });

  it("identifies a purchase request in the seller email", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: "email-2" }), { status: 200 }));
    await sendNotificationDelivery(delivery("email", "purchase"), "https://virapeca.example/painel/maker", { RESEND_API_KEY: "secret", RESEND_FROM_EMAIL: "pedidos@virapeca.example" }, fetcher);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).subject).toContain("solicitação de compra");
  });

  it("sends a support reply notice with a separate idempotency key", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: "email-support-1" }), { status: 200 }));
    const supportDelivery = { ...delivery("email"), payload: { notification_type: "support_reply", ticket_subject: "Conta" } };
    await sendNotificationDelivery(supportDelivery, "https://virapeca.example/suporte", { RESEND_API_KEY: "secret", RESEND_FROM_EMAIL: "ajuda@virapeca.example" }, fetcher);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("virapeca/support/delivery-1");
    const body = JSON.parse(String(init?.body));
    expect(body.subject).toContain("respondeu à sua solicitação");
    expect(body.html).toContain("https://virapeca.example/suporte");
    expect(body.text).not.toContain("Suporte");
  });

  it("sends designer service request email without exposing the private brief", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: "email-designer-1" }), { status: 200 }));
    const serviceDelivery = { ...delivery("email"), payload: { notification_type: "designer_service_request", project_title: "Suporte especial", brief: "Brief privado" } };
    const result = await sendNotificationDelivery(serviceDelivery, "https://virapeca.example/painel/designer", { RESEND_API_KEY: "secret", RESEND_FROM_EMAIL: "pedidos@virapeca.example" }, fetcher);
    expect(result).toEqual({ ok: true, messageId: "email-designer-1" });
    const init = fetcher.mock.calls[0][1];
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("virapeca/designer/delivery-1");
    const body = JSON.parse(String(init?.body));
    expect(body.subject).toContain("modelagem");
    expect(body.html).toContain("/painel/designer");
    expect(JSON.stringify(body)).not.toContain("Brief privado");
  });

  it("sends only an approved WhatsApp template to the registered number", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid-1" }] }), { status: 200 }));
    const env = { WHATSAPP_ACCESS_TOKEN: "secret", WHATSAPP_PHONE_NUMBER_ID: "12345", WHATSAPP_GRAPH_API_VERSION: "v23.0", WHATSAPP_TEMPLATE_NAME: "virapeca_novo_orcamento", WHATSAPP_TEMPLATE_LANGUAGE: "pt_BR" };
    const result = await sendNotificationDelivery(delivery("whatsapp"), "https://virapeca.example/painel/maker", env, fetcher);
    expect(result).toEqual({ ok: true, messageId: "wamid-1" });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v23.0/12345/messages");
    expect(JSON.parse(String(init?.body))).toMatchObject({ to: "5511000000000", type: "template", template: { name: "virapeca_novo_orcamento" } });
  });

  it("requires the designer-specific approved template for modeling request WhatsApp", () => {
    const env = { WHATSAPP_ACCESS_TOKEN: "token", WHATSAPP_PHONE_NUMBER_ID: "12345", WHATSAPP_GRAPH_API_VERSION: "v23.0", WHATSAPP_TEMPLATE_NAME: "virapeca_novo_orcamento" };
    expect(isNotificationChannelConfigured("whatsapp", env, "designer_service_request")).toBe(false);
    expect(isNotificationChannelConfigured("whatsapp", { ...env, WHATSAPP_DESIGNER_TEMPLATE_NAME: "virapeca_nova_modelagem" }, "designer_service_request")).toBe(true);
  });

  it("sends designer service requests only through their separate WhatsApp template", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid-designer-1" }] }), { status: 200 }));
    const serviceDelivery = { ...delivery("whatsapp"), payload: { notification_type: "designer_service_request", project_title: "Suporte", brief: "Não deve ser enviado" } };
    const env = { WHATSAPP_ACCESS_TOKEN: "secret", WHATSAPP_PHONE_NUMBER_ID: "12345", WHATSAPP_GRAPH_API_VERSION: "v23.0", WHATSAPP_DESIGNER_TEMPLATE_NAME: "virapeca_nova_modelagem", WHATSAPP_TEMPLATE_LANGUAGE: "pt_BR" };
    const result = await sendNotificationDelivery(serviceDelivery, "https://virapeca.example/painel/designer", env, fetcher);
    expect(result).toEqual({ ok: true, messageId: "wamid-designer-1" });
    const message = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(message.template.name).toBe("virapeca_nova_modelagem");
    expect(JSON.stringify(message)).not.toContain("Não deve ser enviado");
  });

  it("identifies a purchase request in the WhatsApp template variable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid-2" }] }), { status: 200 }));
    const env = { WHATSAPP_ACCESS_TOKEN: "secret", WHATSAPP_PHONE_NUMBER_ID: "12345", WHATSAPP_GRAPH_API_VERSION: "v23.0", WHATSAPP_TEMPLATE_NAME: "virapeca_novo_orcamento", WHATSAPP_TEMPLATE_LANGUAGE: "pt_BR" };
    await sendNotificationDelivery(delivery("whatsapp", "purchase"), "https://virapeca.example/painel/maker", env, fetcher);
    const message = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(message.template.components[0].parameters[0].text).toBe("Compra: Suporte");
  });

  it("returns a safe provider status on a rejected delivery", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("provider detail contains private data", { status: 429 }));
    const result = await sendNotificationDelivery(delivery("email"), "https://virapeca.example/painel/maker", { RESEND_API_KEY: "secret", RESEND_FROM_EMAIL: "pedidos@virapeca.example" }, fetcher);
    expect(result).toEqual({ ok: false, reason: "email_http_429" });
    expect(JSON.stringify(result)).not.toContain("private data");
  });
});
