import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { readPrintProfileColors } from "@/lib/print-profile-colors";
import { publishProductAction, publishStoreAction, reviewMakerApplicationAction, reviewPrintProfileAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Revisão do marketplace | ViraPeça 3D", robots: { index: false, follow: false } };

const resultMessages: Record<string, string> = {
  analisada: "A solicitação foi revisada.",
  "loja-aprovada": "A loja foi publicada.",
  "produto-publicado": "O anúncio foi publicado.",
  "perfil-comunitario": "Perfil aprovado para a comunidade.",
  "perfil-oficial": "Perfil aprovado como oficial.",
  "perfil-recusado": "Perfil recusado com retorno ao fabricante.",
  erro: "Não foi possível concluir a ação. Atualize a página e confira as permissões.",
};

export default async function MarketplaceAdminPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const [applications, stores, products, printProfiles] = await Promise.all([
    actor.supabase.from("maker_applications").select("id, business_name, contact_email, description, portfolio_url, city, state_code, created_at").eq("status", "pending").order("created_at"),
    actor.supabase.from("stores").select("id, name, slug, description, city, state_code, created_at").eq("status", "pending").order("created_at"),
    actor.supabase.from("marketplace_products").select("id, name, slug, description, listing_type, price_mode, price_brl, created_at, digital_asset:digital_assets(file_name, has_preview, personal_price_brl, commercial_price_brl), store:stores!inner(name, status)").eq("catalog_status", "draft").eq("store.status", "published").order("created_at"),
    actor.supabase.from("maker_print_profiles").select("id, profile_name, profile_type, printer_snapshot, material_snapshot, nozzle_snapshot, layer_height_mm, infill_percent, wall_count, supports, orientation, scale_percent, quantity, print_hours, material_grams, material_by_color, product:marketplace_products!inner(name), store:stores!inner(name)").eq("sharing_scope", "community").eq("review_status", "pending").order("created_at"),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="admin-dashboard shell">
        <Link className="viewer-back-link" href="/conta">← Voltar à conta</Link>
        <div className="account-heading maker-dashboard-heading"><p className="eyebrow">CONTROLE DE QUALIDADE</p><h1>Revisão do marketplace</h1><p>Analise fabricantes, lojas e anúncios antes que apareçam publicamente.</p></div>
        <p><Link className="button button-secondary" href="/admin/banners">Gerenciar banners da página inicial</Link></p>
        <p><Link className="button button-secondary" href="/admin/designers">Revisar perfis de designers</Link></p>
        <p><Link className="button button-secondary" href="/admin/denuncias-digitais">Revisar denúncias de arquivos digitais</Link></p>
        <p><Link className="button button-secondary" href="/admin/avaliacoes">Moderar avaliações de compradores</Link></p>
        <p><Link className="button button-secondary" href="/admin/catalogos/impressoras">Gerenciar catálogo mestre de impressoras</Link></p>
        {resultado && <p className={`auth-notice ${resultado === "erro" ? "is-error" : "is-success"}`} role="status">{resultMessages[resultado] ?? "Ação concluída."}</p>}
        <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">ETAPA 1</span><h2>Solicitações de fabricantes</h2></div>
          {applications.error ? <p className="auth-notice is-error">Não foi possível carregar as solicitações.</p> : (applications.data?.length ?? 0) === 0 ? <p className="admin-empty">Nenhuma solicitação aguardando análise.</p> : applications.data?.map((application) => (
            <article className="admin-review-card" key={application.id}>
              <div><h3>{application.business_name}</h3><p><a href={`mailto:${application.contact_email}`}>{application.contact_email}</a>{application.city ? ` · ${application.city}${application.state_code ? `/${application.state_code}` : ""}` : ""}</p><p>{application.description}</p>{application.portfolio_url && <a href={application.portfolio_url} target="_blank" rel="noreferrer">Abrir portfólio ↗</a>}</div>
              <form action={reviewMakerApplicationAction}><input type="hidden" name="applicationId" value={application.id} /><label>Nota para o histórico<input name="note" maxLength={1000} /></label><div className="admin-review-actions"><button className="button button-primary" name="decision" value="approved" type="submit">Aprovar fabricante</button><button className="button button-secondary" name="decision" value="rejected" type="submit">Recusar</button></div></form>
            </article>
          ))}
        </section>
        <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">ETAPA 2</span><h2>Lojas aguardando publicação</h2></div>
          {stores.error ? <p className="auth-notice is-error">Não foi possível carregar as lojas.</p> : (stores.data?.length ?? 0) === 0 ? <p className="admin-empty">Nenhuma loja aguardando aprovação.</p> : stores.data?.map((store) => <article className="admin-review-card admin-review-card-compact" key={store.id}><div><h3>{store.name}</h3><p>{store.city ? `${store.city}${store.state_code ? `/${store.state_code}` : ""} · ` : ""}{store.description}</p></div><form action={publishStoreAction}><input type="hidden" name="storeId" value={store.id} /><button className="button button-primary" type="submit">Publicar loja</button></form></article>)}
        </section>
        <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">ETAPA 3</span><h2>Anúncios para revisar</h2></div>
          {products.error ? <p className="auth-notice is-error">Não foi possível carregar os anúncios.</p> : (products.data?.length ?? 0) === 0 ? <p className="admin-empty">Nenhum anúncio de loja publicada para revisar.</p> : products.data?.map((product) => {
            const store = Array.isArray(product.store) ? product.store[0] : product.store;
            const asset = Array.isArray(product.digital_asset) ? product.digital_asset[0] : product.digital_asset;
            const digitalReady = product.listing_type !== "digital" || Boolean(asset?.file_name && asset.has_preview);
            return <article className="admin-review-card admin-review-card-compact" key={product.id}><div><h3>{product.name}</h3><p>{store?.name} · {product.listing_type === "digital" ? "Arquivo digital 3D" : product.price_mode === "quote" ? "Sob orçamento" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(product.price_brl))}</p><p>{product.description}</p>{asset && <p>Arquivo privado: {asset.file_name} · prévia GLB {asset.has_preview ? "cadastrada" : "pendente"} · licença pessoal {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(asset.personal_price_brl))}{asset.commercial_price_brl ? ` · comercial ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(asset.commercial_price_brl))}` : ""}</p>}{!digitalReady && <p>O anúncio digital precisa do arquivo original, da prévia GLB e da licença pessoal.</p>}</div><form action={publishProductAction}><input type="hidden" name="productId" value={product.id} /><button className="button button-primary" type="submit" disabled={!digitalReady}>Publicar anúncio</button></form></article>;
          })}
        </section>
        <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">ETAPA 4</span><h2>Perfis de impressão para revisar</h2></div>
          {printProfiles.error ? <p className="auth-notice is-error">Não foi possível carregar os perfis de impressão.</p> : (printProfiles.data?.length ?? 0) === 0 ? <p className="admin-empty">Nenhum perfil aguarda revisão.</p> : printProfiles.data?.map((profile) => {
            const product = Array.isArray(profile.product) ? profile.product[0] : profile.product;
            const store = Array.isArray(profile.store) ? profile.store[0] : profile.store;
            const colors = readPrintProfileColors(profile.material_by_color);
            return <article className="admin-review-card" key={profile.id}>
              <div><span className="account-kicker">{profile.profile_type.toUpperCase()} · {store?.name}</span><h3>{product?.name} · {profile.profile_name}</h3>
                <p>{profile.printer_snapshot} · {profile.material_snapshot} · {profile.nozzle_snapshot}</p>
                <p>Escala {profile.scale_percent}% · lote de {profile.quantity} · camada {profile.layer_height_mm ?? "não informada"} mm · preenchimento {profile.infill_percent ?? "não informado"}% · {profile.wall_count ?? "paredes não informadas"} parede(s) · {profile.supports ? "com suportes" : "sem suportes"}</p>
                <p>Tempo: {profile.print_hours ?? "não informado"} h · material: {profile.material_grams ?? "não informado"} g{colors.length ? ` · ${colors.map(({ color, grams }) => `${color} ${grams} g`).join(", ")}` : ""}</p>
                {profile.orientation && <p>Orientação: {profile.orientation}</p>}
              </div>
              <form action={reviewPrintProfileAction}><input type="hidden" name="profileId" value={profile.id} /><label>Retorno ao fabricante (opcional)<input name="note" maxLength={1000} /></label><div className="admin-review-actions"><button className="button button-primary" name="decision" value="community" type="submit">Aprovar comunitário</button><button className="button button-primary" name="decision" value="official" type="submit">Marcar como oficial</button><button className="button button-secondary" name="decision" value="rejected" type="submit">Recusar</button></div></form>
            </article>;
          })}
        </section>
      </main>
      <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Aprovação de conteúdo ViraPeça 3D.</p><span>© 2026 ViraPeça 3D</span></div></footer>
    </>
  );
}
