import { DesignerServiceQuoteForm } from "@/components/designer-service-quote-form";
import { advanceDesignerServiceWork } from "@/app/painel/designer/actions";
import { DesignerServiceDeliveryForm } from "@/components/designer-service-delivery-form";

type DesignerServiceRequest = {
  id: string;
  title: string;
  brief: string;
  due_date: string | null;
  reference_url: string | null;
  created_at: string;
  status: "pending" | "quoted" | "accepted" | "paid" | "in_progress" | "completed";
  quote_amount_cents: number | null;
  quote_lead_days: number | null;
  quote_notes: string | null;
  work_started_at: string | null;
  work_completed_at: string | null;
  delivery: { notes: string; created_at: string; files: { id: string; file_name: string; file_size: number; downloadUrl: string | null }[] } | null;
};

export function DesignerServiceRequestInbox({ requests, error }: { requests: DesignerServiceRequest[]; error: boolean }) {
  return <section className="account-card designer-service-inbox" aria-labelledby="designer-service-inbox-title">
    <span className="account-kicker">NOVOS PROJETOS</span>
    <h2 id="designer-service-inbox-title">Pedidos de modelagem</h2>
    <p>Briefings privados enviados pelo seu perfil público. Revise os requisitos antes de estimar o trabalho.</p>
    {error ? <p className="auth-notice is-error" role="alert">Pedidos indisponíveis. Confira se a migration de serviços de designers foi aplicada.</p>
      : requests.length ? <div className="designer-service-request-list">{requests.map((request) => <article className="designer-service-request-card" key={request.id}>
        <span className="account-kicker">{request.status === "paid" ? "CONTRATAÇÃO PAGA" : request.status === "in_progress" ? "EM MODELAGEM" : request.status === "completed" ? "MODELAGEM CONCLUÍDA" : request.status === "accepted" ? "AGUARDANDO PAGAMENTO" : request.status === "quoted" ? "PROPOSTA ENVIADA" : `Recebido em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(request.created_at))}`}</span>
        <h3>{request.title}</h3>
        <p className="designer-service-brief">{request.brief}</p>
        {request.due_date && <p>Prazo desejado: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${request.due_date}T00:00:00Z`))}</p>}
        {request.reference_url && <a href={request.reference_url} target="_blank" rel="noopener noreferrer">Abrir referência ↗</a>}
        {request.status === "pending" ? <details><summary>Preparar proposta</summary>
          <p>O comprador poderá aceitar e pagar a proposta pelo checkout do Mercado Pago.</p>
          <DesignerServiceQuoteForm requestId={request.id} />
        </details> : <div className="designer-service-quote-result"><h4>{request.status === "paid" ? "Pagamento confirmado" : request.status === "in_progress" ? "Trabalho em andamento" : request.status === "completed" ? "Trabalho concluído" : "Proposta enviada"}</h4>
          <p><strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(request.quote_amount_cents ?? 0) / 100)}</strong> · {request.quote_lead_days} dias</p>
          {request.quote_notes && <p>{request.quote_notes}</p>}
          {request.status === "paid" && <><p>O pagamento foi confirmado. Registre o início para atualizar o status do comprador.</p><form action={advanceDesignerServiceWork}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="nextStatus" value="in_progress" /><button className="button button-primary" type="submit">Iniciar modelagem</button></form></>}
          {request.status === "in_progress" && <><p>Iniciado em {request.work_started_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(request.work_started_at)) : "—"}. Envie os arquivos finais para concluir e liberar o download ao comprador.</p><DesignerServiceDeliveryForm requestId={request.id} /></>}
          {request.status === "completed" && <><p>Entrega enviada em {request.work_completed_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(request.work_completed_at)) : "—"}.</p>{request.delivery?.notes && <p>{request.delivery.notes}</p>}
            {request.delivery?.files.map((file) => file.downloadUrl ? <p key={file.id}><a href={file.downloadUrl}>{file.file_name} · {(Number(file.file_size) / 1024 / 1024).toFixed(1)} MiB ↓</a></p> : <p key={file.id}>{file.file_name} · download indisponível</p>)}</>}
        </div>}
      </article>)}</div> : <p className="designer-service-empty">Ainda não há pedidos de modelagem.</p>}
  </section>;
}
