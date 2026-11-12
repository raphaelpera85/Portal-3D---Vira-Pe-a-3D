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
