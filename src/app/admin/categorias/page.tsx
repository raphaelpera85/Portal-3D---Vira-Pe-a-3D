import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { getAssignableCategoryParentIds } from "@/lib/product-category-hierarchy";
import { saveProductCategoryAction, setProductCategoryActiveAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Categorias do marketplace | ViraPeça 3D", robots: { index: false, follow: false } };

const notices: Record<string, string> = {
  salvo: "Categoria salva.",
  ativada: "Categoria ativada e disponível para novos anúncios.",
  desativada: "Categoria desativada. Anúncios já existentes continuam preservados.",
  "tem-anuncios": "Esta categoria tem anúncios publicados. Arquive ou mova os anúncios antes de desativá-la.",
  erro: "Não foi possível salvar. Confira nome, slug, categoria-pai e ordem.",
};

export default async function ProductCategoriesAdminPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");

  const { data: rows, error } = await actor.supabase.from("product_categories").select("id, parent_id, name, slug, active, sort_order").order("sort_order").order("name").limit(250);
  const categories = rows ?? [];
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const assignableParents = new Map(categories.map((category) => [category.id, new Set(getAssignableCategoryParentIds(category.id, categories))]));

  return <>
    <SiteHeader />
    <main className="admin-dashboard shell">
      <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
      <div className="account-heading maker-dashboard-heading"><p className="eyebrow">GESTÃO DO MARKETPLACE</p><h1>Categorias</h1><p>Organize a navegação da vitrine. Slugs formam os filtros públicos e precisam ser únicos.</p></div>
      {resultado && notices[resultado] && <p className={`auth-notice ${resultado === "erro" || resultado === "tem-anuncios" ? "is-error" : "is-success"}`} role="status">{notices[resultado]}</p>}
      <section className="account-card admin-banner-create">
        <div className="admin-section-title"><span className="account-kicker">NOVA CATEGORIA</span><h2>Adicionar à vitrine</h2></div>
        <form action={saveProductCategoryAction} className="printer-model-form">
          <label>Nome<input name="name" minLength={2} maxLength={80} required /></label>
          <label>Slug público<input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} placeholder="exemplo-de-categoria" required /></label>
          <label>Categoria-pai<select name="parentId" defaultValue=""><option value="">Sem categoria-pai</option>{categories.filter((category) => category.active).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
          <label>Ordem na vitrine<input name="sortOrder" type="number" min="0" max="32767" step="1" defaultValue="0" required /></label>
          <button className="button button-primary" type="submit">Adicionar categoria</button>
        </form>
      </section>
      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">CATÁLOGO PÚBLICO</span><h2>Categorias cadastradas</h2></div>
        {error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar categorias. Confira as permissões do catálogo.</p> : !categories.length ? <p className="admin-empty">Nenhuma categoria cadastrada.</p> : categories.map((category) => <article className="account-card admin-banner-record" key={category.id}>
          <div className="admin-banner-record-heading"><div><span className="account-kicker">{category.active ? "ATIVA" : "INATIVA"} · ORDEM {category.sort_order}</span><h3>{category.name}</h3><p>/{category.slug} · {category.parent_id ? `Subcategoria de ${names.get(category.parent_id) ?? "categoria removida"}` : "Categoria principal"}</p></div>
            <form action={setProductCategoryActiveAction}><input type="hidden" name="categoryId" value={category.id} /><input type="hidden" name="active" value={String(!category.active)} /><button className="button button-secondary" type="submit">{category.active ? "Desativar" : "Ativar"}</button></form>
          </div>
          <details className="equipment-edit-form"><summary>Editar nome, slug, categoria-pai ou ordem</summary><form action={saveProductCategoryAction} className="printer-model-form"><input type="hidden" name="categoryId" value={category.id} /><label>Nome<input name="name" minLength={2} maxLength={80} defaultValue={category.name} required /></label><label>Slug público<input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} defaultValue={category.slug} required /></label><label>Categoria-pai<select name="parentId" defaultValue={category.parent_id ?? ""}><option value="">Sem categoria-pai</option>{categories.filter((parent) => parent.id === category.parent_id || assignableParents.get(category.id)?.has(parent.id)).map((parent) => <option value={parent.id} key={parent.id}>{parent.name}{parent.active ? "" : " (inativa)"}</option>)}</select></label><label>Ordem na vitrine<input name="sortOrder" type="number" min="0" max="32767" step="1" defaultValue={category.sort_order} required /></label><button className="button button-primary" type="submit">Salvar alterações</button></form></details>
        </article>)}
        {categories.length === 250 && <p className="model-library-note">Exibindo as primeiras 250 categorias. Contate a equipe técnica para administrar listas maiores.</p>}
      </section>
    </main>
  </>;
}
