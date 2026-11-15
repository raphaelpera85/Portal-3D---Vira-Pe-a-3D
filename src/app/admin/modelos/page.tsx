import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { reviewCreatorModel } from "./actions";
import { getUserWithRole } from "@/lib/auth-role.server";
import { getModelAssetUrl, modelShowcaseCategories } from "@/lib/model-showcase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isCreatorModelPreviewPath, isCreatorModelUploadPath } from "@/lib/creator-model-upload";
import { CreatorModelReviewPreview } from "./creator-model-review-preview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Revisão de modelos | Administração | ViraPeça 3D", robots: { index: false, follow: false } };
const pageSize = 24;

export default async function AdminCreatorModelsPage({ searchParams }: { searchParams: Promise<{ resultado?: string; pagina?: string }> }) {
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { resultado, pagina } = await searchParams;
  const parsedPage = Number(pagina);
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const loadPage = (page: number) => actor.supabase!.from("creator_model_submissions")
    .select("id, name, category_slug, asset_path, storage_path, preview_path, file_name, submitted_by, tags, creator_name, source_url, created_at, store:stores!inner(name, slug)", { count: "exact" })
    .eq("review_status", "pending").order("created_at", { ascending: true }).order("id", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);
  let { data, error, count } = await loadPage(requestedPage);
  const pages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const page = Math.min(requestedPage, pages);
  if (!error && page !== requestedPage) ({ data, error } = await loadPage(page));
  const admin = createSupabaseAdminClient();
  const reviewRows = await Promise.all((data ?? []).map(async (row) => {
    let assetUrl = row.asset_path ? getModelAssetUrl(row.asset_path) : null;
    let previewUrl: string | null = null;
    if (admin) {
      const [asset, preview] = await Promise.all([
        !assetUrl && row.storage_path && isCreatorModelUploadPath(row.submitted_by, row.storage_path, row.id)
          ? admin.storage.from("creator-model-uploads").createSignedUrl(row.storage_path, 600) : Promise.resolve(null),
        row.preview_path && isCreatorModelPreviewPath(row.submitted_by, row.preview_path, row.id)
          ? admin.storage.from("creator-model-uploads").createSignedUrl(row.preview_path, 600) : Promise.resolve(null),
      ]);
      if (asset) assetUrl = asset.error ? null : asset.data?.signedUrl ?? null;
      if (preview) previewUrl = preview.error ? null : preview.data?.signedUrl ?? null;
    }
    return { row, assetUrl, previewUrl };
  }));
  return <><SiteHeader /><main id="main-content" tabIndex={-1} className="admin-dashboard shell">
    <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">MODERAÇÃO DO CATÁLOGO</p><h1>Modelos 3D enviados</h1><p>Confira o arquivo e os dados de autoria antes de publicar.</p></div>
    {resultado === "publicado" && <p className="auth-notice is-success" role="status">Modelo publicado na coleção.</p>}
    {resultado === "rejeitado" && <p className="auth-notice is-success" role="status">Envio rejeitado.</p>}
    {resultado === "erro" && <p className="auth-notice is-error" role="alert">Não foi possível revisar esse envio. Talvez ele já tenha sido analisado.</p>}
    {error ? <p className="auth-notice is-error" role="alert">Fila indisponível. Confira se a migração do catálogo comunitário foi aplicada.</p> : !data?.length ? <section className="account-card"><h2>Nenhum envio pendente</h2><p>Novos modelos enviados por vendedores aparecerão aqui.</p></section> : <div className="admin-model-review-list">
      {reviewRows.map(({ row, assetUrl, previewUrl }) => {
        const store = Array.isArray(row.store) ? row.store[0] : row.store;
        const category = modelShowcaseCategories.find(({ slug }) => slug === row.category_slug)?.name ?? row.category_slug;
        return <article className="account-card admin-model-review-card" key={row.id}>
          <div><span className="account-kicker">{category} · {store?.name ?? "Loja"}</span><h2>{row.name}</h2><p>Criador informado: {row.creator_name} · arquivo: <code>{row.asset_path ?? row.file_name}</code></p>
            {previewUrl && <img src={previewUrl} alt={`Capa enviada para ${row.name}`} width="240" height="180" style={{ display: "block", width: "min(240px, 100%)", height: 180, objectFit: "contain", background: "var(--surface)" }} />}
            <ul className="product-tags">{(row.tags as string[]).map((tag: string) => <li key={tag}>{tag}</li>)}</ul>
            {row.source_url && <p><a href={row.source_url} target="_blank" rel="noreferrer">Abrir fonte informada ↗</a></p>}
            {assetUrl && <><CreatorModelReviewPreview assetUrl={assetUrl} modelName={row.name} id={row.id} /><p><a href={assetUrl} target="_blank" rel="noreferrer">Baixar arquivo 3MF ↗</a></p></>}
          </div>
          <form action={reviewCreatorModel} className="auth-form"><label>Observação para o vendedor<textarea name="reviewNote" rows={2} maxLength={1000} /></label><input type="hidden" name="id" value={row.id} /><input type="hidden" name="pagina" value={page} /><button className="button button-primary" type="submit" name="decision" value="published">Aprovar e publicar</button><button className="button button-secondary" type="submit" name="decision" value="rejected">Rejeitar</button></form>
        </article>;
      })}
    </div>}
    {!error && count !== null && count > pageSize && <nav className="catalog-pagination" aria-label="Paginação dos modelos enviados"><span>Página {page} de {pages} · {count} envios pendentes</span><div>{page > 1 && <Link className="button button-secondary" href={`/admin/modelos?pagina=${page - 1}`}>Anterior</Link>}{page < pages && <Link className="button button-secondary" href={`/admin/modelos?pagina=${page + 1}`}>Próxima</Link>}</div></nav>}
  </main></>;
}
