const statusLabels: Record<string, string> = {
  approved: "Aprovado",
  archived: "Arquivado",
  closed: "Encerrado",
  community: "Comunitário",
  official: "Oficial",
  confirmed: "Confirmado",
  dismissed: "Descartado",
  draft: "Rascunho",
  in_progress: "Em análise",
  open: "Aberto",
  pending: "Pendente",
  published: "Publicado",
  rejected: "Recusado",
  resolved: "Resolvido",
  waiting_user: "Aguardando usuário",
};

const entityLabels: Record<string, string> = {
  catalog_update_history: "Atualização de catálogo",
  designer_profiles: "Perfil de designer",
  digital_asset_reports: "Denúncia de arquivo digital",
  maker_applications: "Solicitação de fabricante",
  maker_print_profiles: "Perfil de impressão",
  model_print_profiles: "Perfil de impressão de modelo",
  marketplace_products: "Anúncio de produto",
  marketplace_reviews: "Avaliação de produto",
  printer_model_suggestions: "Sugestão de impressora",
  stores: "Loja",
  support_tickets: "Atendimento",
};

export function formatAdminAuditValue(value: string) {
  return statusLabels[value] ?? value;
}

export function getAdminAuditEntityLabel(entityType: string) {
  return entityLabels[entityType] ?? "Registro";
}
