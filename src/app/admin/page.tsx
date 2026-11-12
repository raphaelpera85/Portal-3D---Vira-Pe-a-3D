import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel administrativo | ViraPeça 3D", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) redirect("/conta");

  const [applications, stores, products, printProfiles, designers, reports, reviews, printerSuggestions] = await Promise.all([
    actor.supabase.from("maker_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    actor.supabase.from("stores").select("id", { count: "exact", head: true }).eq("status", "pending"),
    actor.supabase.from("marketplace_products").select("id, store:stores!inner(status)", { count: "exact", head: true }).eq("catalog_status", "draft").eq("store.status", "published"),
    actor.supabase.from("maker_print_profiles").select("id", { count: "exact", head: true }).eq("sharing_scope", "community").eq("review_status", "pending"),
    actor.supabase.from("designer_profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    actor.supabase.from("digital_asset_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    actor.supabase.from("marketplace_reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
    actor.supabase.from("printer_model_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const queues = [
    { label: "Solicitações de fabricantes", href: "/admin/fabricantes", result: applications },
    { label: "Lojas aguardando publicação", href: "/admin/fabricantes", result: stores },
    { label: "Anúncios para revisar", href: "/admin/fabricantes", result: products },
    { label: "Perfis de impressão", href: "/admin/fabricantes", result: printProfiles },
    { label: "Perfis de designers", href: "/admin/designers", result: designers },
    { label: "Denúncias de conteúdo", href: "/admin/denuncias-digitais", result: reports },
    { label: "Avaliações para moderar", href: "/admin/avaliacoes", result: reviews },
    { label: "Sugestões de impressoras", href: "/admin/catalogos/impressoras", result: printerSuggestions },
  ];

  return <><SiteHeader /><main className="admin-dashboard shell">
    <Link className="viewer-back-link" href="/conta">← Voltar à conta</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">OPERAÇÃO DA PLATAFORMA</p><h1>Painel administrativo</h1><p>Veja as filas de revisão e acesse os módulos de gestão do ViraPeça 3D.</p></div>
    <section className="admin-overview-section" aria-labelledby="admin-queues-title">
      <div className="admin-section-title"><span className="account-kicker">AGUARDANDO AÇÃO</span><h2 id="admin-queues-title">Filas de revisão</h2></div>
      <div className="admin-overview-grid">{queues.map(({ label, href, result }) => <Link className="admin-overview-card" href={href} key={label}>
        <span>{label}</span><strong>{result.error ? "—" : new Intl.NumberFormat("pt-BR").format(result.count ?? 0)}</strong><small>{result.error ? "Contagem indisponível" : "itens aguardando"}</small>
      </Link>)}</div>
    </section>
    <section className="admin-overview-section" aria-labelledby="admin-tools-title">
      <div className="admin-section-title"><span className="account-kicker">GESTÃO</span><h2 id="admin-tools-title">Módulos administrativos</h2></div>
      <nav className="admin-overview-tools" aria-label="Módulos administrativos">
        <Link className="button button-secondary" href="/admin/fabricantes">Fabricantes, lojas e anúncios</Link>
        <Link className="button button-secondary" href="/admin/designers">Designers</Link>
        <Link className="button button-secondary" href="/admin/banners">Banners da página inicial</Link>
        <Link className="button button-secondary" href="/admin/catalogos/impressoras">Catálogo de impressoras</Link>
        <Link className="button button-secondary" href="/admin/catalogos/materiais">Materiais e resinas</Link>
        <Link className="button button-secondary" href="/admin/catalogos/bicos">Bicos e compatibilidade</Link>
        <Link className="button button-secondary" href="/admin/avaliacoes">Moderação de avaliações</Link>
        <Link className="button button-secondary" href="/admin/denuncias-digitais">Denúncias de conteúdo</Link>
      </nav>
    </section>
  </main></>;
}
