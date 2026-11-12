import { describe, expect, it } from "vitest";
import { getCustomPrintEventLabel } from "./custom-print-events";

describe("custom print event labels", () => {
  it("uses clear labels for request, proposal, and production events", () => {
    expect(getCustomPrintEventLabel("request_sent")).toBe("Solicitação enviada à loja");
    expect(getCustomPrintEventLabel("proposal_accepted")).toBe("Proposta escolhida");
    expect(getCustomPrintEventLabel("production_completed")).toBe("Impressão concluída");
  });

  it("does not render arbitrary event types as interface text", () => {
    expect(getCustomPrintEventLabel("<script>alert(1)</script>")).toBe("Atualização da solicitação");
  });
});
