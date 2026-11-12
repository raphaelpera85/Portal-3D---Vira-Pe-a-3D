import Link from "next/link";
import type { ShowcaseModel } from "@/lib/model-showcase";
import { CatalogImageSearch } from "@/components/catalog-image-search";

const categories = [
  { name: "Suporte para Óculos", slug: "suporte-para-oculos" },
  { name: "Chaveiros", slug: "chaveiros" },
  { name: "Infantil", slug: "infantil" },
];

function galleryUrl(query: string, category: string, page = 1) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("categoria", category);
  if (page > 1) params.set("pagina", String(page));
  return `/modelos${params.size ? `?${params.toString()}` : ""}#modelos`;
}

function ModelCards({ models }: { models: ShowcaseModel[] }) {
  return <div className="model-gallery-grid" aria-live="polite">
    {models.map((model) => <article className="model-gallery-card" key={model.id}>
      <div className="model-gallery-image"><img src={model.image} alt={`Prévia do modelo 3D ${model.name}`} width="480" height="360" loading="lazy" /></div>
      <div className="model-gallery-copy"><div className="product-meta"><span>{model.category}</span><span aria-hidden="true">3MF</span></div><h3>{model.name}</h3>
        <ul className="product-tags" aria-label={`Tags de ${model.name}`}>{model.tags.map((tag) => <li key={tag}><Link href={galleryUrl(tag, model.categorySlug)}>{tag}</Link></li>)}</ul>
      </div>
    </article>)}
    {models.length === 0 && <p className="empty-state">Nenhum modelo encontrado. Tente outra busca ou categoria.</p>}
  </div>;
}

export function FeaturedModelShowcase({ models }: { models: ShowcaseModel[] }) {
  return <section className="model-showcase shell" aria-labelledby="featured-models-title">
    <div className="section-heading"><div><p className="eyebrow">PRÉVIAS DA COLEÇÃO</p><h2 id="featured-models-title">Modelos 3D para <em>explorar.</em></h2></div><Link className="button button-secondary" href="/modelos">Ver a coleção completa →</Link></div>
    <ModelCards models={models} />
  </section>;
}

export function ModelShowcase({ models, query, category, page, pages }: { models: ShowcaseModel[]; query: string; category: string; page: number; pages: number }) {
  return <section className="model-showcase shell" id="modelos">
    <div className="account-heading"><p className="eyebrow">ARQUIVOS 3D · COLEÇÃO RAPHAEL</p><h1>Modelos para <em>inspirar.</em></h1><p>Prévia visual dos arquivos 3MF, com categorias e tags para facilitar a descoberta.</p></div>
    <div className="model-gallery-controls">
      <nav className="category-list" aria-label="Filtrar modelos por categoria">
        <Link className={`category-chip${!category ? " is-active" : ""}`} aria-current={!category ? "page" : undefined} href={galleryUrl(query, "")}>Todos</Link>
        {categories.map((item) => <Link className={`category-chip${category === item.slug ? " is-active" : ""}`} aria-current={category === item.slug ? "page" : undefined} href={galleryUrl(query, item.slug)} key={item.slug}>{item.name}</Link>)}
      </nav>
      <form className="search-field" action="/modelos" method="get"><label className="sr-only" htmlFor="model-gallery-search">Buscar modelos por nome ou tag</label><input id="model-gallery-search" type="search" name="q" maxLength={100} defaultValue={query} placeholder="Nome, animal, tema ou tag" />{category && <input type="hidden" name="categoria" value={category} />}<button type="submit">Buscar</button></form>
      <CatalogImageSearch configured={Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY)} category={category} redirectPath="/modelos" />
    </div>
    <p className="catalog-disclaimer">Galeria de prévias; os arquivos originais ainda não estão associados a uma loja aprovada para venda.</p>
    <ModelCards models={models} />
    {pages > 1 && <nav className="catalog-pagination" aria-label="Paginação dos modelos">{page > 1 ? <Link className="button button-secondary" href={galleryUrl(query, category, page - 1)}>← Página anterior</Link> : <span />}<span>Página {page} de {pages}</span>{page < pages ? <Link className="button button-secondary" href={galleryUrl(query, category, page + 1)}>Próxima página →</Link> : <span />}</nav>}
  </section>;
}
