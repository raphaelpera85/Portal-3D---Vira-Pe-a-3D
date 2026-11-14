import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ProductIllustration } from "@/components/product-illustration";
import { ProductQuoteRequestForm } from "@/components/product-quote-request-form";
import { ProductPurchaseRequestForm } from "@/components/product-purchase-request-form";
import { ProductCartForm } from "@/components/product-cart-form";
import { loadMarketplaceProduct } from "@/lib/marketplace.server";
import { getUserWithRole } from "@/lib/auth-role.server";
import { getSiteUrl } from "@/lib/site-url";
import { FavoriteButton } from "@/components/favorite-button";
import { ProductPrintProfiles } from "@/components/product-print-profiles";
import { readPrintProfileColors } from "@/lib/print-profile-colors";
import { DigitalAssetPurchaseForm } from "@/components/digital-asset-purchase-form";
import { DigitalAssetReportForm } from "@/components/digital-asset-report-form";
import { ModelViewer } from "@/components/model-viewer";
import { ProductVariantChooser } from "@/components/product-variant-chooser";
import { ProductImageGallery } from "@/components/product-image-gallery";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadMarketplaceProduct(slug);
  if (!product) return { title: "Produto não encontrado | ViraPeça 3D", robots: { index: false } };
  const title = product.name;
  const description = product.description || `${product.name}, por ${product.maker}.`;
  const image = product.media[0] || "/opengraph-image";
  return {
    title: `${title} | ViraPeça 3D`,
    description,
    robots: product.demo ? { index: false, follow: false } : undefined,
    ...(getSiteUrl() ? {
      alternates: { canonical: `/produtos/${encodeURIComponent(product.slug)}` },
      openGraph: { title, description, url: `/produtos/${encodeURIComponent(product.slug)}`, type: "website" as const, images: [image] },
      twitter: { card: "summary_large_image" as const, title: `${title} | ViraPeça 3D`, description, images: [image] },
    } : {}),
  };
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ orcamento?: string; compra?: string; carrinho?: string; denuncia?: string; variant?: string }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const product = await loadMarketplaceProduct(slug);
  if (!product) notFound();
  const buyer = !product.demo ? await getUserWithRole("buyer") : null;
  const profileResult = buyer?.supabase ? await buyer.supabase.from("maker_print_profiles")
    .select("id, profile_name, profile_type, sharing_scope, printer_snapshot, material_snapshot, nozzle_snapshot, layer_height_mm, infill_percent, wall_count, supports, orientation, scale_percent, quantity, print_hours, material_grams, material_by_color")
    .eq("product_id", product.id).in("sharing_scope", ["community", "official"]).eq("review_status", "published").order("profile_type").order("profile_name") : null;
  const [productReviews, storeReviews] = buyer?.supabase ? await Promise.all([
    buyer.supabase.from("marketplace_reviews").select("id, rating, body, created_at").eq("review_type", "product").eq("product_id", product.id).eq("status", "published").order("created_at", { ascending: false }).limit(20),
    buyer.supabase.from("marketplace_reviews").select("id, rating, body, created_at").eq("review_type", "store").eq("store_id", product.storeId).eq("status", "published").order("created_at", { ascending: false }).limit(20),
  ]) : [null, null];
  const favoriteResult = buyer?.supabase && buyer.user && buyer.authorized
    ? await buyer.supabase.from("buyer_product_favorites").select("product_id").eq("buyer_id", buyer.user.id).eq("product_id", product.id).maybeSingle()
    : null;
  const selectedVariant = product.variants?.find((variant) => variant.id === query.variant) ?? null;
  const availabilityLabel = selectedVariant
    ? selectedVariant.stockQuantity == null ? "Produzido sob encomenda" : selectedVariant.stockQuantity === 0 ? "Sem unidades disponíveis" : `${selectedVariant.stockQuantity} unidade${selectedVariant.stockQuantity === 1 ? "" : "s"} em estoque`
    : product.listingType === "digital" ? "Arquivo digital STL/3MF · download privado após pagamento" : product.stockQuantity != null ? product.stockQuantity === 0 ? "Sem unidades disponíveis" : `${product.stockQuantity} unidade${product.stockQuantity === 1 ? "" : "s"} em estoque` : product.fulfillmentMode === "made_to_order" ? `Produzido sob encomenda${product.preparationDays == null ? "" : ` · preparação em até ${product.preparationDays} dias`}` : product.fulfillmentMode === "ready_to_ship" ? "Disponibilidade a confirmar com o fabricante" : "Disponibilidade confirmada após consulta";
  const siteUrl = getSiteUrl();
  const productUrl = siteUrl ? new URL(`/produtos/${encodeURIComponent(product.slug)}`, siteUrl).toString() : null;
  const availability = (stockQuantity: number | null) => stockQuantity === 0
    ? "https://schema.org/OutOfStock"
    : stockQuantity !== null || product.fulfillmentMode === "made_to_order" || product.listingType === "digital"
      ? "https://schema.org/InStock"
      : undefined;
  const stockStatus = availability(product.stockQuantity);
  const hasVariants = Boolean(product.variants?.length || Object.keys(product.variantOptions ?? {}).length);
  const variantProperties: Record<string, string> = { cor: "color", color: "color", tamanho: "size", size: "size", material: "material", estampa: "pattern", padrao: "pattern", pattern: "pattern" };
  const normalizeVariantProperty = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const variesBy = Object.keys(product.variantOptions ?? {}).flatMap((name) => {
    const property = variantProperties[normalizeVariantProperty(name)];
    return property ? [`https://schema.org/${property}`] : [];
  });
  const offers = product.listingType === "digital"
    ? product.digitalAsset ? [
      { name: "Uso pessoal", price: product.digitalAsset.personalPriceBrl },
      ...(product.digitalAsset.commercialPriceBrl == null ? [] : [{ name: "Uso comercial", price: product.digitalAsset.commercialPriceBrl }]),
    ].map((offer) => ({ "@type": "Offer", ...offer, priceCurrency: "BRL", availability: "https://schema.org/InStock", url: productUrl })) : []
    : !hasVariants && product.priceMode === "fixed" && product.priceBrl != null
        ? [{ "@type": "Offer", price: product.priceBrl, priceCurrency: "BRL", url: productUrl, ...(stockStatus ? { availability: stockStatus } : {}) }]
        : [];
  const productDescription = product.description || "O fabricante ainda não adicionou uma descrição para este produto.";
  const productStructuredData = !product.demo && productUrl ? product.variants?.length ? {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    name: product.name,
    description: productDescription,
    url: productUrl,
    productGroupID: product.id,
    ...(variesBy.length ? { variesBy: [...new Set(variesBy)] } : {}),
    hasVariant: product.variants.map((variant) => {
      const variantUrl = `${productUrl}?variant=${encodeURIComponent(variant.id)}`;
      const variantAvailability = availability(variant.stockQuantity);
      const attributes = Object.fromEntries(Object.entries(variant.options).flatMap(([name, value]) => {
        const property = variantProperties[normalizeVariantProperty(name)];
        return property ? [[property, value]] : [];
      }));
      return {
        "@type": "Product",
        sku: variant.id,
        name: `${product.name} · ${Object.values(variant.options).join(" · ")}`,
        url: variantUrl,
        ...(product.media.length ? { image: product.media } : {}),
        ...attributes,
        offers: {
          "@type": "Offer", url: variantUrl, price: variant.priceBrl, priceCurrency: "BRL",
          ...(variantAvailability ? { availability: variantAvailability } : {}),
        },
      };
    }),
  } : {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: productDescription,
    category: product.category,
    url: productUrl,
    ...(product.media.length ? { image: product.media } : {}),
    ...(offers.length ? { offers } : {}),
  } : null;

  return (
    <>
      <SiteHeader />
      <main className="product-detail shell">
        <Link className="viewer-back-link" href="/#produtos">← Voltar aos produtos</Link>
        {productStructuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productStructuredData).replace(/</g, "\\u003c") }} />}
        {query.compra === "indisponivel" && <p className="auth-notice is-error" role="alert">A licença selecionada não está disponível para compra.</p>}
        {query.denuncia === "enviada" && <p className="auth-notice is-success" role="status">Denúncia enviada à equipe para análise.</p>}
        {query.denuncia === "erro" && <p className="auth-notice is-error" role="alert">Não foi possível registrar a denúncia.</p>}
        <div className="product-detail-grid">
          <div className="product-detail-visual">
            {product.media.length > 0 ? <ProductImageGallery key={product.id} images={product.media} name={product.name} color={product.color} /> : <div className={`product-detail-art art-${product.color}`}>
              {product.visual ? <ProductIllustration product={product} /> : <span className="product-placeholder" aria-hidden="true">3D</span>}
            </div>}
            {product.videoUrl && <video className="product-detail-video" controls preload="metadata" playsInline aria-label={`Vídeo de demonstração de ${product.name}`}><source src={product.videoUrl} /></video>}
          </div>
          <section className="product-detail-copy">
            <p className="eyebrow">{product.category}</p>
            <h1>{product.name}</h1>
            <p className="product-detail-maker">Por <strong>{product.storeSlug ? <Link href={`/lojas/${product.storeSlug}`}>{product.maker}</Link> : product.maker}</strong></p>
            <p className="product-detail-price">{selectedVariant ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(selectedVariant.priceBrl) : product.priceLabel}</p>
            {!product.demo && <p className="product-availability">{availabilityLabel}</p>}
            {!product.demo && buyer?.user && buyer.authorized && <FavoriteButton productId={product.id} slug={product.slug} initialFavorite={Boolean(favoriteResult?.data)} />}
            <p className="product-detail-description">{product.description || "O fabricante ainda não adicionou uma descrição para este produto."}</p>
            {product.physicalSpecifications && <div className="product-detail-note"><strong>Especificações da peça</strong>
              {product.physicalSpecifications.material && <p>Material: {product.physicalSpecifications.material}</p>}
              {product.physicalSpecifications.color && <p>Cor: {product.physicalSpecifications.color}</p>}
              {product.physicalSpecifications.dimensionsCm && <p>Dimensões: {Object.values(product.physicalSpecifications.dimensionsCm).map((value) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)).join(" × ")} cm</p>}
              {product.physicalSpecifications.weightG != null && <p>Peso da peça: {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(product.physicalSpecifications.weightG)} g</p>}
            </div>}
            {product.tags.length > 0 && <div className="product-tags" aria-label="Características">{product.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
            {!product.demo && product.variants?.length ? <ProductVariantChooser variants={product.variants} options={product.variantOptions ?? {}} /> : null}
            {!product.demo && product.listingType === "digital" ? product.digitalAsset
              ? <DigitalAssetPurchaseForm productId={product.id} slug={product.slug} authorized={Boolean(buyer?.user && buyer.authorized)} personalPriceBrl={product.digitalAsset.personalPriceBrl} commercialPriceBrl={product.digitalAsset.commercialPriceBrl} />
              : <div className="product-detail-note"><strong>Arquivo digital</strong><p>As licenças estão temporariamente indisponíveis.</p></div>
              : !product.demo && product.priceMode === "fixed" ? <><ProductCartForm slug={product.slug} authorized={Boolean(buyer?.user && buyer.authorized)} result={query.carrinho} stockQuantity={product.stockQuantity} variantOptions={product.variantOptions} variants={product.variants} /><ProductPurchaseRequestForm slug={product.slug} authorized={Boolean(buyer?.user && buyer.authorized)} result={query.compra} stockQuantity={product.stockQuantity} variantOptions={product.variantOptions} variants={product.variants} /></> : !product.demo && (product.priceMode === "quote" || product.priceMode === "from") ? <ProductQuoteRequestForm slug={product.slug} authorized={Boolean(buyer?.user && buyer.authorized)} result={query.orcamento} /> : <div className="product-detail-note"><strong>Compra</strong><p>Os produtos demonstrativos não aceitam pedidos.</p></div>}
            {!product.demo && product.listingType === "digital" && <DigitalAssetReportForm productId={product.id} slug={product.slug} authorized={Boolean(buyer?.user && buyer.authorized)} />}
          </section>
        </div>
        {product.digitalAsset?.previewUrl && <div className="product-model-preview"><p className="account-kicker">PRÉVIA INTERATIVA · ARQUIVO GLB</p><ModelViewer buyerId={null} today={new Date().toISOString().slice(0, 10)} previewUrl={product.digitalAsset.previewUrl} readOnly /></div>}
        {!product.demo && <section className="product-reviews" aria-label="Avaliações verificadas">
          <p className="eyebrow">COMPRAS VERIFICADAS</p><h2>Avaliações de {product.name}</h2>
          {productReviews?.error || storeReviews?.error ? <p className="quote-small-note">As avaliações serão exibidas após a configuração do módulo no banco.</p> : <>
            <div className="product-review-group"><h3>Este produto</h3>{productReviews?.data?.length ? productReviews.data.map((review) => <article className="product-review-card" key={review.id}><p className="product-review-stars" aria-label={`${review.rating} de 5 estrelas`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>{review.body && <p>{review.body}</p>}<small>Comprador verificado · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(review.created_at))}</small></article>) : <p className="quote-small-note">Este produto ainda não tem avaliações publicadas.</p>}</div>
            <div className="product-review-group"><h3>Loja {product.maker}</h3>{storeReviews?.data?.length ? storeReviews.data.map((review) => <article className="product-review-card" key={review.id}><p className="product-review-stars" aria-label={`${review.rating} de 5 estrelas`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>{review.body && <p>{review.body}</p>}<small>Comprador verificado · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(review.created_at))}</small></article>) : <p className="quote-small-note">Esta loja ainda não tem avaliações publicadas.</p>}</div>
          </>}
        </section>}
        {profileResult && <ProductPrintProfiles error={Boolean(profileResult.error)} profiles={(profileResult.data ?? []).map((profile) => ({
          id: profile.id, name: profile.profile_name, type: profile.profile_type,
          scope: profile.sharing_scope as "community" | "official", printer: profile.printer_snapshot,
          material: profile.material_snapshot, nozzle: profile.nozzle_snapshot, layerHeight: profile.layer_height_mm,
          infill: profile.infill_percent, walls: profile.wall_count, supports: profile.supports,
          orientation: profile.orientation, scale: profile.scale_percent, quantity: profile.quantity,
          hours: profile.print_hours, grams: profile.material_grams, colors: readPrintProfileColors(profile.material_by_color),
        }))} />}
      </main>
      <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Sua ideia vira realidade.</p><span>© 2026 ViraPeça 3D</span></div></footer>
    </>
  );
}
