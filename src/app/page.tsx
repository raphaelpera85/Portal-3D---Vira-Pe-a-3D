import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ProductCatalog } from "@/components/product-catalog";
import { loadMarketplaceCatalog } from "@/lib/marketplace.server";
import { getSiteUrl } from "@/lib/site-url";
import { getUserWithRole } from "@/lib/auth-role.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { ...(getSiteUrl() ? { alternates: { canonical: "/" }, openGraph: { url: "/" } } : {}) };

function PrinterIllustration() {
  return (
    <svg className="printer-illustration" viewBox="0 0 620 470" role="img" aria-labelledby="printer-title">
      <title id="printer-title">Uma impressora 3D fabricando uma peça verde</title>
      <defs>
        <linearGradient id="plate" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--blue-light)" />
          <stop offset="1" stopColor="var(--blue-wash)" />
        </linearGradient>
        <linearGradient id="part" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--green)" />
          <stop offset="1" stopColor="var(--green-deep)" />
        </linearGradient>
      </defs>
      <ellipse cx="320" cy="408" rx="210" ry="24" fill="var(--shadow-wash)" />
      <path d="M156 69h308v290H156z" fill="var(--panel)" stroke="var(--line-strong)" strokeWidth="7" />
      <path d="M185 98h250v212H185z" fill="var(--window)" stroke="var(--line)" strokeWidth="3" />
      <path d="M143 359h334l43 32H102z" fill="var(--blue)" />
      <path d="M176 345h273l30 20H148z" fill="url(#plate)" />
      <path d="M256 306l66-33 67 35-67 38z" fill="var(--blue-light)" />
      <path d="M256 306v34l66 38v-32z" fill="var(--blue)" />
      <path d="M322 346v32l67-38v-32z" fill="var(--blue-deep)" />
      <path d="M276 300v-48l45-27 46 26v48l-45 27z" fill="url(#part)" />
      <path d="M321 225l46 26-46 27-45-26z" fill="var(--green-light)" />
      <path d="M276 252v48l45 27v-49z" fill="var(--green)" />
      <path d="M321 278v49l46-27v-48z" fill="var(--green-deep)" />
      <path d="M299 133h88v26h-88z" fill="var(--blue)" />
      <path d="M333 159v43" stroke="var(--blue-deep)" strokeWidth="8" strokeLinecap="round" />
      <path d="M321 202h24l-12 20z" fill="var(--ink)" />
      <circle cx="190" cy="87" r="6" fill="var(--green)" />
      <path d="M204 87h58" stroke="var(--line-strong)" strokeWidth="4" strokeLinecap="round" />
      <path d="M194 372h194" stroke="var(--blue-light)" strokeWidth="2" strokeDasharray="7 9" />
      <g className="dimension-label">
        <rect x="420" y="126" width="118" height="52" rx="14" fill="var(--surface)" stroke="var(--line)" />
        <text x="437" y="148" fill="var(--muted)" fontSize="11" fontFamily="Arial">PEÇA EM</text>
        <text x="437" y="166" fill="var(--ink)" fontSize="14" fontWeight="700" fontFamily="Arial">IMPRESSÃO</text>
      </g>
      <g>
        <rect x="67" y="191" width="128" height="62" rx="14" fill="var(--surface)" stroke="var(--line)" />
        <circle cx="88" cy="213" r="5" fill="var(--green)" />
        <text x="103" y="218" fill="var(--ink)" fontSize="13" fontWeight="700" fontFamily="Arial">PLA • VERDE</text>
        <text x="86" y="237" fill="var(--muted)" fontSize="11" fontFamily="Arial">material selecionado</text>
      </g>
    </svg>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string; pagina?: string }> }) {
  const params = await searchParams;
  const [catalog, buyer] = await Promise.all([loadMarketplaceCatalog({
    query: typeof params.q === "string" ? params.q : "",
    category: typeof params.categoria === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.categoria) ? params.categoria : "",
    page: typeof params.pagina === "string" && /^\d+$/.test(params.pagina) ? Number(params.pagina) : 1,
  }), getUserWithRole("buyer")]);
  const [favoritesResult, bannersResult] = await Promise.all([
    buyer.supabase && buyer.user && buyer.authorized
      ? buyer.supabase.from("buyer_product_favorites").select("product_id").eq("buyer_id", buyer.user.id)
      : Promise.resolve(null),
    buyer.supabase
      ? buyer.supabase.from("homepage_banners").select("id, eyebrow, title, description, image_url, image_alt, action_label, action_href").eq("is_active", true).order("sort_order").order("created_at", { ascending: false }).limit(6)
      : Promise.resolve(null),
  ]);
  const favoriteProductIds = favoritesResult?.data?.map((favorite) => favorite.product_id) ?? [];
  const banners = bannersResult?.data ?? [];
  const featuredStores = [...new Map(catalog.products.flatMap((product) => product.storeSlug
    ? [[product.storeSlug, { slug: product.storeSlug, name: product.maker }] as const] : []).map(([slug, store]) => [slug, store])).values()].slice(0, 4);
  return (
    <>
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "ViraPeça 3D",
        alternateName: "ViraPeça",
        url: getSiteUrl()?.toString(),
        inLanguage: "pt-BR",
      }).replace(/</g, "\\u003c") }} />
      <main>
        <section className="hero shell">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> FEITO PERTO. FEITO DO SEU JEITO.</p>
            <h1>Sua ideia<br /><em>vira realidade.</em></h1>
            <p className="hero-description">
              Peças autorais, impressão sob encomenda e gente que sabe transformar um bom arquivo em algo que você pode tocar.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#produtos">Explorar produtos <span aria-hidden="true">↗</span></a>
              <a className="button button-secondary" href="/visualizador">Visualizar meu modelo 3D <span aria-hidden="true">→</span></a>
              <a className="button button-secondary" href="/calculadora">Calcular custos de impressão <span aria-hidden="true">→</span></a>
            </div>
            <div className="hero-note"><span className="note-rule" /> Explore arquivos STL, OBJ, 3MF e glTF diretamente no navegador.</div>
          </div>
          <div className="hero-art" aria-label="Ilustração de uma impressora 3D em funcionamento">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-stamp"><span>IDEIA</span><b>→</b><span>PEÇA</span></div>
            <PrinterIllustration />
            <div className="art-caption"><span className="caption-line" /> A próxima peça pode começar aqui.</div>
          </div>
        </section>

        {banners.length > 0 && <section className="homepage-banners shell" aria-label="Destaques da ViraPeça 3D">
          {banners.map((banner) => <article className={`homepage-banner${banner.image_url ? " has-image" : ""}`} key={banner.id}>
            {/* shortcut: external HTTPS media is lazy-loaded as supplied; use managed storage when image uploads are added. */}
            {banner.image_url && <img src={banner.image_url} alt={banner.image_alt ?? ""} loading="lazy" />}
            <div className="homepage-banner-copy">{banner.eyebrow && <p className="eyebrow">{banner.eyebrow}</p>}<h2>{banner.title}</h2><p>{banner.description}</p><Link className="button button-primary" href={banner.action_href}>{banner.action_label} <span aria-hidden="true">↗</span></Link></div>
          </article>)}
        </section>}

        <section className="trust-strip">
          <div className="shell trust-inner">
            <span>UM LUGAR PARA</span>
            <b>CRIADORES</b><i />
            <b>FABRICANTES</b><i />
            <b>IDEIAS IMPROVÁVEIS</b>
            <span className="trust-tail">se encontrarem</span>
          </div>
        </section>

        <ProductCatalog products={catalog.products} categories={catalog.categories} source={catalog.source} notice={catalog.error ?? (catalog.source === "local" ? "O catálogo conectado ainda não está configurado; veja produtos de demonstração." : null)} query={catalog.query} category={catalog.category} page={catalog.page} pages={catalog.pages} canFavorite={Boolean(buyer.user && buyer.authorized)} favoriteProductIds={favoriteProductIds} />

        {featuredStores.length > 0 && <section className="featured-stores shell"><div className="section-heading"><div><p className="eyebrow">QUEM FAZ ACONTECER</p><h2>Lojas com novidades</h2></div><Link className="button button-secondary" href="/lojas">Ver todas as lojas</Link></div><div className="featured-store-list">{featuredStores.map((store) => <Link className="featured-store-card" href={`/lojas/${store.slug}`} key={store.slug}><span className="account-kicker">FABRICANTE APROVADO</span><strong>{store.name}</strong><span>Conheça a vitrine →</span></Link>)}</div></section>}

        <section className="maker-section" id="fabricantes">
          <div className="shell maker-grid">
            <div className="maker-mark" aria-hidden="true">
              <div className="mark-cube"><span /><span /><span /></div>
              <div className="mark-label">SUA OFICINA<br />NO MAPA</div>
            </div>
            <div className="maker-copy">
              <p className="eyebrow">PARA QUEM FAZ</p>
              <h2>Seu talento merece<br /><em>mais espaço.</em></h2>
              <p>Cada loja e anúncio passa por aprovação antes de aparecer no marketplace.</p>
              <span className="status-note">A equipe revisa os cadastros para manter a vitrine confiável.</span>
            </div>
            <div className="maker-aside">
              <span className="aside-index">01 / 03</span>
              <p>Uma vitrine própria, com ferramentas para sua produção crescendo junto com você.</p>
              <div className="aside-lines"><i /><i /><i /></div>
            </div>
          </div>
        </section>

        <section className="how-section shell" id="como-funciona">
          <div className="section-heading how-heading">
            <div><p className="eyebrow">DO ARQUIVO À PEÇA</p><h2>Fazer acontecer<br /><em>é mais simples.</em></h2></div>
            <p>Explore referências e conheça os recursos que aproximam quem imagina de quem fabrica.</p>
          </div>
          <div className="steps-grid">
            <article className="step-card"><span className="step-number">01</span><div className="step-icon step-icon-blue">⌘</div><h3>Explore ou envie</h3><p>Abra STL, OBJ, 3MF ou glTF e explore geometria, cores e dimensões.</p><span className="step-arrow">↗</span></article>
            <article className="step-card"><span className="step-number">02</span><div className="step-icon step-icon-green">◈</div><h3>Encontre um maker</h3><p>Consulte produtos publicados por lojas aprovadas no marketplace.</p><span className="step-arrow">↗</span></article>
            <article className="step-card"><span className="step-number">03</span><div className="step-icon step-icon-sand">✳</div><h3>Acompanhe a peça</h3><p>Consulte propostas e pedidos na sua conta enquanto a loja atualiza a produção e o envio.</p><span className="step-arrow">↗</span></article>
          </div>
        </section>

        <section className="closing-section shell" id="conta">
          <div className="closing-panel">
            <div><p className="eyebrow">VIRAPEÇA 3D</p><h2>Tem uma ideia<br />dando voltas?</h2><p>Ela pode começar a tomar forma agora.</p></div>
            <a className="button button-light" href="#produtos">Explorar o catálogo <span aria-hidden="true">↗</span></a>
            <div className="closing-shape" aria-hidden="true"><span /><span /><span /></div>
          </div>
          <p className="phase-note">O visualizador processa arquivos no navegador. Para comprar, pedir uma impressão ou acompanhar pedidos, entre na sua conta. O pagamento é iniciado depois que a loja confirma o pedido e conecta sua conta Mercado Pago.</p>
        </section>
      </main>
      <footer className="site-footer">
        <div className="shell footer-inner"><a className="brand footer-brand" href="#top"><span className="brand-symbol"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></a><p>Sua ideia vira realidade.</p><span>© 2026 ViraPeça 3D</span></div>
      </footer>
    </>
  );
}
