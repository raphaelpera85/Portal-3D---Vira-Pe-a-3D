import { describe, expect, it } from "vitest";
import { buildQuoteRequestEmail, buildSupportReplyEmail, buildWhatsAppQuoteRequestPayload } from "./notification-messages";

describe("quote request notifications", () => {
  it("escapes product names in email while linking to the maker panel", () => {
    const email = buildQuoteRequestEmail({ productName: "Peça <especial>", quantity: 2, panelUrl: "https://virapeca.example/painel/maker" });
    expect(email.subject).toContain("Peça <especial>");
    expect(email.html).toContain("Peça &lt;especial&gt;");
    expect(email.html).not.toContain("<especial>");
    expect(email.text).toContain("Quantidade: 2");
    expect(buildQuoteRequestEmail({ productName: "Peça\r\nBcc:attack@example.com", quantity: 1, panelUrl: "https://virapeca.example/painel/maker" }).subject).not.toContain("\n");
    const purchase = buildQuoteRequestEmail({ productName: "Suporte", quantity: 1, panelUrl: "https://virapeca.example/painel/maker", requestType: "purchase" });
    expect(purchase.subject).toContain("compra");
    expect(purchase.text).toContain("uma nova solicitação de compra");
  });

  it("builds a WhatsApp approved-template payload with the registered recipient", () => {
    expect(buildWhatsAppQuoteRequestPayload({
      recipient: "+5511000000000", productName: "Miniatura", quantity: 3,
      panelUrl: "https://virapeca.example/painel/maker", templateName: "virapeca_novo_orcamento", language: "pt_BR", requestType: "purchase",
    })).toEqual({
      messaging_product: "whatsapp", to: "5511000000000", type: "template",
      template: { name: "virapeca_novo_orcamento", language: { code: "pt_BR" }, components: [{ type: "body", parameters: [
        { type: "text", text: "Compra: Miniatura" }, { type: "text", text: "3" }, { type: "text", text: "https://virapeca.example/painel/maker" },
      ] }] },
    });
  });

  it("announces support replies without including private message text", () => {
    const email = buildSupportReplyEmail({ ticketSubject: "Conta <bloqueada>", supportUrl: "https://virapeca.example/suporte" });
    expect(email.subject).toContain("Conta <bloqueada>");
    expect(email.subject).not.toContain("\n");
    expect(email.html).toContain("Conta &lt;bloqueada&gt;");
    expect(email.html).toContain("https://virapeca.example/suporte");
    expect(email.text).not.toContain("<bloqueada>");
  });
});
