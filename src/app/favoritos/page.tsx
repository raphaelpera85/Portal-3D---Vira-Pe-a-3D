import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
import { ProductIllustration } from "@/components/product-illustration";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { mapMarketplaceProduct } from "@/lib/marketplace-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Favoritos | ViraPeça 3D", robots: { index: false, follow: false } };

export default async function FavoritesPage() {
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");

  const favoritesResult = await actor.supabase.from("buyer_product_favorites").select("product_id, created_at")
    .eq("buyer_id", actor.user.id).order("created_at", { ascending: false });
  const favoriteIds = favoritesResult.data?.map((item) => item.product_id) ?? [];
  const productsResult = favoriteIds.length ? await actor.supabase.from("marketplace_products")
    .select("id, store_id, slug, name, description, price_mode, price_brl, media, tags, color_theme, visual, store:stores!inner(name, slug), category:product_categories!inner(name, slug)")
    .in("id", favoriteIds).eq("catalog_status", "published").eq("store.status", "published").eq("category.active", true) : { data: [], error: null };
  const productsById = new Map((productsResult.data ?? []).map((row) => {
    const product = mapMarketplaceProduct(row as Record<string, unknown>);
    return [product.id, product] as const;
  }));
  const products = favoriteIds.map((id) => productsById.get(id)).filter((product) => product !== undefined);
  const unavailableIds = favoriteIds.filter((id) => !productsById.has(id));

  return <>
    <SiteHeader />
    <main className="account-page shell favorites-page">
      <Link className="viewer-back-link" href="/#produtos">← Voltar aos produtos</Link>
      <div className="account-heading"><p className="eyebrow"><Heart size={15} aria-hidden="true" /> ÁREA DO COMPRADOR</p><h1>Seus favoritos</h1><p>Guarde as peças que quer encontrar de novo.</p></div>
      {favoritesResult.error || productsResult.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar os favoritos. Confira se a migração do marketplace está aplicada.</p> : products.length === 0 && unavailableIds.length === 0 ? <section className="account-card"><h2>Nenhum favorito salvo</h2><p>Explore a vitrine e salve produtos publicados para encontrá-los aqui.</p><Link className="button button-primary" href="/#produtos">Explorar produtos</Link></section> : <div className="favorite-grid">
        {products.map((product) => <article className="favorite-card" key={product.id}>
          <Link className={`product-art art-${product.color}`} href={`/produtos/${product.slug}`} aria-label={`Ver ${product.name}`}>
            {product.media[0] ? <img src={product.media[0]} alt={product.name} width="480" height="380" loading="lazy" /> : product.visual ? <ProductIllustration product={product} /> : <span className="product-placeholder" aria-hidden="true">3D</span>}
          </Link>
          <div className="favorite-card-copy"><span className="account-kicker">{product.category}</span><h2><Link href={`/produtos/${product.slug}`}>{product.name}</Link></h2><p>{product.maker} · {product.priceLabel}</p></div>
          <FavoriteButton productId={product.id} slug={product.slug} initialFavorite />
        </article>)}
        {unavailableIds.map((id) => <article className="favorite-card favorite-unavailable" key={id}><div><span className="account-kicker">INDISPONÍVEL</span><h2>Produto não publicado</h2><p>Este item não está disponível na vitrine. Você pode removê-lo dos favoritos.</p></div><FavoriteButton productId={id} slug="produto-indisponivel" initialFavorite /></article>)}
      </div>}
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Suas ideias favoritas, guardadas.</p><span>© 2026 ViraPeça 3D</span></div></footer>
  </>;
}
