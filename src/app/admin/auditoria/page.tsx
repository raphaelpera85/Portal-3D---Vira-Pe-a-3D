import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { formatAdminAuditValue, getAdminAuditEntityLabel } from "@/lib/admin-audit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Auditoria | Administração ViraPeça 3D", robots: { index: false, follow: false } };

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const [{ pagina }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const requestedPage = typeof pagina === "string" && /^[1-9]\d{0,3}$/.test(pagina) ? Number(pagina) : 1;
  const pageSize = 200;
  const { data: events, error, count } = await actor.supabase.from("admin_audit_events")
    .select("id, actor_user_id, entity_type, entity_id, field_name, previous_value, new_value, created_at", { count: "exact" })
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range((requestedPage - 1) * pageSize, requestedPage * pageSize - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  if (!error && requestedPage > pages) redirect(`/admin/auditoria?pagina=${pages}`);

  return <><SiteHeader /><main className="admin-dashboard shell">
    <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">CONTROLE DA PLATAFORMA</p><h1>Auditoria</h1><p>Histórico de mudanças de status feitas pela equipe administrativa.</p></div>
    <p className="model-library-note">O registro guarda somente entidade, identificador, status anterior e novo status.</p>
    {error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar a auditoria. Confira se a migração de auditoria foi aplicada.</p> : !events?.length ? <p className="admin-empty">Nenhuma mudança administrativa registrada.</p> : <section className="account-card maker-products-card seller-finance-ledger">
      <div className="seller-finance-table-wrap"><table className="seller-finance-table">
        <caption className="sr-only">Mudanças de status administrativas mais recentes</caption>
        <thead><tr><th scope="col">Data e hora</th><th scope="col">Responsável</th><th scope="col">Registro</th><th scope="col">Mudança</th></tr></thead>
        <tbody>{events.map((event) => <tr key={event.id}>
          <td><time dateTime={event.created_at}>{dateTime.format(new Date(event.created_at))}</time></td>
          <td><code>{event.actor_user_id?.slice(0, 8) ?? "—"}</code></td>
          <td>{getAdminAuditEntityLabel(event.entity_type)}<br /><code>{event.entity_id.slice(0, 8)}</code></td>
          <td>{event.field_name}: {formatAdminAuditValue(event.previous_value)} → {formatAdminAuditValue(event.new_value)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>}
    {!error && (count ?? 0) > pageSize && <nav className="catalog-pagination admin-catalog-pagination" aria-label="Paginação da auditoria"><span>Página {requestedPage} de {pages} · {count} eventos</span><div>{requestedPage > 1 && <Link className="button button-secondary" href={`/admin/auditoria?pagina=${requestedPage - 1}`}>Anterior</Link>}{requestedPage < pages && <Link className="button button-secondary" href={`/admin/auditoria?pagina=${requestedPage + 1}`}>Próxima</Link>}</div></nav>}
  </main></>;
}
