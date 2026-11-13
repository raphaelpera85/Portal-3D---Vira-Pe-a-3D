import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PasswordResetRequestForm } from "@/components/password-recovery-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Recuperar senha | ViraPeça 3D",
  robots: { index: false, follow: false },
};

export default function RecoverPasswordPage() {
  return <><SiteHeader /><main className="account-page shell">
    <Link className="viewer-back-link" href="/conta">← Voltar para sua conta</Link>
    <div className="account-heading"><p className="eyebrow">VIRAPEÇA 3D · ACESSO</p><h1>Vamos recuperar<br /><em>sua conta.</em></h1><p>Enviaremos um link seguro para o e-mail cadastrado.</p></div>
    <PasswordResetRequestForm />
  </main></>;
}
