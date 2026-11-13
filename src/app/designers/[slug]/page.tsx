import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { DesignerServiceRequestForm } from "@/components/designer-service-request-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBrazilianCalendarDate } from "@/lib/maintenance-reminders";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

async function getProfile(slug: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("designer_profiles").select("slug, display_name, biography, portfolio_url, city, state_code, specialties")
    .eq("slug", slug).eq("status", "published").maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfile(slug);
  return profile ? {
    title: `${profile.display_name} | Designers ViraPeça 3D`,
    description: profile.biography.slice(0, 160),
    alternates: { canonical: `/designers/${encodeURIComponent(profile.slug)}` },
    openGraph: { title: `${profile.display_name} | Designers ViraPeça 3D`, description: profile.biography.slice(0, 160), type: "profile", images: ["/opengraph-image"] },
  } : { title: "Designer | ViraPeça 3D" };
}

export default async function DesignerProfilePage({ params }: Props) {
  const { slug } = await params;
  const profile = await getProfile(slug);
  if (!profile) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: auth } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const { data: buyerRole } = auth.user && supabase ? await supabase.from("user_roles").select("role")
    .eq("user_id", auth.user.id).eq("role", "buyer").maybeSingle() : { data: null };
  return <><SiteHeader /><main className="account-page shell designer-profile-page"><Link className="viewer-back-link" href="/designers">← Ver designers</Link>
    <article className="designer-profile-card"><span className="account-kicker">DESIGNER 3D{profile.city ? ` · ${profile.city}${profile.state_code ? `/${profile.state_code}` : ""}` : ""}</span><h1>{profile.display_name}</h1><p className="designer-biography">{profile.biography}</p>
      <h2>Especialidades</h2><ul>{profile.specialties.map((specialty: string) => <li key={specialty}>{specialty}</li>)}</ul>
      {profile.portfolio_url && <a className="button button-primary" href={profile.portfolio_url} target="_blank" rel="noopener noreferrer">Abrir portfólio ↗</a>}
    </article>
    <section id="solicitar-modelagem" className="designer-service-section" aria-label="Solicitar serviço de modelagem">
      {buyerRole ? <DesignerServiceRequestForm slug={profile.slug} today={getBrazilianCalendarDate()} /> : <div className="account-card designer-service-request">
        <span className="account-kicker">SERVIÇO DE MODELAGEM</span><h2>Conte sua ideia ao designer</h2>
        <p>Entre na sua conta para enviar um briefing privado e acompanhar a resposta.</p>
        <Link className="button button-primary" href="/conta">Entrar ou criar conta</Link>
      </div>}
    </section>
  </main></>;
}
