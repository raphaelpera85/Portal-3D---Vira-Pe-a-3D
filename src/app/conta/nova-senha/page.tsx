import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PasswordUpdateForm } from "@/components/password-recovery-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Criar nova senha | ViraPeça 3D",
  robots: { index: false, follow: false },
};

export default async function NewPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  return <><SiteHeader /><main className="account-page shell">
    <Link className="viewer-back-link" href="/conta">← Voltar para sua conta</Link>
    <div className="account-heading"><p className="eyebrow">VIRAPEÇA 3D · ACESSO</p><h1>Um novo começo<br /><em>para sua senha.</em></h1></div>
    {user ? <PasswordUpdateForm /> : <section className="account-card password-recovery-card">
      <span className="account-kicker">LINK INDISPONÍVEL</span><h2>Solicite um novo link</h2>
      <p>Este link expirou, já foi usado ou não é válido. Solicite outra recuperação para continuar.</p>
      <Link className="button button-primary" href="/conta/recuperar-senha">Solicitar novo link</Link>
    </section>}
  </main></>;
}
