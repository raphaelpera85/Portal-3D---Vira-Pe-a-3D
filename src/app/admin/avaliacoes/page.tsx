import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { reviewMarketplaceReviewAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Moderação de avaliações | ViraPeça 3D", robots: { index: false, follow: false } };

export default async function MarketplaceReviewsAdminPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { data, error } = await actor.supabase.from("marketplace_reviews")
    .select("id, review_type, rating, body, order_id, created_at, product:marketplace_products(name, slug), store:stores!inner(name)")
    .eq("status", "pending").order("created_at").limit(100);
  return <><SiteHeader /><main className="admin-dashboard shell">
    <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">CONFIANÇA NO MARKETPLACE</p><h1>Moderação de avaliações</h1><p>Somente compras pagas e concluídas podem receber avaliação. Aprove comentários antes de exibi-los publicamente.</p></div>
    {resultado && <p className={`auth-notice ${resultado === "erro" ? "is-error" : "is-success"}`} role="status">{resultado === "erro" ? "Não foi possível salvar a análise." : resultado === "publicada" ? "Avaliação publicada." : "Avaliação recusada."}</p>}
    <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">FILA DE MODERAÇÃO</span><h2>Aguardando análise</h2></div>
      {error ? <p className="auth-notice is-error">Não foi possível carregar a fila. Confira se a migração 034 foi aplicada.</p> : data?.length ? data.map((review) => {
        const product = Array.isArray(review.product) ? review.product[0] : review.product;
        const store = Array.isArray(review.store) ? review.store[0] : review.store;
        return <article className="admin-review-card" key={review.id}><div>
          <span className="account-kicker">{review.review_type === "product" ? "PRODUTO" : "LOJA"} · {store?.name} · COMPRA {review.order_id.slice(0, 8)}</span>
          <h3>{review.review_type === "product" && product?.slug ? <Link href={`/produtos/${product.slug}`}>{product.name}</Link> : store?.name}</h3>
          <p aria-label={`${review.rating} de 5 estrelas`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)} · {review.rating}/5</p>
          {review.body && <p>{review.body}</p>}
          <small>Recebida em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(review.created_at))}</small>
        </div><form action={reviewMarketplaceReviewAction} className="admin-review-actions"><input type="hidden" name="reviewId" value={review.id} /><button className="button button-primary" name="decision" value="published" type="submit">Publicar</button><button className="button button-secondary" name="decision" value="rejected" type="submit">Recusar</button></form></article>;
      }) : <p className="admin-empty">Nenhuma avaliação aguardando moderação.</p>}
    </section>
  </main></>;
}
