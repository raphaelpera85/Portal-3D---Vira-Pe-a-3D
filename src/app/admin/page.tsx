import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel administrativo | ViraPeça 3D", robots: { index: false, follow: false } };

function formatBrlCents(value: string | number | null | undefined) {
  const cents = BigInt(value ?? 0);
  const hundred = BigInt(100);
  return `R$ ${new Intl.NumberFormat("pt-BR").format(cents / hundred)},${(cents % hundred).toString().padStart(2, "0")}`;
}

function formatCount(value: string | number | null | undefined) {
  return new Intl.NumberFormat("pt-BR").format(BigInt(value ?? 0));
}

export default async function AdminPage() {
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) redirect("/conta");

  const metricsAdmin = createSupabaseAdminClient();
  const [metricsResult, applications, stores, products, printProfiles, designers, reports, reviews, printerSuggestions, supportTickets] = await Promise.all([
    metricsAdmin ? metricsAdmin.rpc("get_admin_marketplace_metrics") : Promise.resolve({ data: null, error: new Error("Admin database key is not configured") }),
    actor.supabase.from("maker_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    actor.supabase.from("stores").select("id", { count: "exact", head: true }).eq("status", "pending"),
    actor.supabase.from("marketplace_products").select("id, store:stores!inner(status)", { count: "exact", head: true }).eq("catalog_status", "draft").eq("store.status", "published"),
    actor.supabase.from("maker_print_profiles").select("id", { count: "exact", head: true }).eq("sharing_scope", "community").eq("review_status", "pending"),
    actor.supabase.from("designer_profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    actor.supabase.from("digital_asset_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    actor.supabase.from("marketplace_reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
    actor.supabase.from("printer_model_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    actor.supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress", "waiting_user"]),
  ]);

  const queues = [
    { label: "Solicitações de fabricantes", href: "/admin/fabricantes", result: applications },
    { label: "Lojas aguardando publicação", href: "/admin/fabricantes", result: stores },
    { label: "Anúncios para revisar", href: "/admin/fabricantes", result: products },
    { label: "Perfis de impressão", href: "/admin/fabricantes", result: printProfiles },
    { label: "Perfis de designers", href: "/admin/designers", result: designers },
    { label: "Denúncias de conteúdo", href: "/admin/denuncias-digitais", result: reports },
    { label: "Avaliações para moderar", href: "/admin/avaliacoes", result: reviews },
    { label: "Sugestões de impressoras", href: "/admin/catalogos/impressoras", result: printerSuggestions },
    { label: "Atendimentos pendentes", href: "/admin/atendimento", result: supportTickets },
  ];
  const metrics = metricsResult.data?.[0];
  const metricCards = [
    { label: "GMV bruto · sem frete", value: metrics ? formatBrlCents(metrics.gmv_cents) : "—", detail: "Transações confirmadas, antes de estornos" },
    { label: "Comissão bruta registrada", value: metrics ? formatBrlCents(metrics.gross_marketplace_fee_cents) : "—", detail: "Valor original gravado no checkout" },
    { label: "Ticket médio bruto", value: metrics ? formatBrlCents(metrics.average_ticket_cents) : "—", detail: "GMV dividido por pagamentos confirmados" },
    { label: "Pagamentos confirmados", value: metrics ? formatCount(metrics.paid_payment_count) : "—", detail: "Inclui produto, digital e impressão" },
    { label: "Reembolsos processados", value: metrics ? formatBrlCents(metrics.processed_refund_cents) : "—", detail: metrics ? `${formatCount(metrics.processed_refund_count)} concluídos` : "Contagem indisponível" },
    { label: "Cancelamentos de pagamento", value: metrics ? formatCount(metrics.confirmed_cancellation_count) : "—", detail: "Confirmados pelo provedor" },
    { label: "Contestações registradas", value: metrics ? formatCount(metrics.chargeback_case_count) : "—", detail: "Casos sincronizados do Mercado Pago" },
    { label: "Usuários", value: metrics ? formatCount(metrics.user_count) : "—", detail: "Contas com papel ativo no portal" },
    { label: "Fabricantes aprovados", value: metrics ? formatCount(metrics.maker_count) : "—", detail: "Contas com papel de fabricante" },
    { label: "Lojas publicadas", value: metrics ? formatCount(metrics.published_store_count) : "—", detail: "Visíveis no marketplace" },
    { label: "Anúncios publicados", value: metrics ? formatCount(metrics.published_product_count) : "—", detail: "Em lojas publicadas" },
  ];

  return <><SiteHeader /><main className="admin-dashboard shell">
    <Link className="viewer-back-link" href="/conta">← Voltar à conta</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">OPERAÇÃO DA PLATAFORMA</p><h1>Painel administrativo</h1><p>Veja as filas de revisão e acesse os módulos de gestão do ViraPeça 3D.</p></div>
    <section className="admin-overview-section" aria-labelledby="admin-metrics-title">
      <div className="admin-section-title"><span className="account-kicker">VISÃO ACUMULADA</span><h2 id="admin-metrics-title">Indicadores do marketplace</h2></div>
      {metricsResult.error && <p className="auth-notice is-error" role="alert">Indicadores indisponíveis. Confira se a migração do painel administrativo foi aplicada.</p>}
      <div className="admin-overview-grid">{metricCards.map((metric) => <article className="admin-overview-card" key={metric.label}>
        <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small>
      </article>)}</div>
      <p className="admin-metrics-note">GMV e comissão são valores brutos e incluem transações depois reembolsadas ou contestadas. A comissão é a registrada no checkout; liquidações e receita líquida não são sincronizadas.</p>
    </section>
    <section className="admin-overview-section" aria-labelledby="admin-queues-title">
      <div className="admin-section-title"><span className="account-kicker">AGUARDANDO AÇÃO</span><h2 id="admin-queues-title">Filas de revisão</h2></div>
      <div className="admin-overview-grid">{queues.map(({ label, href, result }) => <Link className="admin-overview-card" href={href} key={label}>
        <span>{label}</span><strong>{result.error ? "—" : new Intl.NumberFormat("pt-BR").format(result.count ?? 0)}</strong><small>{result.error ? "Contagem indisponível" : "itens aguardando"}</small>
      </Link>)}</div>
    </section>
    <section className="admin-overview-section" aria-labelledby="admin-tools-title">
      <div className="admin-section-title"><span className="account-kicker">GESTÃO</span><h2 id="admin-tools-title">Módulos administrativos</h2></div>
      <nav className="admin-overview-tools" aria-label="Módulos administrativos">
        <Link className="button button-secondary" href="/admin/fabricantes">Fabricantes, lojas e anúncios</Link>
        <Link className="button button-secondary" href="/admin/designers">Designers</Link>
        <Link className="button button-secondary" href="/admin/banners">Banners da página inicial</Link>
        <Link className="button button-secondary" href="/admin/categorias">Categorias de produtos</Link>
        <Link className="button button-secondary" href="/admin/catalogos/impressoras">Catálogo de impressoras</Link>
        <Link className="button button-secondary" href="/admin/catalogos/materiais">Materiais e resinas</Link>
        <Link className="button button-secondary" href="/admin/catalogos/bicos">Bicos e compatibilidade</Link>
        <Link className="button button-secondary" href="/admin/catalogos/atualizacoes">Atualizações dos catálogos</Link>
        <Link className="button button-secondary" href="/admin/avaliacoes">Moderação de avaliações</Link>
        <Link className="button button-secondary" href="/admin/denuncias-digitais">Denúncias de conteúdo</Link>
        <Link className="button button-secondary" href="/admin/atendimento">Central de atendimento</Link>
      </nav>
    </section>
  </main></>;
}
