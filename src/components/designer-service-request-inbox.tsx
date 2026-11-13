import { DesignerServiceQuoteForm } from "@/components/designer-service-quote-form";

type DesignerServiceRequest = {
  id: string;
  title: string;
  brief: string;
  due_date: string | null;
  reference_url: string | null;
  created_at: string;
  status: "pending" | "quoted" | "accepted" | "paid";
  quote_amount_cents: number | null;
  quote_lead_days: number | null;
  quote_notes: string | null;
};

export function DesignerServiceRequestInbox({ requests, error }: { requests: DesignerServiceRequest[]; error: boolean }) {
  return <section className="account-card designer-service-inbox" aria-labelledby="designer-service-inbox-title">
    <span className="account-kicker">NOVOS PROJETOS</span>
    <h2 id="designer-service-inbox-title">Pedidos de modelagem</h2>
    <p>Briefings privados enviados pelo seu perfil público. Revise os requisitos antes de estimar o trabalho.</p>
    {error ? <p className="auth-notice is-error" role="alert">Pedidos indisponíveis. Confira se a migration de serviços de designers foi aplicada.</p>
      : requests.length ? <div className="designer-service-request-list">{requests.map((request) => <article className="designer-service-request-card" key={request.id}>
        <span className="account-kicker">{request.status === "paid" ? "CONTRATAÇÃO PAGA" : request.status === "accepted" ? "AGUARDANDO PAGAMENTO" : request.status === "quoted" ? "PROPOSTA ENVIADA" : `Recebido em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(request.created_at))}`}</span>
        <h3>{request.title}</h3>
        <p className="designer-service-brief">{request.brief}</p>
        {request.due_date && <p>Prazo desejado: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${request.due_date}T00:00:00Z`))}</p>}
        {request.reference_url && <a href={request.reference_url} target="_blank" rel="noopener noreferrer">Abrir referência ↗</a>}
        {request.status === "pending" ? <details><summary>Preparar proposta</summary>
          <p>O comprador poderá aceitar e pagar a proposta pelo checkout do Mercado Pago.</p>
          <DesignerServiceQuoteForm requestId={request.id} />
        </details> : <div className="designer-service-quote-result"><h4>{request.status === "paid" ? "Pagamento confirmado" : "Proposta enviada"}</h4>
          <p><strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(request.quote_amount_cents ?? 0) / 100)}</strong> · {request.quote_lead_days} dias</p>
          {request.quote_notes && <p>{request.quote_notes}</p>}
          {request.status === "paid" && <p>O comprador concluiu o pagamento. Você já pode iniciar o serviço.</p>}
        </div>}
      </article>)}</div> : <p className="designer-service-empty">Ainda não há pedidos de modelagem.</p>}
  </section>;
}
