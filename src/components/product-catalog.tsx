import Link from "next/link";
import { Search } from "lucide-react";
import type { Product } from "@/lib/products";
import type { MarketplaceCategory } from "@/lib/marketplace.server";
import { ProductIllustration } from "@/components/product-illustration";
import { FavoriteButton } from "@/components/favorite-button";

type Props = {
  products: Product[];
  categories: MarketplaceCategory[];
  source: "local" | "database";
  notice: string | null;
  query: string;
  category: string;
  page: number;
  pages: number;
  canFavorite?: boolean;
  favoriteProductIds?: string[];
};

function catalogUrl({ query, category, page }: { query: string; category: string; page?: number }) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("categoria", category);
  if (page && page > 1) params.set("pagina", String(page));
  return `/${params.size ? `?${params.toString()}` : ""}#produtos`;
}

export function ProductCatalog({ products, categories, source, notice, query, category, page, pages, canFavorite = false, favoriteProductIds = [] }: Props) {
  const activeCategory = categories.find((item) => item.slug === category)?.slug ?? "";
  return (
    <section className="catalog-section shell" id="produtos">
      <div className="section-heading catalog-heading">
        <div><p className="eyebrow">PEÇAS COM HISTÓRIA</p><h2>Comece por <em>uma ideia.</em></h2></div>
        <p>Encontre peças, arquivos e serviços feitos por quem transforma ideias em objetos.</p>
      </div>
      {notice && <p className="catalog-disclaimer" role="status">{notice}</p>}
      <div className="catalog-controls">
        <div className="category-list" aria-label="Filtrar por categoria">
          <Link className={`category-chip${!activeCategory ? " is-active" : ""}`} aria-current={!activeCategory ? "page" : undefined} href={catalogUrl({ query, category: "" })}>Todos</Link>
          {categories.map((item) => <Link key={item.slug} className={`category-chip${activeCategory === item.slug ? " is-active" : ""}`} aria-current={activeCategory === item.slug ? "page" : undefined} href={catalogUrl({ query, category: item.slug })}>{item.name}</Link>)}
        </div>
        <form className="search-field" action="/" method="get">
          <Search size={17} aria-hidden="true" /><label className="sr-only" htmlFor="product-search">Buscar produtos</label>
          <input id="product-search" type="search" name="q" maxLength={100} defaultValue={query} placeholder="O que você imaginou?" />
          {activeCategory && <input type="hidden" name="categoria" value={activeCategory} />}
          <button type="submit" aria-label="Buscar">Buscar</button>
        </form>
      </div>
      <div className="product-grid" aria-live="polite">
        {products.map((product, index) => (
          <article className="product-card" key={product.id}>
            <div className={`product-card-art-wrap${canFavorite && !product.demo ? " has-favorite" : ""}`}><Link className={`product-art art-${product.color}`} href={`/produtos/${product.slug}`} aria-label={`Ver ${product.name}`}>
              <span className="product-index">{String((page - 1) * 24 + index + 1).padStart(2, "0")}</span><span className="made-badge">{product.demo ? "exemplo" : "feito em 3D"}</span>
              {product.media[0] ? <img src={product.media[0]} alt={product.name} width="480" height="380" loading="lazy" /> : product.visual ? <ProductIllustration product={product} /> : <span className="product-placeholder" aria-hidden="true">3D</span>}
            </Link>{canFavorite && !product.demo && <FavoriteButton productId={product.id} slug={product.slug} initialFavorite={favoriteProductIds.includes(product.id)} />}</div>
            <div className="product-meta"><span>{product.category}</span><span aria-hidden="true">↗</span></div>
            <h3><Link href={`/produtos/${product.slug}`}>{product.name}</Link></h3>
            <p className="product-maker">{product.storeSlug ? <Link href={`/lojas/${product.storeSlug}`}>{product.maker}</Link> : product.maker}</p>
            <p className="product-price">{product.priceLabel}</p>
          </article>
        ))}
        {products.length === 0 && <p className="empty-state">{notice ? "O catálogo não pôde ser carregado agora." : "Nenhum produto encontrado. Tente outra busca ou categoria."}</p>}
      </div>
      {pages > 1 && <nav className="catalog-pagination" aria-label="Paginação de produtos">
        {page > 1 ? <Link className="button button-secondary" href={catalogUrl({ query, category, page: page - 1 })}>← Página anterior</Link> : <span />}
        <span>Página {page} de {pages}</span>
        {page < pages ? <Link className="button button-secondary" href={catalogUrl({ query, category, page: page + 1 })}>Próxima página →</Link> : <span />}
      </nav>}
      <p className="catalog-disclaimer">{source === "local" ? "Vitrine demonstrativa; produtos e fabricantes são exemplos locais." : "Produtos publicados por lojas aprovadas. Valores e disponibilidade podem mudar; confirme antes de contratar."}</p>
    </section>
  );
}
