import Link from "next/link";
import Image from "next/image";
import { modelShowcaseCategories, type ShowcaseModel } from "@/lib/model-showcase";
import visualIndex from "@/lib/model-showcase-visual-index.json";
import { CatalogImageSearch } from "@/components/catalog-image-search";
import type { VisualImageCandidate } from "@/lib/visual-image-search";

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
      <Link className="model-gallery-image" href={`/modelos/${model.id}`} prefetch={false} aria-label={`Abrir ${model.name}, visualizar e baixar modelo 3D`}>{model.image.startsWith("https://") ? <img src={model.image} alt={`Prévia do modelo 3D ${model.name}`} width="480" height="360" loading="lazy" referrerPolicy="no-referrer" /> : <Image src={model.image} alt={`Prévia do modelo 3D ${model.name}`} width={480} height={360} sizes="(max-width: 390px) 100vw, (max-width: 640px) 50vw, (max-width: 900px) 33vw, 25vw" loading="lazy" />}</Link>
      <div className="model-gallery-copy"><Link className="model-gallery-summary" href={`/modelos/${model.id}`} prefetch={false}><div className="product-meta"><span>{model.category}</span><span aria-hidden="true">3MF</span></div><h3>{model.name}</h3></Link>{model.creatorName && <p className="model-gallery-creator">Criado por {model.creatorName}</p>}
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

export function ModelRecommendations({ models }: { models: ShowcaseModel[] }) {
  if (!models.length) return null;
  return <section className="model-showcase shell" aria-labelledby="related-models-title">
    <div className="section-heading"><div><p className="eyebrow">NA MESMA COLEÇÃO</p><h2 id="related-models-title">Mais modelos para <em>explorar.</em></h2></div><Link className="button button-secondary" href="/modelos">Ver todos →</Link></div>
    <ModelCards models={models} />
  </section>;
}

export function ModelShowcase({ models, query, category, page, pages, additionalVisualIndex = [] }: { models: ShowcaseModel[]; query: string; category: string; page: number; pages: number; additionalVisualIndex?: VisualImageCandidate[] }) {
  return <section className="model-showcase shell" id="modelos">
    <div className="account-heading"><p className="eyebrow">ARQUIVOS 3D · COMUNIDADE VIRAPEÇA</p><h1>Modelos para <em>inspirar.</em></h1><p>Prévia visual dos arquivos 3MF, com categorias, tags e criadores para facilitar a descoberta.</p></div>
    <p><Link className="button button-primary" href="/conta?destino=modelo-3d">Vende modelos 3D? Cadastre o seu</Link></p>
    <p className="model-ai-link"><Link className="button button-secondary" href="/gerar-modelo">Gerar rascunho 3D por imagem ↗</Link></p>
    <div className="model-gallery-controls">
      <nav className="category-list" aria-label="Filtrar modelos por categoria">
        <Link className={`category-chip${!category ? " is-active" : ""}`} aria-current={!category ? "page" : undefined} href={galleryUrl(query, "")}>Todos</Link>
        {modelShowcaseCategories.map((item) => <Link className={`category-chip${category === item.slug ? " is-active" : ""}`} aria-current={category === item.slug ? "page" : undefined} href={galleryUrl(query, item.slug)} key={item.slug}>{item.name}</Link>)}
      </nav>
      <form className="search-field" action="/modelos" method="get"><label className="sr-only" htmlFor="model-gallery-search">Buscar modelos por nome ou tag</label><input id="model-gallery-search" type="search" name="q" maxLength={100} defaultValue={query} placeholder="Nome, animal, tema ou tag" />{category && <input type="hidden" name="categoria" value={category} />}<button type="submit">Buscar</button></form>
      {query && <p className="makerworld-search-link">Não encontrou no catálogo? <a href={`https://makerworld.com/en/search/models?keyword=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer nofollow">Buscar “{query}” no MakerWorld ↗</a><small>O portal não baixa arquivos do MakerWorld. Baixe somente um modelo que você tenha permissão para usar; vendedores podem <Link href="/conta?destino=modelo-3d">entrar e enviá-lo ao portal para revisão.</Link></small></p>}
      <CatalogImageSearch configured={Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY)} category={category} redirectPath="/modelos" visualIndex={[...visualIndex, ...additionalVisualIndex]} />
    </div>
    <p className="catalog-disclaimer">Abra um modelo para girar a prévia 3D e baixar o arquivo 3MF original.</p>
    <ModelCards models={models} />
    {pages > 1 && <nav className="catalog-pagination" aria-label="Paginação dos modelos">{page > 1 ? <Link className="button button-secondary" href={galleryUrl(query, category, page - 1)}>← Página anterior</Link> : <span />}<span>Página {page} de {pages}</span>{page < pages ? <Link className="button button-secondary" href={galleryUrl(query, category, page + 1)}>Próxima página →</Link> : <span />}</nav>}
  </section>;
}
