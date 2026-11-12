export function getMercadoPagoDisconnectionResult(value: unknown): string | null {
  switch (value) {
    case "disconnected": return "mercado-pago-desconectado";
    case "not_connected": return "mercado-pago-ja-desconectado";
    case "pending_payments": return "mercado-pago-pagamentos-pendentes";
    case "pending_refunds": return "mercado-pago-reembolsos-pendentes";
    default: return null;
  }
}
