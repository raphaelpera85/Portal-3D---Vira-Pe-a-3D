import { DesignerServiceQuoteForm } from "@/components/designer-service-quote-form";

type DesignerServiceRequest = {
  id: string;
  title: string;
  brief: string;
  due_date: string | null;
  reference_url: string | null;
  created_at: string;
};

export function DesignerServiceRequestInbox({ requests, error }: { requests: DesignerServiceRequest[]; error: boolean }) {
  return <section className="account-card designer-service-inbox" aria-labelledby="designer-service-inbox-title">
    <span className="account-kicker">NOVOS PROJETOS</span>
    <h2 id="designer-service-inbox-title">Pedidos de modelagem</h2>
    <p>Briefings privados enviados pelo seu perfil público. Revise os requisitos antes de estimar o trabalho.</p>
    {error ? <p className="auth-notice is-error" role="alert">Pedidos indisponíveis. Confira se a migration de serviços de designers foi aplicada.</p>
      : requests.length ? <div className="designer-service-request-list">{requests.map((request) => <article className="designer-service-request-card" key={request.id}>
        <span className="account-kicker">Recebido em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(request.created_at))}</span>
        <h3>{request.title}</h3>
        <p className="designer-service-brief">{request.brief}</p>
        {request.due_date && <p>Prazo desejado: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${request.due_date}T00:00:00Z`))}</p>}
        {request.reference_url && <a href={request.reference_url} target="_blank" rel="noopener noreferrer">Abrir referência ↗</a>}
        <details><summary>Preparar proposta</summary>
          <p>O valor e o prazo são enviados ao comprador como proposta inicial; pagamento e contratação ainda não acontecem nesta etapa.</p>
          <DesignerServiceQuoteForm requestId={request.id} />
        </details>
      </article>)}</div> : <p className="designer-service-empty">Ainda não há pedidos de modelagem.</p>}
  </section>;
}
