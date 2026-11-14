import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getPaginationRedirectPage } from "@/lib/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Designers 3D | ViraPeça 3D", description: "Conheça designers e modeladores 3D da comunidade ViraPeça." };

const pageSize = 24;

export default async function DesignersDirectory({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const [{ pagina }, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  const requestedPage = typeof pagina === "string" && /^\d+$/.test(pagina) ? Number(pagina) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const { data, count, error } = supabase ? await supabase.from("designer_profiles")
    .select("slug, display_name, biography, city, state_code, specialties", { count: "exact" }).eq("status", "published").order("updated_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1) : { data: [], count: 0, error: null };
  const pages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const redirectPage = getPaginationRedirectPage(page, pages);
  if (supabase && !error && redirectPage !== null) redirect(`/designers?pagina=${redirectPage}`);
  return <><SiteHeader /><main id="main-content" tabIndex={-1} className="account-page shell designer-directory"><div className="account-heading"><p className="eyebrow">GENTE QUE DESENHA EM 3D</p><h1>Ideias começam <em>no traço.</em></h1><p>Encontre profissionais independentes de modelagem e criação digital.</p></div>
    {error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar o diretório agora.</p> : data?.length ? <div className="designer-card-grid">{data.map((designer) => <article className="designer-card" key={designer.slug}><span className="account-kicker">{designer.city ? `${designer.city}${designer.state_code ? ` · ${designer.state_code}` : ""}` : "DESIGNER 3D"}</span><h2><Link href={`/designers/${designer.slug}`}>{designer.display_name}</Link></h2><p>{designer.biography}</p><ul aria-label="Especialidades">{designer.specialties.map((specialty: string) => <li key={specialty}>{specialty}</li>)}</ul><Link className="button button-secondary" href={`/designers/${designer.slug}`}>Conhecer perfil</Link></article>)}</div> : <section className="account-card designer-empty"><span className="account-kicker">EM BREVE</span><h2>Os primeiros portfólios estão chegando</h2><p>Você modela em 3D? <Link href="/conta">Apresente seu trabalho</Link> para entrar no diretório.</p></section>}
    {pages > 1 && <nav className="catalog-pagination" aria-label="Paginação de designers">{page > 1 ? <Link className="button button-secondary" href={`/designers?pagina=${page - 1}`}>← Página anterior</Link> : <span />}<span>Página {page} de {pages}</span>{page < pages ? <Link className="button button-secondary" href={`/designers?pagina=${page + 1}`}>Próxima página →</Link> : <span />}</nav>}
  </main></>;
}
