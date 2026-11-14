import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { CatalogOptionSelect } from "@/components/catalog-option-select";
import { getUserWithRole } from "@/lib/auth-role.server";
import { fetchAllPages, getPaginationRedirectPage, maxPageNumber, parsePageNumber } from "@/lib/pagination";
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
const pageSize = 24;

export default async function ProductCategoriesAdminPage({ searchParams }: { searchParams: Promise<{ resultado?: string; pagina?: string; editar?: string }> }) {
  const [{ resultado, pagina, editar }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");

  const supabase = actor.supabase;
  const requestedPage = parsePageNumber(pagina) ?? 1;
  const [categoryOptionsPage, categoryPage] = await Promise.all([
    supabase.from("product_categories").select("id, parent_id, name, slug, active, sort_order")
      .eq("active", true).order("name").order("id").range(0, 49),
    supabase.from("product_categories").select("id, parent_id, name, slug, active, sort_order", { count: "exact" })
      .order("sort_order").order("name").order("id").range((requestedPage - 1) * pageSize, requestedPage * pageSize - 1),
  ]);
  const categories = categoryOptionsPage.data ?? [];
  const rows = categoryPage.data ?? [];
  const editCategory = editar ? rows.find((category) => category.id === editar) : undefined;
  const parentIds = [...new Set(rows.flatMap((category) => category.parent_id ? [category.parent_id] : []))]
    .filter((id) => !categories.some((category) => category.id === id));
  const hierarchy = editCategory ? await fetchAllPages((from, to) => supabase.from("product_categories")
    .select("id, parent_id, active").order("id").range(from, to)) : null;
  const missingParents = parentIds.length
    ? await supabase.from("product_categories").select("id, name, slug, active").in("id", parentIds)
    : { data: [], error: null };
  const error = categoryOptionsPage.error ?? categoryPage.error ?? hierarchy?.error ?? missingParents.error;
  const totalCategories = categoryPage.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCategories / pageSize));
  const pageHref = (page: number, categoryId?: string) => {
    const params = new URLSearchParams();
    if (page > 1) params.set("pagina", String(page));
    if (resultado) params.set("resultado", resultado);
    if (categoryId) params.set("editar", categoryId);
    return `/admin/categorias${params.size ? `?${params.toString()}` : ""}`;
  };
  const redirectPage = getPaginationRedirectPage(requestedPage, totalPages);
  if (!error && redirectPage !== null) redirect(pageHref(redirectPage));
  const allParentOptions = [...categories, ...(missingParents.data ?? [])];
  const names = new Map(allParentOptions.map((category) => [category.id, category.name]));
  const assignableParents = editCategory && hierarchy?.data
    ? new Set([...getAssignableCategoryParentIds(editCategory.id, hierarchy.data), ...(editCategory.parent_id ? [editCategory.parent_id] : [])])
    : null;
  const editParent = editCategory?.parent_id ? allParentOptions.find((parent) => parent.id === editCategory.parent_id) : undefined;
  const parentOptions = categories.filter((parent) => !assignableParents || assignableParents.has(parent.id))
    .map(({ id, name, slug, active }) => ({ id, name, slug, active }));
  if (editParent && assignableParents?.has(editParent.id) && !parentOptions.some((parent) => parent.id === editParent.id)) {
    parentOptions.push({ id: editParent.id, name: editParent.name, slug: editParent.slug, active: editParent.active });
  }

  return <>
    <SiteHeader />
    <main id="main-content" tabIndex={-1} className="admin-dashboard shell">
      <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
      <div className="account-heading maker-dashboard-heading"><p className="eyebrow">GESTÃO DO MARKETPLACE</p><h1>Categorias</h1><p>Organize a navegação da vitrine. Slugs formam os filtros públicos e precisam ser únicos.</p></div>
      {resultado && notices[resultado] && <p className={`auth-notice ${resultado === "erro" || resultado === "tem-anuncios" ? "is-error" : "is-success"}`} role="status">{notices[resultado]}</p>}
      <section className="account-card admin-banner-create">
        <div className="admin-section-title"><span className="account-kicker">NOVA CATEGORIA</span><h2>Adicionar à vitrine</h2></div>
        <form action={saveProductCategoryAction} className="printer-model-form">
          <input type="hidden" name="pagina" value={requestedPage} />
          <label>Nome<input name="name" minLength={2} maxLength={80} required /></label>
          <label>Slug público<input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} placeholder="exemplo-de-categoria" required /></label>
          <CatalogOptionSelect kind="category" name="parentId" label="Categoria-pai" selectedValue="" options={categories.map((category) => ({ id: category.id, label: `${category.name} · /${category.slug}` }))} required={false} />
          <label>Ordem na vitrine<input name="sortOrder" type="number" min="0" max="32767" step="1" defaultValue="0" required /></label>
          <button className="button button-primary" type="submit">Adicionar categoria</button>
        </form>
      </section>
      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">CATÁLOGO PÚBLICO</span><h2>Categorias cadastradas</h2></div>
        {error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar categorias. Confira as permissões do catálogo.</p> : !rows.length ? <p className="admin-empty">Nenhuma categoria cadastrada.</p> : rows.map((category) => <article className="account-card admin-banner-record" key={category.id}>
          <div className="admin-banner-record-heading"><div><span className="account-kicker">{category.active ? "ATIVA" : "INATIVA"} · ORDEM {category.sort_order}</span><h3>{category.name}</h3><p>/{category.slug} · {category.parent_id ? `Subcategoria de ${names.get(category.parent_id) ?? "categoria removida"}` : "Categoria principal"}</p></div>
            <div className="admin-banner-record-actions"><Link className="button button-secondary" href={pageHref(requestedPage, category.id)}>Editar</Link><form action={setProductCategoryActiveAction}><input type="hidden" name="categoryId" value={category.id} /><input type="hidden" name="active" value={String(!category.active)} /><input type="hidden" name="pagina" value={requestedPage} /><button className="button button-secondary" type="submit">{category.active ? "Desativar" : "Ativar"}</button></form></div>
          </div>
          {editCategory?.id === category.id && <details className="equipment-edit-form" open><summary>Editar nome, slug, categoria-pai ou ordem</summary><p><Link href={pageHref(requestedPage)}>Cancelar edição</Link></p><form action={saveProductCategoryAction} className="printer-model-form"><input type="hidden" name="categoryId" value={category.id} /><input type="hidden" name="pagina" value={requestedPage} /><label>Nome<input name="name" minLength={2} maxLength={80} defaultValue={category.name} required /></label><label>Slug público<input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} defaultValue={category.slug} required /></label><CatalogOptionSelect key={`${category.id}:${category.parent_id ?? "none"}`} kind="category" name="parentId" label="Categoria-pai" selectedValue={category.parent_id ?? ""} options={parentOptions.map((parent) => ({ id: parent.id, label: `${parent.name} · /${parent.slug}${"active" in parent && !parent.active ? " (inativa)" : ""}` }))} required={false} excludeId={category.id} availableIds={assignableParents ? [...assignableParents] : []} /><label>Ordem na vitrine<input name="sortOrder" type="number" min="0" max="32767" step="1" defaultValue={category.sort_order} required /></label><button className="button button-primary" type="submit">Salvar alterações</button></form></details>}
        </article>)}
        {!error && totalCategories > pageSize && <nav className="catalog-pagination admin-catalog-pagination" aria-label="Paginação das categorias"><span>Página {requestedPage} de {totalPages} · {totalCategories} categorias</span><div>{requestedPage > 1 && <Link className="button button-secondary" href={pageHref(requestedPage - 1)}>Anterior</Link>}{requestedPage < totalPages && requestedPage < maxPageNumber && <Link className="button button-secondary" href={pageHref(requestedPage + 1)}>Próxima</Link>}</div></nav>}
      </section>
    </main>
  </>;
}
