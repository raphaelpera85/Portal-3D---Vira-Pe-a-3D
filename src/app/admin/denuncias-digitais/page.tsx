import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { reviewDigitalAssetReportAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Denúncias de arquivos digitais | ViraPeça 3D", robots: { index: false, follow: false } };
const reasonLabel: Record<string, string> = { copyright: "Direitos autorais", trademark: "Marca registrada", other: "Outro direito" };

export default async function DigitalAssetReportsPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { data, error } = await actor.supabase.from("digital_asset_reports")
    .select("id, reason, details, created_at, product:marketplace_products!inner(name, slug, store:stores(name))")
    .eq("status", "open").order("created_at").limit(100);
  return <><SiteHeader /><main className="admin-dashboard shell"><Link className="viewer-back-link" href="/admin/fabricantes">← Revisão do marketplace</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">INTEGRIDADE DO CATÁLOGO</p><h1>Denúncias de conteúdo</h1><p>Revise alegações de violação de direitos em modelos digitais publicados.</p></div>
    {resultado && <p className={`auth-notice ${resultado === "erro" ? "is-error" : "is-success"}`} role="status">{resultado === "erro" ? "Não foi possível salvar a análise." : "Denúncia analisada."}</p>}
    <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">FILA ABERTA</span><h2>Denúncias pendentes</h2></div>
      {error ? <p className="auth-notice is-error">Não foi possível carregar a fila. Confira se as migrações 030 e 031 foram aplicadas.</p> : data?.length ? data.map((report) => {
        const product = Array.isArray(report.product) ? report.product[0] : report.product;
        const store = Array.isArray(product?.store) ? product.store[0] : product?.store;
        return <article className="digital-report-card" key={report.id}><div><span className="account-kicker">{reasonLabel[report.reason] ?? report.reason} · {store?.name}</span><h3><Link href={`/produtos/${product?.slug}`}>{product?.name}</Link></h3><p>{report.details}</p><small>Recebida em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(report.created_at))}</small></div>
          <form action={reviewDigitalAssetReportAction}><input type="hidden" name="reportId" value={report.id} /><label>Retorno (opcional)<input name="note" maxLength={1000} /></label><button className="button button-primary" name="decision" value="resolved" type="submit">Resolver denúncia · manter anúncio</button><button className="button button-secondary" name="decision" value="dismissed" type="submit">Arquivar denúncia</button><button className="button button-secondary" name="decision" value="archived" type="submit">Retirar anúncio do ar</button></form>
        </article>;
      }) : <p className="admin-empty">Nenhuma denúncia aberta.</p>}
    </section>
  </main></>;
}
