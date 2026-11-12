const labels: Record<string, string> = {
  request_sent: "Solicitação enviada à loja",
  proposal_sent: "Proposta enviada",
  proposal_accepted: "Proposta escolhida",
  proposal_declined: "Proposta recusada",
  proposal_closed: "Proposta encerrada",
  request_cancelled: "Solicitação cancelada",
  production_started: "Produção iniciada",
  production_completed: "Impressão concluída",
};

export function getCustomPrintEventLabel(eventType: string): string {
  return labels[eventType] ?? "Atualização da solicitação";
}
