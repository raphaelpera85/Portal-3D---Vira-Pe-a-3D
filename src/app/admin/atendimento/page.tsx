import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SupportReplyForm } from "@/components/support-reply-form";
import { getUserWithRole } from "@/lib/auth-role.server";
import { prioritizeSupportTickets } from "@/lib/support-ticket-queue";
import { setSupportTicketStatusAction } from "@/app/suporte/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Atendimento | Administração ViraPeça 3D", robots: { index: false, follow: false } };

const statuses: Record<string, string> = { open: "Aberto", in_progress: "Em análise", waiting_user: "Aguardando usuário", resolved: "Resolvido", closed: "Encerrado" };
const categories: Record<string, string> = { account: "Conta", product: "Produto", order: "Pedido", payment: "Pagamento", delivery: "Entrega", technical: "Problema técnico", other: "Outro" };
const resultMessages: Record<string, string> = { atualizado: "Status atualizado.", "resposta-enviada": "Resposta enviada ao usuário.", erro: "Não foi possível atualizar o atendimento." };

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const ticketFields = "id, user_id, requester_role, category, subject, status, created_at, updated_at";
  const [actionableResult, otherResult] = await Promise.all([
    actor.supabase.from("support_tickets").select(ticketFields).in("status", ["open", "in_progress"]).order("updated_at", { ascending: true }).limit(100),
    actor.supabase.from("support_tickets").select(ticketFields).in("status", ["waiting_user", "resolved", "closed"]).order("updated_at", { ascending: false }).limit(100),
  ]);
  const ticketsError = actionableResult.error ?? otherResult.error;
  const tickets = prioritizeSupportTickets([...(actionableResult.data ?? []), ...(otherResult.data ?? [])]);
  const ticketGroups = [
    { title: "Precisam de ação da equipe · mais antigos primeiro", tickets: tickets.filter(({ status }) => status === "open" || status === "in_progress") },
    { title: "Aguardando resposta do usuário", tickets: tickets.filter(({ status }) => status === "waiting_user") },
    { title: "Resolvidos e encerrados · recentes", tickets: tickets.filter(({ status }) => status === "resolved" || status === "closed") },
  ];
  const messagesResult = tickets.length
    ? await actor.supabase.from("support_messages").select("id, ticket_id, sender_role, body, created_at").in("ticket_id", tickets.map(({ id }) => id)).order("created_at").limit(2000)
    : { data: [], error: null };
  const attachmentResult = messagesResult.data?.length
    ? await actor.supabase.from("support_attachments").select("id, message_id, file_name, size_bytes, storage_path").in("message_id", messagesResult.data.map(({ id }) => id))
    : { data: [], error: null };
  const signedAttachments = await Promise.all((attachmentResult.data ?? []).map(async (attachment) => {
    const { data } = await actor.supabase!.storage.from("support-attachments").createSignedUrl(attachment.storage_path, 3600, { download: attachment.file_name });
    return { ...attachment, url: data?.signedUrl ?? null };
  }));
  const attachmentsByMessage = new Map<string, typeof signedAttachments>();
  for (const attachment of signedAttachments) attachmentsByMessage.set(attachment.message_id, [...(attachmentsByMessage.get(attachment.message_id) ?? []), attachment]);
  const messagesByTicket = new Map<string, NonNullable<typeof messagesResult.data>>();
  for (const message of messagesResult.data ?? []) messagesByTicket.set(message.ticket_id, [...(messagesByTicket.get(message.ticket_id) ?? []), message]);

  return <><SiteHeader /><main className="admin-dashboard shell">
    <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">OPERAÇÃO DA PLATAFORMA</p><h1>Atendimento</h1><p>Responda solicitações privadas e atualize o status de cada conversa.</p></div>
    <p className="model-library-note">A fila mostra até 100 casos em aberto ou em análise, do mais antigo ao mais recente, seguidos pelos 100 casos mais recentes nos demais estados.</p>
    {resultado && resultMessages[resultado] && <p className={`auth-notice ${resultado === "erro" ? "is-error" : "is-success"}`} role="status">{resultMessages[resultado]}</p>}
    {ticketsError ? <p className="auth-notice is-error" role="alert">Não foi possível carregar a fila. Confira se a migração de suporte foi aplicada.</p> : !tickets.length ? <p className="admin-empty">Nenhuma solicitação de atendimento.</p> : <section className="admin-review-section" aria-label="Solicitações de atendimento">
      {ticketGroups.filter(({ tickets: group }) => group.length > 0).map(({ title, tickets: group }) => <div className="support-ticket-group" key={title}>
      <div className="admin-section-title"><h2>{title}</h2></div>
      {group.map((ticket) => <article className="account-card support-ticket-card" key={ticket.id}>
        <div className="support-ticket-heading"><div><span className="account-kicker">{statuses[ticket.status] ?? ticket.status} · {categories[ticket.category] ?? "Outro"} · {ticket.requester_role}</span><h2>{ticket.subject}</h2><p>Conta: {ticket.user_id.slice(0, 8)} · criada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(ticket.created_at))}</p></div>
          <form action={setSupportTicketStatusAction} className="support-status-form"><input type="hidden" name="ticketId" value={ticket.id} /><label>Status<select name="status" defaultValue={ticket.status}>{Object.entries(statuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button className="button button-secondary" type="submit">Atualizar</button></form>
        </div>
        {messagesResult.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar as mensagens.</p> : <ol className="support-message-list">{(messagesByTicket.get(ticket.id) ?? []).map((message) => <li className={`support-message${message.sender_role === "admin" ? " is-admin" : ""}`} key={message.id}><div><strong>{message.sender_role === "admin" ? "Atendimento ViraPeça" : `Usuário · ${message.sender_role}`}</strong><time dateTime={message.created_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.created_at))}</time></div><p>{message.body}</p>{(attachmentsByMessage.get(message.id) ?? []).map((attachment) => attachment.url && <a className="support-attachment-link" href={attachment.url} key={attachment.id}>{attachment.file_name} · {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(attachment.size_bytes / 1024)} KB · baixar</a>)}</li>)}</ol>}
        {ticket.status === "closed" ? <p className="model-library-note">Solicitação encerrada. Altere o status para reabrir o atendimento.</p> : <SupportReplyForm ticketId={ticket.id} admin />}
      </article>)}</div>)}
    </section>}
  </main></>;
}
