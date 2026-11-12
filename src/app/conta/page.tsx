import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Heart } from "lucide-react";
import { AuthForms } from "@/components/auth-forms";
import { MakerApplicationForm } from "@/components/maker-application-form";
import { DesignerProfileForm } from "@/components/designer-profile-form";
import { BuyerAddressManager } from "@/components/buyer-address-manager";
import { signOutAction } from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sua conta | ViraPeça 3D",
  description: "Entre ou crie sua conta ViraPeça 3D.",
  robots: { index: false, follow: false },
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ confirmacao?: string; endereco?: string }> }) {
  const [{ confirmacao, endereco }, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const user = data.user;
  const displayName = typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null;
  const [rolesResult, applicationResult, designerResult] = user && supabase ? await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("maker_applications").select("status, response_note, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("designer_profiles").select("slug, display_name, biography, portfolio_url, city, state_code, specialties, status, response_note").eq("user_id", user.id).maybeSingle(),
  ]) : [null, null, null];
  const roles = rolesResult?.data ?? [];
  const isMaker = roles.some((item) => item.role === "maker");
  const isBuyer = roles.some((item) => item.role === "buyer");
  const isDesigner = roles.some((item) => item.role === "designer");
  const isAdmin = roles.some((item) => item.role === "admin");
  const application = applicationResult?.data ?? null;
  const addressesResult = isBuyer && supabase ? await supabase.from("buyer_addresses")
    .select("id, label, recipient_name, postal_code, street, number, complement, district, city, state_code, reference, is_default")
    .order("is_default", { ascending: false }).order("created_at", { ascending: false }) : null;

  return (
    <>
      <SiteHeader />
      <main className="account-page shell">
        <Link className="viewer-back-link" href="/">← Voltar para o início</Link>
        <div className="account-heading"><p className="eyebrow">VIRAPEÇA 3D · SUA CONTA</p><h1>{user ? `Olá, ${displayName ?? "criador(a)"}.` : <>Sua próxima ideia<br /><em>começa por aqui.</em></>}</h1><p>Salve suas escolhas e prepare seu espaço para comprar, fabricar e criar.</p></div>
        {confirmacao === "erro" && <p className="auth-notice is-error" role="alert">Não foi possível confirmar o e-mail. Solicite um novo link de confirmação.</p>}
        {!user ? <AuthForms /> : (
          <>
            <section className="account-card" aria-label="Conta conectada">
              <span className="account-kicker">CONTA CONECTADA</span><h2>{displayName ?? "Bem-vindo(a)"}</h2><p>{user.email}</p>
              <p className="account-next-step">O cadastro está ativo. {isMaker ? "Sua conta maker está aprovada e já pode administrar a loja." : "Use as ferramentas e acompanhe suas solicitações nesta conta."}</p>
              <div className="account-links">
                {isBuyer && <><Link className="button button-secondary" href="/orcamentos">Meus pedidos</Link><Link className="button button-secondary" href="/favoritos"><Heart size={15} aria-hidden="true" /> Favoritos</Link></>}
                {isMaker && <Link className="button button-primary" href="/painel/maker">Abrir painel da loja</Link>}
                {isDesigner && <Link className="button button-primary" href="/painel/designer">Gerenciar perfil de designer</Link>}
                {isAdmin && <Link className="button button-secondary" href="/admin/fabricantes">Revisar marketplace</Link>}
                {isAdmin && <Link className="button button-secondary" href="/admin/designers">Revisar designers</Link>}
                {isAdmin && <Link className="button button-secondary" href="/admin/denuncias-digitais">Denúncias digitais</Link>}
                <Link className="button button-secondary" href="/suporte">Central de atendimento</Link>
              </div>
              <form action={signOutAction}><button className="button button-secondary" type="submit">Sair da conta</button></form>
            </section>
            {isBuyer && addressesResult && <BuyerAddressManager addresses={addressesResult.data ?? []} error={Boolean(addressesResult.error)} result={endereco} />}
            {!isMaker && (rolesResult?.error || applicationResult?.error) ? (
              <section className="account-card"><span className="account-kicker">ÁREA DE FABRICANTES</span><h2>Preparando o cadastro de lojas</h2><p>A migração do fluxo de fabricantes ainda não foi aplicada neste backend.</p></section>
            ) : !isMaker && application?.status === "pending" ? (
              <section className="account-card"><span className="account-kicker">SOLICITAÇÃO EM ANÁLISE</span><h2>Recebemos seu pedido</h2><p>A equipe está analisando os dados da sua oficina. Você poderá acompanhar o resultado nesta página.</p></section>
            ) : !isMaker ? (
              <>
                {application?.status === "rejected" && <p className="auth-notice is-error" role="status">A solicitação anterior não foi aprovada. {application.response_note ?? "Você pode enviar uma nova solicitação com mais informações."}</p>}
                <MakerApplicationForm />
              </>
            ) : null}
            {isBuyer && (designerResult?.error ? (
              <section className="account-card"><span className="account-kicker">PORTFÓLIO CRIATIVO</span><h2>Cadastro de designers indisponível</h2><p>A estrutura ainda não foi aplicada ao banco do portal.</p></section>
            ) : <DesignerProfileForm profile={designerResult?.data ?? null} />)}
          </>
        )}
      </main>
      <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Seus dados ficam protegidos pelo serviço de autenticação da plataforma.</p><span>© 2026 ViraPeça 3D</span></div></footer>
    </>
  );
}
