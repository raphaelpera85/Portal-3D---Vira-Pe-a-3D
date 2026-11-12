import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lojas de impressão 3D | ViraPeça 3D", description: "Conheça fabricantes independentes e explore suas vitrines de impressão 3D." };
const pageSize = 24;

export default async function StoreDirectory({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const [{ pagina }, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  const requestedPage = typeof pagina === "string" && /^\d+$/.test(pagina) ? Number(pagina) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const { data, count, error } = supabase ? await supabase.from("stores")
    .select("slug, name, description, logo_url, city, state_code", { count: "exact" })
    .eq("status", "published").order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
    : { data: [], count: 0, error: null };
  const pages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  return <><SiteHeader /><main className="account-page shell store-directory"><div className="account-heading"><p className="eyebrow">OFICINAS INDEPENDENTES</p><h1>Lojas que dão forma<br /><em>às suas ideias.</em></h1><p>Conheça fabricantes aprovados e explore os produtos e serviços de cada oficina.</p></div>
    {error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar as lojas agora.</p> : data?.length ? <div className="store-directory-grid">{data.map((store) => <article className="store-directory-card" key={store.slug}>
      {store.logo_url ? <img src={store.logo_url} alt={`Logotipo de ${store.name}`} width="72" height="72" loading="lazy" /> : <span className="store-directory-monogram" aria-hidden="true">{store.name.slice(0, 1).toUpperCase()}</span>}
      <span className="account-kicker">{store.city ? `${store.city}${store.state_code ? ` · ${store.state_code}` : ""}` : "FABRICANTE APROVADO"}</span><h2><Link href={`/lojas/${store.slug}`}>{store.name}</Link></h2><p>{store.description || "Conheça os produtos e serviços desta loja."}</p><Link className="button button-secondary" href={`/lojas/${store.slug}`}>Visitar loja</Link>
    </article>)}</div> : <section className="account-card designer-empty"><span className="account-kicker">VITRINES EM PREPARAÇÃO</span><h2>As primeiras lojas estão chegando</h2><p>Quando os fabricantes forem aprovados, as vitrines públicas aparecerão aqui.</p></section>}
    {pages > 1 && <nav className="catalog-pagination" aria-label="Paginação de lojas">{page > 1 ? <Link className="button button-secondary" href={`/lojas?pagina=${page - 1}`}>← Página anterior</Link> : <span />}<span>Página {page} de {pages}</span>{page < pages ? <Link className="button button-secondary" href={`/lojas?pagina=${page + 1}`}>Próxima página →</Link> : <span />}</nav>}
  </main></>;
}
