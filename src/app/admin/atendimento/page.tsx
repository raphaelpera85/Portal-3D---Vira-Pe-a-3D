import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SupportReplyForm } from "@/components/support-reply-form";
import { getUserWithRole } from "@/lib/auth-role.server";
import { prioritizeSupportTickets } from "@/lib/support-ticket-queue";
import { formatSupportElapsedDuration, formatSupportTicketAge } from "@/lib/support-ticket-age";
import { getPaginationRedirectPage } from "@/lib/pagination";
import { fetchAllSupportRows, mapSupportAttachmentSignedUrls } from "@/lib/support-messages";
import { setSupportTicketStatusAction } from "@/app/suporte/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = { title: "Atendimento | Administração ViraPeça 3D", robots: { index: false, follow: false } };

const statuses: Record<string, string> = { open: "Aberto", in_progress: "Em análise", waiting_user: "Aguardando usuário", resolved: "Resolvido", closed: "Encerrado" };
const categories: Record<string, string> = { account: "Conta", product: "Produto", order: "Pedido", payment: "Pagamento", delivery: "Entrega", technical: "Problema técnico", other: "Outro" };
const resultMessages: Record<string, string> = { atualizado: "Status atualizado.", "resposta-enviada": "Resposta enviada ao usuário.", erro: "Não foi possível atualizar o atendimento." };
type AdminSupportResponseMetric = { window_days: number; ticket_count: number; first_response_count: number; average_first_response_seconds: number | string | null };
const pageSize = 24;
const historyPageSize = 20;

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ resultado?: string; pagina?: string; historicoTicket?: string; historicoPagina?: string }> }) {
  const [{ resultado, pagina, historicoTicket, historicoPagina }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const requestedPage = typeof pagina === "string" && /^\d+$/.test(pagina) ? Number(pagina) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const ticketFields = "id, user_id, requester_role, category, subject, status, created_at, updated_at";
  const [actionableResult, otherResult, responseMetricsResult] = await Promise.all([
    actor.supabase.from("support_tickets").select(ticketFields, { count: "exact" }).in("status", ["open", "in_progress"]).order("updated_at", { ascending: true }).order("id", { ascending: true }).range((page - 1) * pageSize, page * pageSize - 1),
    actor.supabase.from("support_tickets").select(ticketFields, { count: "exact" }).in("status", ["waiting_user", "resolved", "closed"]).order("updated_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
    actor.supabase.rpc("get_admin_support_response_metrics"),
  ]);
  const responseMetricsByDays = new Map<number, AdminSupportResponseMetric>(
    ((responseMetricsResult.data ?? []) as AdminSupportResponseMetric[]).map((metric) => [metric.window_days, metric]),
  );
  const ticketsError = actionableResult.error ?? otherResult.error;
  const pages = Math.max(1, Math.ceil(Math.max(actionableResult.count ?? 0, otherResult.count ?? 0) / pageSize));
  const redirectPage = getPaginationRedirectPage(page, pages);
  if (!ticketsError && redirectPage !== null) redirect(`/admin/atendimento?pagina=${redirectPage}${resultado ? `&resultado=${encodeURIComponent(resultado)}` : ""}`);
  const tickets = prioritizeSupportTickets([...(actionableResult.data ?? []), ...(otherResult.data ?? [])]);
  const now = new Date();
  const ticketGroups = [
    { title: "Precisam de ação da equipe · mais antigos primeiro", tickets: tickets.filter(({ status }) => status === "open" || status === "in_progress") },
    { title: "Aguardando resposta do usuário", tickets: tickets.filter(({ status }) => status === "waiting_user") },
    { title: "Resolvidos e encerrados · recentes", tickets: tickets.filter(({ status }) => status === "resolved" || status === "closed") },
  ];
  const historyTicket = typeof historicoTicket === "string" && tickets.some(({ id }) => id === historicoTicket) ? historicoTicket : null;
  const requestedHistoryPage = typeof historicoPagina === "string" && /^\d+$/.test(historicoPagina) ? Number(historicoPagina) : 1;
  const historyPage = Number.isSafeInteger(requestedHistoryPage) && requestedHistoryPage > 0 ? Math.min(requestedHistoryPage, 10000) : 1;
  const historyHref = (ticketId: string, targetPage: number) => {
    const params = new URLSearchParams();
    if (page > 1) params.set("pagina", String(page));
    params.set("historicoTicket", ticketId);
    if (targetPage > 1) params.set("historicoPagina", String(targetPage));
    if (resultado) params.set("resultado", resultado);
    return `/admin/atendimento?${params.toString()}`;
  };
  const messageResults = await Promise.all(tickets.map(async (ticket) => {
    const ticketHistoryPage = ticket.id === historyTicket ? historyPage : 1;
    const result = await actor.supabase!.from("support_messages")
      .select("id, ticket_id, sender_role, body, created_at", { count: "exact" })
      .eq("ticket_id", ticket.id).order("created_at", { ascending: false }).order("id", { ascending: false })
      .range((ticketHistoryPage - 1) * historyPageSize, ticketHistoryPage * historyPageSize - 1);
    return { ticketId: ticket.id, page: ticketHistoryPage, data: result.data, count: result.count, error: result.error };
  }));
  const selectedHistory = messageResults.find(({ ticketId }) => ticketId === historyTicket);
  if (selectedHistory && !selectedHistory.error) {
    const correctionPage = getPaginationRedirectPage(selectedHistory.page, Math.max(1, Math.ceil((selectedHistory.count ?? 0) / historyPageSize)));
    if (correctionPage !== null) redirect(historyHref(selectedHistory.ticketId, correctionPage));
  }
  const messagesByTicket = new Map<string, Array<{ id: string; ticket_id: string; sender_role: string; body: string; created_at: string }>>();
  const historyByTicket = new Map<string, { page: number; pages: number; count: number; error: boolean }>();
  for (const result of messageResults) {
    const messages: Array<{ id: string; ticket_id: string; sender_role: string; body: string; created_at: string }> = [];
    for (let index = (result.data?.length ?? 0) - 1; index >= 0; index -= 1) messages.push(result.data![index]);
    messagesByTicket.set(result.ticketId, messages);
    historyByTicket.set(result.ticketId, {
      page: result.page,
      pages: Math.max(1, Math.ceil((result.count ?? 0) / historyPageSize)),
      count: result.count ?? 0,
      error: Boolean(result.error),
    });
  }
  const messageIds = messageResults.flatMap(({ data }) => (data ?? []).map(({ id }) => id));
  const attachmentRows = [];
  let attachmentError: unknown = null;
  for (let offset = 0; offset < messageIds.length; offset += 100) {
    const batch = await fetchAllSupportRows((from, to) => actor.supabase!.from("support_attachments")
      .select("id, message_id, file_name, size_bytes, storage_path")
      .in("message_id", messageIds.slice(offset, offset + 100)).order("id").range(from, to));
    if (batch.error) {
      attachmentError = batch.error;
      break;
    }
    attachmentRows.push(...(batch.data ?? []));
  }
  const attachmentResult = { data: attachmentError ? null : attachmentRows, error: attachmentError };
  const signedAttachments: Array<(typeof attachmentRows)[number] & { url: string | null }> = [];
  let attachmentSigningError = false;
  for (let offset = 0; offset < (attachmentResult.data?.length ?? 0); offset += 100) {
    const batch = attachmentResult.data!.slice(offset, offset + 100);
    const { data, error } = await actor.supabase.storage.from("support-attachments").createSignedUrls(batch.map(({ storage_path }) => storage_path), 3600);
    if (error) {
      attachmentSigningError = true;
      signedAttachments.push(...batch.map((attachment) => ({ ...attachment, url: null })));
      continue;
    }
    const mapped = mapSupportAttachmentSignedUrls(batch, data ?? []);
    attachmentSigningError ||= mapped.error;
    signedAttachments.push(...mapped.data);
  }
  const attachmentsByMessage = new Map<string, typeof signedAttachments>();
  for (const attachment of signedAttachments) {
    let attachments = attachmentsByMessage.get(attachment.message_id);
    if (!attachments) {
      attachments = [];
      attachmentsByMessage.set(attachment.message_id, attachments);
    }
    attachments.push(attachment);
  }
  return <><SiteHeader /><main id="main-content" tabIndex={-1} className="admin-dashboard shell">
    <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">OPERAÇÃO DA PLATAFORMA</p><h1>Atendimento</h1><p>Responda solicitações privadas e atualize o status de cada conversa.</p></div>
    {responseMetricsResult.error ? <p className="model-library-note" role="status">Métricas de resposta indisponíveis. A fila continua funcionando.</p> : <section className="seller-finance-summary support-response-summary" aria-label="Tempo médio da primeira resposta">
      {[7, 30].map((days) => { const metric = responseMetricsByDays.get(days); const average = metric?.average_first_response_seconds; return <article key={days}><span>Últimos {days} dias</span><strong>{average === null || average === undefined ? "Sem respostas" : formatSupportElapsedDuration(Number(average) * 1000)}</strong><small>{metric?.first_response_count ?? 0} de {metric?.ticket_count ?? 0} tickets receberam resposta da equipe</small></article>; })}
    </section>}
    <p className="model-library-note">A fila mostra 24 casos por página: os que precisam de ação aparecem do mais antigo ao mais recente.</p>
    {resultado && resultMessages[resultado] && <p className={`auth-notice ${resultado === "erro" ? "is-error" : "is-success"}`} role="status">{resultMessages[resultado]}</p>}
    {ticketsError ? <p className="auth-notice is-error" role="alert">Não foi possível carregar a fila. Confira se a migração de suporte foi aplicada.</p> : !tickets.length ? <p className="admin-empty">Nenhuma solicitação de atendimento.</p> : <section className="admin-review-section" aria-label="Solicitações de atendimento">
      {ticketGroups.filter(({ tickets: group }) => group.length > 0).map(({ title, tickets: group }) => <div className="support-ticket-group" key={title}>
      <div className="admin-section-title"><h2>{title}</h2></div>
      {group.map((ticket) => {
        const history = historyByTicket.get(ticket.id);
        const ticketMessages = messagesByTicket.get(ticket.id) ?? [];
        return <article className="account-card support-ticket-card" key={ticket.id}>
          <div className="support-ticket-heading"><div><span className="account-kicker">{statuses[ticket.status] ?? ticket.status} · {categories[ticket.category] ?? "Outro"} · {ticket.requester_role}</span><h2>{ticket.subject}</h2><p>Conta: {ticket.user_id.slice(0, 8)} · criada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(ticket.created_at))}</p><p className="support-ticket-age"><strong>{ticket.status === "open" ? "Aguardando equipe" : ticket.status === "in_progress" ? "Em análise há" : ticket.status === "waiting_user" ? "Aguardando usuário" : "Última atualização"}:</strong> <time dateTime={ticket.updated_at}>{formatSupportTicketAge(ticket.updated_at, now)} atrás</time></p></div>
            <form action={setSupportTicketStatusAction} className="support-status-form"><input type="hidden" name="ticketId" value={ticket.id} /><label>Status<select name="status" defaultValue={ticket.status}>{Object.entries(statuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button className="button button-secondary" type="submit">Atualizar</button></form>
          </div>
          {history?.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar as mensagens deste atendimento.</p> : <ol className="support-message-list">{ticketMessages.map((message) => <li className={`support-message${message.sender_role === "admin" ? " is-admin" : ""}`} key={message.id}><div><strong>{message.sender_role === "admin" ? "Atendimento ViraPeça" : `Usuário · ${message.sender_role}`}</strong><time dateTime={message.created_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.created_at))}</time></div><p>{message.body}</p>{(attachmentsByMessage.get(message.id) ?? []).map((attachment) => attachment.url && <a className="support-attachment-link" href={attachment.url} key={attachment.id}>{attachment.file_name} · {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(attachment.size_bytes / 1024)} KB · baixar</a>)}</li>)}</ol>}
          {history && !history.error && history.pages > 1 && <nav className="catalog-pagination" aria-label={`Paginação das mensagens de ${ticket.subject}`}>{history.page > 1 ? <Link className="button button-secondary" href={historyHref(ticket.id, history.page - 1)}>← Mensagens mais recentes</Link> : <span />}<span>Página {history.page} de {history.pages} · {history.count} mensagens</span>{history.page < history.pages ? <Link className="button button-secondary" href={historyHref(ticket.id, history.page + 1)}>Mensagens anteriores →</Link> : <span />}</nav>}
          {ticket.status === "closed" ? <p className="model-library-note">Solicitação encerrada. Altere o status para reabrir o atendimento.</p> : <SupportReplyForm ticketId={ticket.id} admin />}
        </article>;
      })}</div>)}
      {(Boolean(attachmentResult.error) || attachmentSigningError) && <p className="auth-notice is-error" role="alert">Não foi possível carregar anexos de algumas mensagens.</p>}
      {pages > 1 && <nav className="catalog-pagination" aria-label="Paginação da fila de atendimento">{page > 1 ? <Link className="button button-secondary" href={`/admin/atendimento?pagina=${page - 1}${resultado ? `&resultado=${encodeURIComponent(resultado)}` : ""}`}>← Página anterior</Link> : <span />}<span>Página {page} de {pages}</span>{page < pages ? <Link className="button button-secondary" href={`/admin/atendimento?pagina=${page + 1}${resultado ? `&resultado=${encodeURIComponent(resultado)}` : ""}`}>Próxima página →</Link> : <span />}</nav>}
    </section>}
  </main></>;
}
