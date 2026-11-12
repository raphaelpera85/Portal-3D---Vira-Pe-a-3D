import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { getIntegrationHealth } from "@/lib/integration-health";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Integrações | Painel administrativo", robots: { index: false, follow: false } };

export default async function AdminIntegrationsPage() {
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const integrations = getIntegrationHealth(process.env);
  const configured = integrations.filter((item) => item.status === "configured").length;

  return <><SiteHeader /><main className="admin-dashboard shell">
    <Link className="viewer-back-link" href="/admin">← Voltar ao painel administrativo</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">OPERAÇÃO DA PLATAFORMA</p><h1>Integrações</h1><p>{configured} de {integrations.length} grupos de configuração detectados no ambiente que está servindo esta página.</p></div>
    <p className="auth-notice">Esta tela confirma apenas a presença e o formato básico das variáveis. Ela não mostra valores secretos nem testa autenticação com os provedores.</p>
    <section className="integration-health-grid" aria-label="Status das integrações">
      {integrations.map((item) => <article className="account-card integration-health-card" key={item.id}>
        <div className="integration-health-heading"><h2>{item.title}</h2><span className={`quote-status status-${item.status === "configured" ? "paid" : "pending"}`}>{item.status === "configured" ? "Configurado" : "Pendente"}</span></div>
        <p>{item.description}</p>
        {item.missingVariables.length > 0
          ? <div><strong>Variáveis ausentes ou inválidas</strong><ul>{item.missingVariables.map((name) => <li key={name}><code>{name}</code></li>)}</ul></div>
          : <p className="auth-notice is-success">As variáveis necessárias foram detectadas.</p>}
        <a href={item.setupHref} target="_blank" rel="noreferrer">Abrir instruções de configuração ↗</a>
      </article>)}
    </section>
    <p className="integration-health-footnote">Depois de alterar variáveis na Vercel, gere um novo deployment. Configurações disponíveis em Preview podem ser diferentes das de Production.</p>
  </main></>;
}
