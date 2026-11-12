import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { createSupportTicketAction, replySupportTicketAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Atendimento | ViraPeça 3D", robots: { index: false, follow: false } };

const categories = [
  ["account", "Conta"], ["product", "Produto"], ["order", "Pedido"], ["payment", "Pagamento"],
  ["delivery", "Entrega"], ["technical", "Problema técnico"], ["other", "Outro assunto"],
];
const statuses: Record<string, string> = { open: "Aberto", in_progress: "Em análise", waiting_user: "Aguardando você", resolved: "Resolvido", closed: "Encerrado" };
const notices: Record<string, string> = { criado: "Solicitação enviada à equipe de atendimento.", "resposta-enviada": "Sua mensagem foi enviada.", erro: "Não foi possível enviar. Confira os campos e tente novamente." };

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("buyer")]);
  if (!actor.supabase || !actor.user) redirect("/conta");
  const rolesResult = await actor.supabase.from("user_roles").select("role").eq("user_id", actor.user.id);
  const hasPortalRole = rolesResult.data?.some(({ role }) => ["buyer", "maker", "designer", "admin"].includes(role)) ?? false;
  if (!hasPortalRole) redirect("/conta");

  const ticketsResult = await actor.supabase.from("support_tickets").select("id, requester_role, category, subject, status, created_at, updated_at", { count: "exact" }).eq("user_id", actor.user.id).order("updated_at", { ascending: false }).limit(50);
  const tickets = ticketsResult.data ?? [];
  const messagesResult = tickets.length
    ? await actor.supabase.from("support_messages").select("id, ticket_id, sender_id, sender_role, body, created_at").in("ticket_id", tickets.map(({ id }) => id)).order("created_at").limit(1000)
    : { data: [], error: null };
  const messagesByTicket = new Map<string, NonNullable<typeof messagesResult.data>>();
  for (const message of messagesResult.data ?? []) messagesByTicket.set(message.ticket_id, [...(messagesByTicket.get(message.ticket_id) ?? []), message]);

  return <><SiteHeader /><main className="account-page shell">
    <Link className="viewer-back-link" href="/conta">← Voltar à conta</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">VIRAPEÇA 3D · AJUDA</p><h1>Central de atendimento</h1><p>Abra uma solicitação e acompanhe as respostas da equipe por aqui.</p></div>
    {resultado && notices[resultado] && <p className={`auth-notice ${resultado === "erro" ? "is-error" : "is-success"}`} role="status">{notices[resultado]}</p>}
    <section className="account-card admin-banner-create"><div className="admin-section-title"><span className="account-kicker">NOVA SOLICITAÇÃO</span><h2>Como podemos ajudar?</h2></div>
      <form action={createSupportTicketAction} className="auth-form">
        <label>Assunto<select name="category" defaultValue="other">{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Título<input name="subject" minLength={3} maxLength={120} required /></label>
        <label>Mensagem<textarea name="message" minLength={1} maxLength={5000} rows={5} required /></label>
        <button className="button button-primary" type="submit">Enviar solicitação</button>
      </form>
    </section>
    <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">HISTÓRICO</span><h2>Suas solicitações</h2></div>
      {ticketsResult.error ? <p className="auth-notice is-error" role="alert">O atendimento ainda não está disponível. Confira se a migração de suporte foi aplicada.</p> : !tickets.length ? <p className="admin-empty">Você ainda não abriu solicitações.</p> : <>{tickets.map((ticket) => <article className="account-card support-ticket-card" key={ticket.id}>
        <div className="support-ticket-heading"><div><span className="account-kicker">{statuses[ticket.status] ?? ticket.status} · {categories.find(([value]) => value === ticket.category)?.[1] ?? "Outro assunto"}</span><h2>{ticket.subject}</h2><p>Atualizado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ticket.updated_at))}</p></div></div>
        {messagesResult.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar as mensagens.</p> : <ol className="support-message-list">{(messagesByTicket.get(ticket.id) ?? []).map((message) => <li className={`support-message${message.sender_role === "admin" ? " is-admin" : ""}`} key={message.id}><div><strong>{message.sender_role === "admin" ? "Atendimento ViraPeça" : "Você"}</strong><time dateTime={message.created_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.created_at))}</time></div><p>{message.body}</p></li>)}</ol>}
        {ticket.status === "closed" ? <p className="model-library-note">Solicitação encerrada. Se precisar de ajuda novamente, abra uma nova solicitação.</p> : <form action={replySupportTicketAction} className="auth-form support-reply-form"><input type="hidden" name="ticketId" value={ticket.id} /><label>Responder<textarea name="message" maxLength={5000} rows={3} required /></label><button className="button button-secondary" type="submit">Enviar resposta</button></form>}
      </article>)}{(ticketsResult.count ?? 0) > 50 && <p className="model-library-note">Mostrando as 50 solicitações mais recentes.</p>}</>}
    </section>
  </main></>;
}
