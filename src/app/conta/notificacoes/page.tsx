import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { getPaginationRedirectPage } from "@/lib/pagination";
import { markUserNotificationRead } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notificações | ViraPeça 3D", robots: { index: false, follow: false } };
const pageSize = 24;

export default async function UserNotificationsPage({ searchParams }: { searchParams: Promise<{ resultado?: string; pagina?: string }> }) {
  const [{ resultado, pagina }, actor] = await Promise.all([searchParams, getUserWithRole("buyer")]);
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const requestedPage = typeof pagina === "string" && /^\d+$/.test(pagina) ? Number(pagina) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const [{ data: notifications, count, error }, unreadResult] = await Promise.all([
    actor.supabase.from("user_notifications").select("id, title, body, read_at, created_at", { count: "exact" })
      .eq("user_id", actor.user.id).order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
    actor.supabase.from("user_notifications").select("id", { count: "exact", head: true }).eq("user_id", actor.user.id).is("read_at", null),
  ]);
  const pages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const redirectPage = getPaginationRedirectPage(page, pages);
  if (!error && redirectPage !== null) redirect(`/conta/notificacoes?pagina=${redirectPage}${resultado ? `&resultado=${encodeURIComponent(resultado)}` : ""}`);
  const unreadCount = unreadResult.count ?? 0;
  const paginationHref = (targetPage: number) => `/conta/notificacoes?pagina=${targetPage}${resultado ? `&resultado=${encodeURIComponent(resultado)}` : ""}`;

  return <><SiteHeader /><main id="main-content" tabIndex={-1} className="account-page shell">
    <Link className="viewer-back-link" href="/conta">← Voltar à conta</Link>
    <div className="account-heading"><p className="eyebrow">SUA CONTA</p><h1>Notificações.</h1><p>Acompanhe propostas, pagamentos e o andamento dos seus serviços de modelagem.</p></div>
    {resultado === "erro" && <p className="auth-notice is-error" role="alert">Não foi possível atualizar a notificação. Atualize a página e tente novamente.</p>}
    {error ? <section className="account-card"><h2>Notificações indisponíveis</h2><p>A migration de notificações da conta ainda precisa ser aplicada ao Supabase.</p></section>
      : notifications?.length ? <section className="designer-service-request-list" aria-label="Notificações recentes">
        <p className="quote-small-note">{unreadResult.error ? "Não foi possível contar as notificações não lidas." : unreadCount ? `${unreadCount} não lida(s)` : "Todas as notificações foram lidas."}</p>
        {notifications.map((notification) => <article className="account-card designer-service-request-card" key={notification.id}>
          <span className="account-kicker">{notification.read_at ? "LIDA" : "NOVA"} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(notification.created_at))}</span>
          <h2>{notification.title}</h2><p>{notification.body}</p>
          <div className="account-links"><Link className="button button-primary" href="/conta/modelagem">Acompanhar pedido de modelagem</Link>
            {!notification.read_at && <form action={markUserNotificationRead}><input type="hidden" name="notificationId" value={notification.id} /><button className="button button-secondary" type="submit">Marcar como lida</button></form>}
          </div>
        </article>)}
        {pages > 1 && <nav className="catalog-pagination" aria-label="Paginação das notificações">{page > 1 ? <Link className="button button-secondary" href={paginationHref(page - 1)}>← Página anterior</Link> : <span />}<span>Página {page} de {pages} · {count} notificações</span>{page < pages ? <Link className="button button-secondary" href={paginationHref(page + 1)}>Próxima página →</Link> : <span />}</nav>}
      </section> : <section className="account-card"><h2>Nenhuma notificação ainda</h2><p>Quando o designer responder ou atualizar um pedido de modelagem, o aviso aparecerá aqui.</p><Link className="button button-secondary" href="/conta/modelagem">Ver pedidos de modelagem</Link></section>}
  </main></>;
}
