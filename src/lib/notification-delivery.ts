import { buildQuoteRequestEmail, buildSupportReplyEmail, buildWhatsAppQuoteRequestPayload } from "./notification-messages";

export type NotificationDelivery = { id: string; channel: "email" | "whatsapp"; destination: string; payload: Record<string, unknown>; attempts: number };
export type NotificationEnvironment = Record<string, string | undefined>;
export type NotificationSendResult = { ok: true; messageId: string | null } | { ok: false; reason: string };

const present = (value: string | undefined) => Boolean(value?.trim());

export function isNotificationChannelConfigured(channel: NotificationDelivery["channel"], env: NotificationEnvironment = process.env) {
  if (channel === "email") return present(env.RESEND_API_KEY) && present(env.RESEND_FROM_EMAIL);
  return Boolean(present(env.WHATSAPP_ACCESS_TOKEN) && env.WHATSAPP_PHONE_NUMBER_ID && /^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID) && /^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_API_VERSION ?? "") && /^[a-z0-9_]+$/.test(env.WHATSAPP_TEMPLATE_NAME ?? "") && /^[a-z]{2}_[A-Z]{2}$/.test(env.WHATSAPP_TEMPLATE_LANGUAGE ?? "pt_BR"));
}

export async function sendNotificationDelivery(delivery: NotificationDelivery, actionUrl: string, env: NotificationEnvironment = process.env, fetcher: typeof fetch = fetch): Promise<NotificationSendResult> {
  const isSupportReply = delivery.payload.notification_type === "support_reply";
  const productName = typeof delivery.payload.product_name === "string" ? delivery.payload.product_name : "Produto";
  const requestType = delivery.payload.request_type === "purchase" ? "purchase" : "quote";
  const rawQuantity = Number(delivery.payload.quantity);
  const quantity = Number.isInteger(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;
  try {
    if (delivery.channel === "email") {
      if (!isNotificationChannelConfigured("email", env)) return { ok: false, reason: "email_not_configured" };
      const content = isSupportReply
        ? buildSupportReplyEmail({ ticketSubject: typeof delivery.payload.ticket_subject === "string" ? delivery.payload.ticket_subject : "Atendimento", supportUrl: actionUrl })
        : buildQuoteRequestEmail({ productName, quantity, panelUrl: actionUrl, requestType });
      const response = await fetcher("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `virapeca/${isSupportReply ? "support" : "quote"}/${delivery.id}` },
        body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [delivery.destination], ...content }),
      });
      const data = await response.json().catch(() => ({})) as { id?: string };
      return response.ok ? { ok: true, messageId: data.id ?? null } : { ok: false, reason: `email_http_${response.status}` };
    }

    if (!isNotificationChannelConfigured("whatsapp", env)) return { ok: false, reason: "whatsapp_not_configured" };
    const body = buildWhatsAppQuoteRequestPayload({
      recipient: delivery.destination, productName, quantity, panelUrl: actionUrl,
      templateName: env.WHATSAPP_TEMPLATE_NAME!, language: env.WHATSAPP_TEMPLATE_LANGUAGE ?? "pt_BR", requestType,
    });
    const response = await fetcher(`https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({})) as { messages?: Array<{ id?: string }> };
    return response.ok ? { ok: true, messageId: data.messages?.[0]?.id ?? null } : { ok: false, reason: `whatsapp_http_${response.status}` };
  } catch {
    return { ok: false, reason: `${delivery.channel}_network_error` };
  }
}
