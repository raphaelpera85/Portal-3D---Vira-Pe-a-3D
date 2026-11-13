import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { DesignerProfileForm } from "@/components/designer-profile-form";
import { DesignerServiceRequestInbox } from "@/components/designer-service-request-inbox";
import { getUserWithRole } from "@/lib/auth-role.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel do designer | ViraPeça 3D", robots: { index: false, follow: false } };

export default async function DesignerDashboard() {
  const actor = await getUserWithRole("designer");
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { data: profile, error } = await actor.supabase.from("designer_profiles")
    .select("id, slug, display_name, biography, portfolio_url, city, state_code, specialties, status, response_note")
    .eq("user_id", actor.user!.id).maybeSingle();
  const requestsResult = profile ? await actor.supabase.from("designer_service_requests")
    .select("id, title, brief, due_date, reference_url, created_at")
    .eq("designer_profile_id", profile.id).eq("status", "pending").order("created_at", { ascending: true }).limit(100) : null;

  return <><SiteHeader /><main className="account-page shell"><Link className="viewer-back-link" href="/conta">← Voltar à conta</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">ESPAÇO DO CRIADOR</p><h1>Seu perfil, <em>seu trabalho.</em></h1><p>Atualize as informações que aparecem no diretório público de designers.</p></div>
    <p className="maker-finance-link"><Link className="button button-secondary" href="/suporte">Central de atendimento →</Link></p>
    {error ? <section className="account-card"><h2>Perfil indisponível</h2><p>A migração do cadastro de designers ainda não foi aplicada.</p></section> : profile ? <><DesignerProfileForm profile={profile} /><DesignerServiceRequestInbox requests={requestsResult?.data ?? []} error={Boolean(requestsResult?.error)} /></> : <section className="account-card"><h2>Nenhum perfil encontrado</h2><p><Link href="/conta">Envie seus dados pela página da conta.</Link></p></section>}
  </main></>;
}
