import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { saveHomepageBannerAction, setHomepageBannerActiveAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Banners da página inicial | ViraPeça 3D", robots: { index: false, follow: false } };

const notices: Record<string, string> = {
  salvo: "Banner salvo.",
  "publicacao-atualizada": "A publicação do banner foi atualizada.",
  erro: "Não foi possível salvar o banner. Confira os campos e se a migração 020 foi aplicada.",
};

function BannerForm({ banner }: { banner?: {
  id: string; eyebrow: string; title: string; description: string; image_url: string | null; image_alt: string | null;
  action_label: string; action_href: string; sort_order: number; is_active: boolean;
} }) {
  return <form action={saveHomepageBannerAction} className="admin-banner-form">
    {banner && <input type="hidden" name="bannerId" value={banner.id} />}
    <label>Chamada curta (opcional)<input name="eyebrow" maxLength={60} defaultValue={banner?.eyebrow ?? ""} /></label>
    <label>Título<input name="title" minLength={4} maxLength={90} defaultValue={banner?.title ?? ""} required /></label>
    <label>Descrição<textarea name="description" minLength={10} maxLength={240} defaultValue={banner?.description ?? ""} required /></label>
    <label>Imagem HTTPS (opcional)<input name="imageUrl" type="url" maxLength={2048} defaultValue={banner?.image_url ?? ""} placeholder="https://…" /></label>
    <label>Texto alternativo da imagem<input name="imageAlt" maxLength={160} defaultValue={banner?.image_alt ?? ""} /></label>
    <label>Texto do botão<input name="actionLabel" minLength={2} maxLength={30} defaultValue={banner?.action_label ?? "Explorar produtos"} required /></label>
    <label>Destino interno (ex.: /#produtos)<input name="actionHref" maxLength={200} pattern="/[^/].*|/" defaultValue={banner?.action_href ?? "/#produtos"} required /></label>
    <label>Ordem<input name="sortOrder" type="number" min="0" max="9999" step="1" defaultValue={banner?.sort_order ?? 0} required /></label>
    <label className="admin-banner-active"><input name="isActive" type="checkbox" defaultChecked={banner?.is_active ?? false} /> Publicar na página inicial</label>
    <button className="button button-primary" type="submit">{banner ? "Salvar alterações" : "Criar banner"}</button>
  </form>;
}

export default async function HomepageBannersAdminPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const banners = await actor.supabase.from("homepage_banners")
    .select("id, eyebrow, title, description, image_url, image_alt, action_label, action_href, sort_order, is_active")
    .order("sort_order").order("created_at", { ascending: false });

  return <>
    <SiteHeader />
    <main className="admin-dashboard shell">
      <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
      <div className="account-heading maker-dashboard-heading"><p className="eyebrow">CONTEÚDO DA VITRINE</p><h1>Banners da página inicial</h1><p>Crie campanhas, ajuste a ordem e publique ou pause os destaques. A homepage mostra os seis primeiros banners ativos.</p></div>
      {resultado && notices[resultado] && <p className={`auth-notice ${resultado === "erro" ? "is-error" : "is-success"}`} role="status">{notices[resultado]}</p>}
      <section className="admin-review-section">
        {banners.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar banners. Confira se a migração 020 foi aplicada.</p> : <>
          <article className="account-card admin-banner-create"><div className="admin-section-title"><span className="account-kicker">NOVO DESTAQUE</span><h2>Criar banner</h2></div><BannerForm /></article>
          <div className="admin-section-title"><span className="account-kicker">CONTEÚDO ATUAL</span><h2>Banners cadastrados</h2></div>
          {!banners.data?.length ? <p className="admin-empty">Nenhum banner cadastrado.</p> : banners.data.map((banner) => <article className="account-card admin-banner-record" key={banner.id}>
            <div className="admin-banner-record-heading"><div><span className="account-kicker">{banner.is_active ? "PUBLICADO" : "PAUSADO"} · ORDEM {banner.sort_order}</span><h3>{banner.title}</h3><p>{banner.description}</p></div>
              <form action={setHomepageBannerActiveAction}><input type="hidden" name="bannerId" value={banner.id} /><button className="button button-secondary" name="isActive" value={banner.is_active ? "false" : "true"} type="submit">{banner.is_active ? "Pausar banner" : "Publicar banner"}</button></form>
            </div>
            <details className="equipment-edit-form"><summary>Editar conteúdo</summary><BannerForm banner={banner} /></details>
          </article>)}
        </>}
      </section>
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Conteúdo da vitrine ViraPeça 3D.</p><span>© 2026 ViraPeça 3D</span></div></footer>
  </>;
}
