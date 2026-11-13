const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);

export function buildQuoteRequestEmail({ productName, quantity, panelUrl, requestType = "quote" }: { productName: string; quantity: number; panelUrl: string; requestType?: "quote" | "purchase" }) {
  const safeName = escapeHtml(productName);
  const kind = requestType === "purchase" ? "solicitação de compra" : "pedido de orçamento";
  const opening = requestType === "purchase" ? "Você recebeu uma nova solicitação de compra" : "Você recebeu um novo pedido de orçamento";
  const subject = `${requestType === "purchase" ? "Nova" : "Novo"} ${kind}: ${productName.replace(/[\r\n\x00-\x1f\x7f]/g, " ").slice(0, 180)}`;
  const text = `${opening} para ${productName}.\nQuantidade: ${quantity}.\nAcesse o painel: ${panelUrl}`;
  const html = `<p>${opening} para <strong>${safeName}</strong>.</p><p>Quantidade: ${quantity}.</p><p><a href="${escapeHtml(panelUrl)}">Abrir painel do fabricante</a></p>`;
  return { subject, text, html };
}

export function buildSupportReplyEmail({ ticketSubject, supportUrl }: { ticketSubject: string; supportUrl: string }) {
  const safeSubject = ticketSubject.replace(/[\r\n\x00-\x1f\x7f]/g, " ").slice(0, 120);
  const subject = `A equipe respondeu à sua solicitação: ${safeSubject}`;
  const text = `A equipe de atendimento respondeu à sua solicitação. Acesse o portal para ler a mensagem: ${supportUrl}`;
  const html = `<p>A equipe de atendimento respondeu à sua solicitação <strong>${escapeHtml(safeSubject)}</strong>.</p><p>Entre no portal para ler a mensagem.</p><p><a href="${escapeHtml(supportUrl)}">Abrir atendimento</a></p>`;
  return { subject, text, html };
}

export function buildDesignerServiceRequestEmail({ projectTitle, panelUrl }: { projectTitle: string; panelUrl: string }) {
  const safeTitle = projectTitle.replace(/[\r\n\x00-\x1f\x7f]/g, " ").slice(0, 120);
  const subject = `Você recebeu um novo pedido de modelagem: ${safeTitle}`;
  const text = `Um comprador enviou um briefing de modelagem chamado ${safeTitle}. Acesse o painel do designer para consultar os detalhes: ${panelUrl}`;
  const html = `<p>Um comprador enviou um novo briefing de modelagem chamado <strong>${escapeHtml(safeTitle)}</strong>.</p><p>Entre no painel do designer para consultar os detalhes privados do pedido.</p><p><a href="${escapeHtml(panelUrl)}">Abrir painel do designer</a></p>`;
  return { subject, text, html };
}

export function getNotificationPanelPath(notificationType: unknown) {
  return notificationType === "support_reply" ? "/suporte" : notificationType === "designer_service_request" ? "/painel/designer" : "/painel/maker";
}

export function buildWhatsAppQuoteRequestPayload({ recipient, productName, quantity, panelUrl, templateName, language, requestType = "quote" }: {
  recipient: string; productName: string; quantity: number; panelUrl: string; templateName: string; language: string; requestType?: "quote" | "purchase";
}) {
  return {
    messaging_product: "whatsapp",
    to: recipient.replace(/\D/g, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: [{ type: "body", parameters: [
        { type: "text", text: `${requestType === "purchase" ? "Compra" : "Orçamento"}: ${productName}` },
        { type: "text", text: String(quantity) },
        { type: "text", text: panelUrl },
      ] }],
    },
  };
}

export function buildWhatsAppDesignerServiceRequestPayload({ recipient, projectTitle, panelUrl, templateName, language }: {
  recipient: string; projectTitle: string; panelUrl: string; templateName: string; language: string;
}) {
  return {
    messaging_product: "whatsapp",
    to: recipient.replace(/\D/g, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: [{ type: "body", parameters: [
        { type: "text", text: projectTitle.replace(/[\r\n\x00-\x1f\x7f]/g, " ").slice(0, 120) },
        { type: "text", text: panelUrl },
      ] }],
    },
  };
}
