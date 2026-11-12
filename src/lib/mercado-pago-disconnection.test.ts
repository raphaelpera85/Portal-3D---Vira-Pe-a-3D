import { describe, expect, it } from "vitest";
import { getMercadoPagoDisconnectionResult } from "./mercado-pago-disconnection";

describe("Mercado Pago disconnection result", () => {
  it("maps server results to safe dashboard messages", () => {
    expect(getMercadoPagoDisconnectionResult("disconnected")).toBe("mercado-pago-desconectado");
    expect(getMercadoPagoDisconnectionResult("not_connected")).toBe("mercado-pago-ja-desconectado");
    expect(getMercadoPagoDisconnectionResult("pending_payments")).toBe("mercado-pago-pagamentos-pendentes");
    expect(getMercadoPagoDisconnectionResult("pending_refunds")).toBe("mercado-pago-reembolsos-pendentes");
    expect(getMercadoPagoDisconnectionResult("unexpected")).toBeNull();
  });
});
