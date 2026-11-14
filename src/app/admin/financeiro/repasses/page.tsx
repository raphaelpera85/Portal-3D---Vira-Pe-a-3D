import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminReleaseReconciliation } from "@/components/admin-release-reconciliation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conciliação de repasses | ViraPeça 3D", robots: { index: false, follow: false } };

export default async function AdminReleasesPage() {
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) redirect("/conta");

  return <><SiteHeader /><main id="main-content" tabIndex={-1} className="admin-dashboard shell">
    <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">FINANCEIRO DA PLATAFORMA</p><h1>Conciliação de repasses</h1><p>Compare os relatórios do Mercado Pago com pagamentos do portal.</p></div>
    <AdminReleaseReconciliation />
  </main></>;
}
