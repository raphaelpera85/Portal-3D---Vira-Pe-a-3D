import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Designers 3D | ViraPeça 3D", description: "Conheça designers e modeladores 3D da comunidade ViraPeça." };

export default async function DesignersDirectory() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = supabase ? await supabase.from("designer_profiles")
    .select("slug, display_name, biography, city, state_code, specialties").eq("status", "published").order("updated_at", { ascending: false }).limit(60) : { data: [], error: null };
  return <><SiteHeader /><main className="account-page shell designer-directory"><div className="account-heading"><p className="eyebrow">GENTE QUE DESENHA EM 3D</p><h1>Ideias começam <em>no traço.</em></h1><p>Encontre profissionais independentes de modelagem e criação digital.</p></div>
    {error ? <p className="auth-notice is-error">Não foi possível carregar o diretório agora.</p> : data?.length ? <div className="designer-card-grid">{data.map((designer) => <article className="designer-card" key={designer.slug}><span className="account-kicker">{designer.city ? `${designer.city}${designer.state_code ? ` · ${designer.state_code}` : ""}` : "DESIGNER 3D"}</span><h2><Link href={`/designers/${designer.slug}`}>{designer.display_name}</Link></h2><p>{designer.biography}</p><ul aria-label="Especialidades">{designer.specialties.map((specialty: string) => <li key={specialty}>{specialty}</li>)}</ul><Link className="button button-secondary" href={`/designers/${designer.slug}`}>Conhecer perfil</Link></article>)}</div> : <section className="account-card designer-empty"><span className="account-kicker">EM BREVE</span><h2>Os primeiros portfólios estão chegando</h2><p>Você modela em 3D? <Link href="/conta">Apresente seu trabalho</Link> para entrar no diretório.</p></section>}
  </main></>;
}
