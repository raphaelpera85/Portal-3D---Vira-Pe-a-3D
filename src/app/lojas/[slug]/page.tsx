import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ProductIllustration } from "@/components/product-illustration";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapMarketplaceProduct } from "@/lib/marketplace-data";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ pagina?: string }> };
const pageSize = 24;

async function getPublishedStore(slug: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("stores")
    .select("id, slug, name, description, logo_url, banner_url, city, state_code, updated_at")
    .eq("slug", slug).eq("status", "published").maybeSingle();
  return error ? null : data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const store = await getPublishedStore(slug);
  if (!store) return { title: "Loja não encontrada | ViraPeça 3D", robots: { index: false } };
  const title = store.name;
  const description = store.description.slice(0, 160) || `Conheça os produtos e serviços da loja ${store.name} no ViraPeça 3D.`;
  const image = store.banner_url || "/opengraph-image";
  return {
    title: `${title} | Lojas ViraPeça 3D`,
    description,
    alternates: { canonical: `/lojas/${encodeURIComponent(store.slug)}` },
    openGraph: { title, description: store.description || `Vitrine de ${store.name} no ViraPeça 3D.`, type: "website", images: [image] },
    twitter: { card: "summary_large_image", title: `${title} | Lojas ViraPeça 3D`, description, images: [image] },
  };
}

export default async function StoreProfilePage({ params, searchParams }: Props) {
  const [{ slug }, { pagina }, supabase] = await Promise.all([params, searchParams, createSupabaseServerClient()]);
  if (!supabase) notFound();
  const { data: store, error: storeError } = await supabase.from("stores")
    .select("id, slug, name, description, logo_url, banner_url, city, state_code, updated_at")
    .eq("slug", slug).eq("status", "published").maybeSingle();
  if (storeError || !store) notFound();
  const requestedPage = typeof pagina === "string" && /^\d+$/.test(pagina) ? Number(pagina) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const [policyResult, productResult, reviewResult] = await Promise.all([
    supabase.from("stores").select("commercial_policies").eq("id", store.id).maybeSingle(),
    supabase.from("marketplace_products").select("id, store_id, slug, name, description, listing_type, price_mode, price_brl, fulfillment_mode, stock_quantity, preparation_days, media, tags, color_theme, visual, digital_asset:digital_assets(personal_price_brl, commercial_price_brl), store:stores!inner(name, slug), category:product_categories!inner(name, slug)", { count: "exact" })
      .eq("store_id", store.id).eq("catalog_status", "published").eq("store.status", "published")
      .order("published_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
    supabase.from("marketplace_reviews").select("id, rating, body, created_at")
      .eq("review_type", "store").eq("store_id", store.id).eq("status", "published")
      .order("created_at", { ascending: false }).limit(30),
  ]);
  const products = (productResult.data ?? []).map((row) => mapMarketplaceProduct(row as Record<string, unknown>));
  const pages = Math.max(1, Math.ceil((productResult.count ?? 0) / pageSize));
  const productCards = products.map((product) => <article className="product-card" key={product.id}>
    <Link className={`product-art art-${product.color}`} href={`/produtos/${product.slug}`} aria-label={`Ver ${product.name}`}>
      {product.media[0] ? <img src={product.media[0]} alt={product.name} width="480" height="380" loading="lazy" /> : product.visual ? <ProductIllustration product={product} /> : <span className="product-placeholder" aria-hidden="true">3D</span>}
    </Link><div className="product-meta"><span>{product.category}</span><span>{product.listingType === "digital" ? "ARQUIVO DIGITAL" : product.fulfillmentMode === "made_to_order" ? `SOB ENCOMENDA${product.preparationDays == null ? "" : ` · ATÉ ${product.preparationDays} DIAS`}` : product.stockQuantity == null ? "CONSULTE DISPONIBILIDADE" : `${product.stockQuantity} EM ESTOQUE`}</span></div>
    <h3><Link href={`/produtos/${product.slug}`}>{product.name}</Link></h3><p className="product-price">{product.priceLabel}</p><Link className="button button-secondary" href={`/produtos/${product.slug}`}>Ver produto</Link>
  </article>);
  const base = getSiteUrl();
  return <><SiteHeader /><main className="store-profile-page shell">
    <Link className="viewer-back-link" href="/lojas">← Todas as lojas</Link>
    <header className="store-profile-hero">
      {store.banner_url && <img className="store-profile-banner" src={store.banner_url} alt="" aria-hidden="true" />}
      {store.logo_url ? <img className="store-profile-logo" src={store.logo_url} alt={`Logotipo de ${store.name}`} width="104" height="104" /> : <span className="store-profile-monogram" aria-hidden="true">{store.name.slice(0, 1).toUpperCase()}</span>}
      <div><span className="account-kicker">FABRICANTE APROVADO{store.city ? ` · ${store.city}${store.state_code ? `/${store.state_code}` : ""}` : ""}</span><h1>{store.name}</h1><p>{store.description || "Conheça os produtos e serviços desta loja."}</p></div>
    </header>
    {policyResult.data?.commercial_policies && <section className="store-profile-policies"><span className="account-kicker">POLÍTICAS COMERCIAIS</span><p>{policyResult.data.commercial_policies}</p></section>}
    <section className="store-profile-products" id="produtos"><div className="section-heading"><div><p className="eyebrow">VITRINE DA LOJA</p><h2>Produtos e serviços</h2></div><p>{productResult.count ?? 0} anúncio(s) publicado(s)</p></div>
      {productResult.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar os anúncios desta loja.</p> : products.length ? <div className="product-grid">{productCards}</div> : <p className="empty-state">Esta loja ainda não publicou produtos.</p>}
      {pages > 1 && <nav className="catalog-pagination" aria-label="Paginação de produtos da loja">{page > 1 ? <Link className="button button-secondary" href={`/lojas/${store.slug}?pagina=${page - 1}#produtos`}>← Página anterior</Link> : <span />}<span>Página {page} de {pages}</span>{page < pages ? <Link className="button button-secondary" href={`/lojas/${store.slug}?pagina=${page + 1}#produtos`}>Próxima página →</Link> : <span />}</nav>}
    </section>
    <section className="store-profile-reviews"><div className="section-heading"><div><p className="eyebrow">COMPRAS VERIFICADAS</p><h2>Avaliações da loja</h2></div><p>Avaliações de pedidos pagos e concluídos, aprovadas pela equipe.</p></div>
      {reviewResult.error ? <p className="quote-small-note">As avaliações estarão disponíveis após configurar o banco do portal.</p> : reviewResult.data?.length ? <div className="store-reviews-list">{reviewResult.data.map((review) => <article className="product-review-card" key={review.id}><p className="product-review-stars" aria-label={`${review.rating} de 5 estrelas`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>{review.body && <p>{review.body}</p>}<small>Comprador verificado · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(review.created_at))}</small></article>)}</div> : <p className="quote-small-note">Esta loja ainda não tem avaliações publicadas.</p>}
    </section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org", "@type": "Store", name: store.name,
      description: store.description || undefined, url: base ? new URL(`/lojas/${store.slug}`, base).toString() : undefined,
      logo: store.logo_url || undefined, image: store.banner_url || undefined, address: store.city ? { "@type": "PostalAddress", addressLocality: store.city, addressRegion: store.state_code || undefined, addressCountry: "BR" } : undefined,
    }).replace(/</g, "\\u003c") }} />
  </main></>;
}
