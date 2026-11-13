import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { reviewCatalogSourceUpdateAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Atualizações dos catálogos | ViraPeça 3D", robots: { index: false, follow: false } };

const eventLabels: Record<string, string> = {
  source_changed: "Fonte alterada", source_unavailable: "Fonte indisponível", source_moved: "Redirecionamento detectado",
  source_check_failed: "Falha na verificação",
};
const typeLabels: Record<string, string> = { printer: "Impressora", material: "Material ou resina", nozzle: "Bico" };
const stateLabels: Record<string, string> = {
  current: "Fonte respondeu", unavailable: "Fonte indisponível", moved: "Redirecionada", changed: "Requer conferência",
  uncheckable: "Sem validadores HTTP", failed: "Falha na verificação",
};
const notices: Record<string, string> = {
  salvo: "Revisão registrada.", analisada: "Esse alerta já foi analisado.", erro: "Não foi possível registrar a revisão.",
};
const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));

export default async function CatalogUpdatesPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const [updates, watchState, versions] = await Promise.all([
    actor.supabase.from("catalog_update_history").select("*").eq("status", "pending").order("checked_at", { ascending: false }).limit(100),
    actor.supabase.from("catalog_source_watch_state").select("*").order("last_checked_at", { ascending: false }).limit(100),
    actor.supabase.from("catalog_versions").select("*").order("changed_at", { ascending: false }).limit(30),
  ]);
  const queriesFailed = updates.error || watchState.error || versions.error;

  return <>
    <SiteHeader />
    <main className="admin-dashboard shell">
      <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
      <nav className="admin-catalog-links" aria-label="Catálogos técnicos"><Link href="/admin/catalogos/impressoras">Impressoras</Link><Link href="/admin/catalogos/materiais">Materiais e resinas</Link><Link href="/admin/catalogos/bicos">Bicos e compatibilidade</Link><Link aria-current="page" href="/admin/catalogos/atualizacoes">Atualizações</Link></nav>
      <div className="account-heading maker-dashboard-heading"><p className="eyebrow">CURADORIA TÉCNICA</p><h1>Atualizações dos catálogos</h1><p>Uma vez por semana, o sistema consulta cabeçalhos HTTP e, quando faltam validadores, compara o conteúdo de fontes pequenas por SHA-256. Nenhuma especificação é atualizada sem conferência administrativa.</p></div>
      {resultado && notices[resultado] && <p className={`auth-notice ${resultado === "erro" ? "is-error" : "is-success"}`} role="status">{notices[resultado]}</p>}
      {queriesFailed && <p className="auth-notice is-error" role="alert">Não foi possível carregar o histórico. Confira se a migração de monitoramento foi aplicada.</p>}

      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">VALIDAÇÃO HUMANA</span><h2>Alertas pendentes</h2></div>
        {!queriesFailed && !updates.data?.length && <p className="admin-empty">Nenhuma fonte requer revisão.</p>}
        {updates.data?.map((item) => <article className="admin-review-card" key={item.id}>
          <div><span className="account-kicker">{typeLabels[item.catalog_type] ?? "Catálogo"} · {eventLabels[item.event_type] ?? item.event_type} · {formatDate(item.checked_at)} UTC</span><h3>{item.record_label}</h3>
            <p>O registro não foi alterado. Revise a fonte e as especificações no catálogo antes de confirmar a análise.</p>
            <p><a href={item.source_url} target="_blank" rel="noreferrer">Abrir fonte oficial</a></p>
            {item.observed_http_status && <p>Resposta HTTP: {item.observed_http_status}</p>}
          </div>
          <form action={reviewCatalogSourceUpdateAction}><input type="hidden" name="updateId" value={item.id} /><label>Nota de revisão (opcional)<input name="note" maxLength={1000} /></label><div className="admin-review-actions"><button className="button button-primary" name="decision" value="confirmed" type="submit">Conferi a fonte</button><button className="button button-secondary" name="decision" value="dismissed" type="submit">Dispensar alerta</button></div></form>
        </article>)}
      </section>

      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">MONITORAMENTO</span><h2>Últimas verificações</h2></div>
        {!queriesFailed && !watchState.data?.length && <p className="admin-empty">A primeira verificação ocorrerá no dia configurado no deploy (segunda-feira por padrão), às 12h UTC.</p>}
        {watchState.data?.map((item) => <article className="account-card admin-banner-record" key={`${item.catalog_type}:${item.record_id}`}>
          <div className="admin-banner-record-heading"><div><span className="account-kicker">{typeLabels[item.catalog_type] ?? "Catálogo"} · {stateLabels[item.watch_state] ?? item.watch_state} · {formatDate(item.last_checked_at)} UTC</span><h3>{item.record_label}</h3><p>{item.check_detail ?? "A fonte respondeu e os validadores não indicaram alteração."}{item.last_http_status ? ` · HTTP ${item.last_http_status}` : ""}</p></div></div>
        </article>)}
      </section>

      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">VERSÕES ANTERIORES</span><h2>Histórico de especificações</h2></div>
        {!queriesFailed && !versions.data?.length && <p className="admin-empty">As versões anteriores serão guardadas automaticamente a cada alteração administrativa.</p>}
        {versions.data?.map((version) => {
          const snapshot = version.record_snapshot as Record<string, unknown>;
          const label = [snapshot.manufacturer, snapshot.model ?? snapshot.product, snapshot.variant ?? snapshot.interface].filter((part): part is string => typeof part === "string" && Boolean(part)).join(" ");
          return <article className="account-card admin-banner-record" key={version.id}><div className="admin-banner-record-heading"><div><span className="account-kicker">{typeLabels[version.catalog_type] ?? "Catálogo"} · VERSÃO {version.version_number} · {formatDate(version.changed_at)} UTC</span><h3>{label || "Registro técnico"}</h3><details><summary>Ver dados anteriores</summary><pre className="catalog-version-snapshot">{JSON.stringify(snapshot, null, 2)}</pre></details></div></div></article>;
        })}
      </section>
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Catálogo mestre ViraPeça 3D.</p><span>© 2026 ViraPeça 3D</span></div></footer>
  </>;
}
