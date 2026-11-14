import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPaginationRedirectPage, maxPageNumber, parsePageNumber } from "@/lib/pagination";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contestações de pagamento | ViraPeça 3D", robots: { index: false, follow: false } };

const caseLabels: Record<string, string> = { in_process: "Em análise", settled: "Decidida", reimbursed: "Valor devolvido ao vendedor" };
const documentationLabels: Record<string, string> = {
  pending: "Documentos pendentes", review_pending: "Em análise pelo Mercado Pago", valid: "Documentos aceitos",
  invalid: "Documentos recusados", not_supplied: "Prazo encerrado", not_applicable: "Envio não aplicável",
};
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Não informado";
const moneyLabel = (cents: number | string, currency: string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(cents) / 100);

export default async function AdminChargebacksPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { pagina } = await searchParams;
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) redirect("/conta");

  const pageSize = 24;
  const page = parsePageNumber(pagina) ?? 1;
  const admin = createSupabaseAdminClient();
  const result = admin ? await admin.from("seller_order_chargebacks")
    .select("case_id, payment_id, store_id, case_status, reason, amount_cents, currency, coverage_applied, coverage_eligible, documentation_status, documentation_deadline, documents_sent_at, documents_count, provider_updated_at, created_at, store:stores(name), payment:seller_order_payments!inner(order_id, status, provider_order_id, created_at)", { count: "exact" })
    .order("provider_updated_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).order("case_id", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
    : { data: null, error: new Error("Admin database key is not configured"), count: null };
  const pages = Math.max(1, Math.ceil((result.count ?? 0) / pageSize));
  const redirectPage = getPaginationRedirectPage(page, pages);
  if (!result.error && redirectPage !== null) redirect(`/admin/financeiro/contestacoes?pagina=${redirectPage}`);

  return <><SiteHeader /><main id="main-content" tabIndex={-1} className="admin-dashboard shell">
    <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">FINANCEIRO DA PLATAFORMA</p><h1>Contestações de pagamento</h1><p>Acompanhe os estados sincronizados do Mercado Pago e os prazos de documentação informados ao fabricante.</p></div>
    {result.error ? <section className="admin-review-section"><p className="auth-notice is-error" role="alert">Não foi possível carregar as contestações. Confira a configuração administrativa do banco.</p></section>
      : !result.data?.length ? <section className="admin-review-section"><p className="admin-empty">Nenhuma contestação sincronizada.</p></section>
        : <section className="admin-review-section" aria-label="Casos de contestação">
          {result.data.map((row) => {
            const store = Array.isArray(row.store) ? row.store[0] : row.store;
            const payment = Array.isArray(row.payment) ? row.payment[0] : row.payment;
            return <article className="admin-review-card admin-review-card-compact" key={row.case_id}>
              <div><h2>Contestação {row.case_id}</h2>
                <p>{store?.name ?? "Loja indisponível"} · Pedido {payment?.order_id ?? "não localizado"} · {moneyLabel(row.amount_cents, row.currency)}</p>
                <p>Status no provedor: <strong>{caseLabels[row.case_status] ?? row.case_status}</strong>{row.reason ? ` · Motivo: ${row.reason}` : ""}</p>
                <p>Documentação: <strong>{documentationLabels[row.documentation_status] ?? row.documentation_status}</strong> · {row.documents_count} arquivo(s){row.documents_sent_at ? ` enviados em ${dateLabel(row.documents_sent_at)}` : " enviados"}</p>
                <p>Prazo informado pelo Mercado Pago: {dateLabel(row.documentation_deadline)} · Última sincronização: {dateLabel(row.provider_updated_at)}</p>
                <p>Cobertura do provedor: {row.coverage_applied === null ? "não informada" : row.coverage_applied ? "aplicada" : "não aplicada"}{row.coverage_eligible !== null ? ` · elegível: ${row.coverage_eligible ? "sim" : "não"}` : ""} · pagamento {payment?.status ?? "indisponível"}</p>
              </div>
            </article>;
          })}
          {(result.count ?? 0) > pageSize && <nav className="catalog-pagination admin-catalog-pagination" aria-label="Paginação das contestações"><span>Página {page} de {pages} · {result.count} casos</span><div>{page > 1 && <Link className="button button-secondary" href={`/admin/financeiro/contestacoes?pagina=${page - 1}`}>Anterior</Link>}{page < pages && page < maxPageNumber && <Link className="button button-secondary" href={`/admin/financeiro/contestacoes?pagina=${page + 1}`}>Próxima</Link>}</div></nav>}
        </section>}
    <p className="admin-metrics-note">Os estados e prazos são sincronizados do Mercado Pago. Esta tela não altera decisões do provedor nem substitui o envio de documentos no painel do fabricante.</p>
  </main></>;
}
