import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { filterAdminUserDirectory, getAdminRoleLabel, parseAdminUserPage } from "@/lib/admin-user-directory";
import { loadAdminUserDirectory } from "@/lib/admin-user-directory.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Usuários | ViraPeça 3D", robots: { index: false, follow: false } };

const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function pageHref(page: number, query: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  return `/admin/usuarios?${params}`;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; q?: string | string[] }> }) {
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const params = await searchParams;
  const page = parseAdminUserPage(params.page);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const directory = await loadAdminUserDirectory(page);
  const users = filterAdminUserDirectory(directory.users, query);

  return <><SiteHeader /><main id="main-content" tabIndex={-1} className="admin-dashboard shell">
    <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">GESTÃO DA PLATAFORMA</p><h1>Usuários</h1><p>Contas e papéis cadastrados no portal.</p></div>
    {directory.error ? <section className="admin-review-section"><p className="auth-notice is-error" role="alert">Não foi possível carregar usuários. Confira a configuração administrativa do banco.</p></section> : <>
      <section className="admin-review-section" aria-label="Busca de usuários">
        <form className="admin-period-report-form" action="/admin/usuarios" method="get">
          <label htmlFor="user-directory-search">Buscar nesta página<input id="user-directory-search" name="q" type="search" maxLength={100} defaultValue={query} placeholder="E-mail, nome ou papel" /></label>
          <button className="button button-secondary" type="submit">Buscar</button>
          <span>{directory.total.toLocaleString("pt-BR")} contas · {directory.pageSize} por página</span>
        </form>
        <p className="admin-metrics-note">A busca filtra a página atual.</p>
      </section>
      {users.length ? <div className="seller-finance-table-wrap"><table className="seller-activity-report-table">
        <caption className="sr-only">Contas de usuário e papéis atribuídos</caption>
        <thead><tr><th>E-mail</th><th>Nome</th><th>Papéis</th><th>Cadastro</th><th>E-mail confirmado</th></tr></thead>
        <tbody>{users.map((user) => <tr key={user.id}>
          <th>{user.email || "E-mail indisponível"}</th><td>{user.displayName || "Não informado"}</td>
          <td>{user.roles.length ? user.roles.map(getAdminRoleLabel).join(", ") : "Sem papel"}</td>
          <td>{dateLabel(user.createdAt)}</td><td>{user.emailConfirmedAt ? dateLabel(user.emailConfirmedAt) : "Pendente"}</td>
        </tr>)}</tbody>
      </table></div> : <section className="admin-review-section"><p className="admin-empty">{directory.total === 0 ? "Nenhuma conta cadastrada." : query ? "Nenhum usuário desta página corresponde à busca." : "Esta página não contém contas."}</p></section>}
      {directory.pages > 1 && <nav className="admin-period-report-form" aria-label="Paginação de usuários">
        {page > 1 && <Link className="button button-secondary" href={pageHref(page - 1, query)}>Página anterior</Link>}
        <span>Página {page} de {directory.pages}</span>
        {page < directory.pages && <Link className="button button-secondary" href={pageHref(page + 1, query)}>Próxima página</Link>}
      </nav>}
    </>}
  </main></>;
}
