const labels: Record<string, string> = {
  request_sent: "Solicitação enviada à loja",
  proposal_sent: "Proposta enviada",
  proposal_accepted: "Proposta escolhida",
  proposal_declined: "Proposta recusada",
  proposal_closed: "Proposta encerrada",
  request_cancelled: "Solicitação cancelada",
  production_started: "Produção iniciada",
  production_completed: "Impressão concluída",
  delivery_address_selected: "Endereço de entrega enviado à loja vencedora",
  shipping_quote_offered: "Cotação de frete enviada",
  shipping_quote_accepted: "Cotação de frete aceita",
  shipping_quote_declined: "Cotação de frete recusada",
  shipment_shipped: "Impressão enviada ao comprador",
  shipment_delivered: "Comprador confirmou o recebimento",
};

export function getCustomPrintEventLabel(eventType: string): string {
  return labels[eventType] ?? "Atualização da solicitação";
}
