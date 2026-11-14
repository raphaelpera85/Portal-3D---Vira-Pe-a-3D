import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { CatalogOptionSelect } from "@/components/catalog-option-select";
import { getUserWithRole } from "@/lib/auth-role.server";
import { getPaginationRedirectPage, maxPageNumber, parsePageNumber } from "@/lib/pagination";
import { saveMaterialCompatibilityAction, saveNozzleAction, saveNozzleCompatibilityAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catálogo de bicos e compatibilidade | ViraPeça 3D", robots: { index: false, follow: false } };

type RecordRow = Record<string, string | number | boolean | null | unknown[]> & { id?: string; printer_id?: string; material_id?: string; nozzle_id?: string };
type Option = { id: string; label: string };
const field = (row: RecordRow | undefined, key: string) => row?.[key] == null ? "" : String(row[key]);
const jsonField = (row: RecordRow | undefined, key: string) => JSON.stringify(row?.[key] ?? {}, null, 2);
const notices: Record<string, string> = {
  "bico-salvo": "Bico salvo.", "compatibilidade-salva": "Compatibilidade salva.",
  erro: "Não foi possível salvar. Confira as fontes, as medidas, os vínculos e a migração 002.",
};
const pageSize = 24;
type PageState = { bicoPagina: number; materialPagina: number; relacaoBicoPagina: number };

function NozzleForm({ row, pages }: { row?: RecordRow; pages: PageState }) {
  return <form action={saveNozzleAction} className="printer-model-form">
    <input type="hidden" name="bicoPagina" value={pages.bicoPagina} /><input type="hidden" name="materialPagina" value={pages.materialPagina} /><input type="hidden" name="relacaoBicoPagina" value={pages.relacaoBicoPagina} />
    {row?.id && <input type="hidden" name="nozzleId" value={row.id} />}
    <label>Fabricante<input name="manufacturer" maxLength={100} defaultValue={field(row, "manufacturer")} required /></label>
    <label>Modelo ou variante<input name="model" maxLength={120} defaultValue={field(row, "model")} required /></label>
    <label>Interface ou encaixe<input name="interface" maxLength={120} defaultValue={field(row, "interface")} /></label>
    <label>Diâmetro (mm)<input name="diameter" type="number" min="0.01" step="any" defaultValue={field(row, "diameter_mm")} required /></label>
    <label>Material do corpo<input name="bodyMaterial" maxLength={120} defaultValue={field(row, "body_material")} /></label>
    <label>Temperatura máxima (°C)<input name="maxTemperature" type="number" min="0.01" step="any" defaultValue={field(row, "max_temperature_c")} /></label>
    <label>Resistente à abrasão<select name="abrasionResistant" defaultValue={field(row, "abrasion_resistant")}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select></label>
    <label>Original da impressora<select name="original" defaultValue={field(row, "original") || "false"}><option value="true">Sim</option><option value="false">Não</option></select></label>
    <label>Status<select name="catalogStatus" defaultValue={field(row, "catalog_status") || "draft"}><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="archived">Arquivado</option></select></label>
    <label>Documentação HTTPS<input name="documentationUrl" type="url" maxLength={2048} defaultValue={field(row, "documentation_url")} /></label>
    <label>Fonte técnica HTTPS<input name="sourceUrl" type="url" maxLength={2048} defaultValue={field(row, "source_url")} /></label>
    <label>Conferido em<input name="verifiedAt" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={field(row, "verified_at")} /></label>
    <label className="printer-model-json">Outras propriedades (JSON)<textarea name="technicalProperties" rows={4} defaultValue={jsonField(row, "technical_properties")} /></label>
    <button className="button button-primary" type="submit">{row ? "Salvar bico" : "Cadastrar bico"}</button>
  </form>;
}

function RelationForm({
  row, printers, entities, type, pages,
}: { row?: RecordRow; printers: Option[]; entities: Option[]; type: "material" | "nozzle"; pages: PageState }) {
  const action = type === "material" ? saveMaterialCompatibilityAction : saveNozzleCompatibilityAction;
  const entityId = row?.[type === "material" ? "material_id" : "nozzle_id"];
  const relationStatus = field(row, type === "material" ? "compatibility" : "fit");
  return <form action={action} className="printer-model-form relationship-form">
    <input type="hidden" name="bicoPagina" value={pages.bicoPagina} /><input type="hidden" name="materialPagina" value={pages.materialPagina} /><input type="hidden" name="relacaoBicoPagina" value={pages.relacaoBicoPagina} />
    {row && <><input type="hidden" name="oldPrinterId" value={field(row, "printer_id")} /><input type="hidden" name="oldEntityId" value={String(entityId ?? "")} /></>}
    <CatalogOptionSelect key={`printer:${field(row, "printer_id")}`} kind="printer" name="printerId" label="Impressora" selectedValue={field(row, "printer_id")} options={printers} />
    <CatalogOptionSelect key={`${type}:${String(entityId ?? "")}`} kind={type} name="entityId" label={type === "material" ? "Material" : "Bico"} selectedValue={String(entityId ?? "")} options={entities} />
    <label>Resultado<select name={type === "material" ? "compatibility" : "fit"} defaultValue={relationStatus || "unverified"}><option value="compatible">Compatível</option><option value="conditional">Condicional</option><option value="incompatible">Incompatível</option><option value="unverified">Não verificado</option></select></label>
    <label>Condições ou observações<input name="conditions" maxLength={1000} defaultValue={field(row, "conditions")} /></label>
    <label>Status<select name="catalogStatus" defaultValue={field(row, "catalog_status") || "draft"}><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="archived">Arquivado</option></select></label>
    <label>Fonte HTTPS<input name="sourceUrl" type="url" maxLength={2048} defaultValue={field(row, "source_url")} /></label>
    <label>Conferido em<input name="verifiedAt" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={field(row, "verified_at")} /></label>
    <button className="button button-primary" type="submit">{row ? "Salvar compatibilidade" : "Adicionar compatibilidade"}</button>
  </form>;
}

export default async function NozzleCatalogAdminPage({ searchParams }: { searchParams: Promise<{ resultado?: string; bicoPagina?: string; materialPagina?: string; relacaoBicoPagina?: string }> }) {
  const [{ resultado, bicoPagina, materialPagina, relacaoBicoPagina }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const pages: PageState = { bicoPagina: parsePageNumber(bicoPagina) ?? 1, materialPagina: parsePageNumber(materialPagina) ?? 1, relacaoBicoPagina: parsePageNumber(relacaoBicoPagina) ?? 1 };
  const [nozzles, printerRows, materialRows, nozzleRows, materialLinks, nozzleLinks] = await Promise.all([
    actor.supabase.from("nozzle_catalog").select("*", { count: "exact" }).order("manufacturer").order("model").order("diameter_mm").order("id").range((pages.bicoPagina - 1) * pageSize, pages.bicoPagina * pageSize - 1),
    actor.supabase.from("printer_models").select("id, manufacturer, model, variant, catalog_status").order("manufacturer").order("model").order("id").limit(50),
    actor.supabase.from("material_catalog").select("id, manufacturer, product, catalog_status").order("manufacturer").order("product").order("id").limit(50),
    actor.supabase.from("nozzle_catalog").select("id, manufacturer, model, diameter_mm, catalog_status").order("manufacturer").order("model").order("diameter_mm").order("id").limit(50),
    actor.supabase.from("printer_material_compatibility").select("*", { count: "exact" }).order("printer_id").order("material_id").range((pages.materialPagina - 1) * pageSize, pages.materialPagina * pageSize - 1),
    actor.supabase.from("printer_nozzle_compatibility").select("*", { count: "exact" }).order("printer_id").order("nozzle_id").range((pages.relacaoBicoPagina - 1) * pageSize, pages.relacaoBicoPagina * pageSize - 1),
  ]);
  const referencedPrinterIds = [...new Set([...(materialLinks.data ?? []).map((row) => row.printer_id), ...(nozzleLinks.data ?? []).map((row) => row.printer_id)])];
  const referencedMaterialIds = [...new Set((materialLinks.data ?? []).map((row) => row.material_id))];
  const referencedNozzleIds = [...new Set((nozzleLinks.data ?? []).map((row) => row.nozzle_id))];
  const optionIds = (rows: readonly { id: string }[] | null | undefined) => new Set((rows ?? []).map((row) => row.id));
  const missingPrinterIds = referencedPrinterIds.filter((id) => !optionIds(printerRows.data).has(id));
  const missingMaterialIds = referencedMaterialIds.filter((id) => !optionIds(materialRows.data).has(id));
  const missingNozzleIds = referencedNozzleIds.filter((id) => !optionIds(nozzleRows.data).has(id));
  const [missingPrinters, missingMaterials, missingNozzles] = await Promise.all([
    missingPrinterIds.length ? actor.supabase.from("printer_models").select("id, manufacturer, model, variant, catalog_status").in("id", missingPrinterIds) : Promise.resolve(null),
    missingMaterialIds.length ? actor.supabase.from("material_catalog").select("id, manufacturer, product, catalog_status").in("id", missingMaterialIds) : Promise.resolve(null),
    missingNozzleIds.length ? actor.supabase.from("nozzle_catalog").select("id, manufacturer, model, diameter_mm, catalog_status").in("id", missingNozzleIds) : Promise.resolve(null),
  ]);
  const printerOptions: Option[] = [...(printerRows.data ?? []), ...(missingPrinters?.data ?? [])].map((row) => ({ id: row.id, label: `${row.manufacturer} ${row.model} · ${row.variant} (${row.catalog_status})` }));
  const materialOptions: Option[] = [...(materialRows.data ?? []), ...(missingMaterials?.data ?? [])].map((row) => ({ id: row.id, label: `${row.manufacturer} · ${row.product} (${row.catalog_status})` }));
  const nozzleOptions: Option[] = [...(nozzleRows.data ?? []), ...(missingNozzles?.data ?? [])].map((value) => { const row = value as unknown as RecordRow; return { id: String(row.id), label: `${field(row, "manufacturer")} · ${field(row, "model")} · ${field(row, "diameter_mm")} mm (${field(row, "catalog_status")})` }; });
  const addUnavailableReferences = (options: Option[], ids: string[]) => {
    const known = new Set(options.map((option) => option.id));
    for (const id of ids) if (!known.has(id)) options.push({ id, label: `${id} (indisponível)` });
  };
  addUnavailableReferences(printerOptions, referencedPrinterIds);
  addUnavailableReferences(materialOptions, referencedMaterialIds);
  addUnavailableReferences(nozzleOptions, referencedNozzleIds);
  const printerLabels = new Map(printerOptions.map((item) => [item.id, item.label]));
  const materialLabels = new Map(materialOptions.map((item) => [item.id, item.label]));
  const nozzleLabels = new Map(nozzleOptions.map((item) => [item.id, item.label]));
  const hasErrors = [nozzles, printerRows, materialRows, nozzleRows, materialLinks, nozzleLinks, missingPrinters, missingMaterials, missingNozzles].some((result) => result?.error);
  const nozzlePages = Math.max(1, Math.ceil((nozzles.count ?? 0) / pageSize));
  const materialPages = Math.max(1, Math.ceil((materialLinks.count ?? 0) / pageSize));
  const relationPages = Math.max(1, Math.ceil((nozzleLinks.count ?? 0) / pageSize));
  const pageHref = (next: Partial<PageState>) => {
    const params = new URLSearchParams();
    const values = { ...pages, ...next };
    for (const [name, value] of Object.entries(values)) if (value > 1) params.set(name, String(value));
    if (resultado) params.set("resultado", resultado);
    return `/admin/catalogos/bicos${params.size ? `?${params.toString()}` : ""}`;
  };
  const nozzleRedirect = getPaginationRedirectPage(pages.bicoPagina, nozzlePages);
  if (!nozzles.error && nozzleRedirect !== null) redirect(pageHref({ bicoPagina: nozzleRedirect }));
  const materialRedirect = getPaginationRedirectPage(pages.materialPagina, materialPages);
  if (!materialLinks.error && materialRedirect !== null) redirect(pageHref({ materialPagina: materialRedirect }));
  const relationRedirect = getPaginationRedirectPage(pages.relacaoBicoPagina, relationPages);
  if (!nozzleLinks.error && relationRedirect !== null) redirect(pageHref({ relacaoBicoPagina: relationRedirect }));

  return <>
    <SiteHeader />
    <main id="main-content" tabIndex={-1} className="admin-dashboard shell">
      <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
      <nav className="admin-catalog-links" aria-label="Catálogos técnicos"><Link href="/admin/catalogos/impressoras">Impressoras</Link><Link href="/admin/catalogos/materiais">Materiais e resinas</Link><Link aria-current="page" href="/admin/catalogos/bicos">Bicos e compatibilidade</Link><Link href="/admin/catalogos/atualizacoes">Atualizações</Link></nav>
      <div className="account-heading maker-dashboard-heading"><p className="eyebrow">CURADORIA TÉCNICA</p><h1>Bicos e compatibilidade</h1><p>Diâmetro, interface e compatibilidade são relações distintas. Cada vínculo publicado exige fonte própria.</p></div>
      {resultado && notices[resultado] && <p className={`auth-notice ${resultado === "erro" ? "is-error" : "is-success"}`} role="status">{notices[resultado]}</p>}
      {hasErrors && <p className="auth-notice is-error" role="alert">Parte do catálogo não pôde ser carregada. Confira a migração 002.</p>}
      <section className="account-card admin-banner-create"><div className="admin-section-title"><span className="account-kicker">NOVO REGISTRO</span><h2>Adicionar bico</h2></div><NozzleForm pages={pages} /></section>
      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">CATÁLOGO MESTRE</span><h2>Bicos cadastrados</h2></div>
        {nozzles.error ? <p className="admin-empty">Bicos indisponíveis até corrigir a consulta.</p> : !nozzles.data?.length ? <p className="admin-empty">Nenhum bico cadastrado no banco.</p> : nozzles.data.map((value) => { const row = value as unknown as RecordRow; return <article className="account-card admin-banner-record" key={row.id}><div className="admin-banner-record-heading"><div><span className="account-kicker">{field(row, "catalog_status").toUpperCase()}</span><h3>{field(row, "manufacturer")} · {field(row, "model")} · {field(row, "diameter_mm")} mm</h3><p>Encaixe: {field(row, "interface") || "não informado"} · Fonte: {field(row, "source_url") || "não informada"}</p></div></div><details className="equipment-edit-form"><summary>Editar especificações</summary><NozzleForm row={row} pages={pages} /></details></article>; })}
        {!nozzles.error && (nozzles.count ?? 0) > pageSize && <nav className="catalog-pagination admin-catalog-pagination" aria-label="Paginação dos bicos"><span>Página {pages.bicoPagina} de {nozzlePages} · {nozzles.count} bicos</span><div>{pages.bicoPagina > 1 && <Link className="button button-secondary" href={pageHref({ bicoPagina: pages.bicoPagina - 1 })}>Anterior</Link>}{pages.bicoPagina < nozzlePages && pages.bicoPagina < maxPageNumber && <Link className="button button-secondary" href={pageHref({ bicoPagina: pages.bicoPagina + 1 })}>Próxima</Link>}</div></nav>}
      </section>
      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">VÍNCULOS DO CATÁLOGO</span><h2>Compatibilidade com materiais</h2></div>
        {!printerOptions.length || !materialOptions.length ? <p className="admin-empty">Cadastre impressoras e materiais antes de criar relações.</p> : <article className="account-card admin-banner-create"><h3>Nova relação impressora e material</h3><RelationForm type="material" printers={printerOptions} entities={materialOptions} pages={pages} />
          {(materialLinks.data ?? []).map((value) => { const row = value as unknown as RecordRow; return <details className="equipment-edit-form" key={`${row.printer_id}:${row.material_id}`}><summary>{printerLabels.get(String(row.printer_id)) ?? "Impressora"} · {materialLabels.get(String(row.material_id)) ?? "Material"} · {field(row, "catalog_status")}</summary><RelationForm row={row} type="material" printers={printerOptions} entities={materialOptions} pages={pages} /></details>; })}
          {!materialLinks.error && (materialLinks.count ?? 0) > pageSize && <nav className="catalog-pagination admin-catalog-pagination" aria-label="Paginação das relações com materiais"><span>Página {pages.materialPagina} de {materialPages} · {materialLinks.count} relações</span><div>{pages.materialPagina > 1 && <Link className="button button-secondary" href={pageHref({ materialPagina: pages.materialPagina - 1 })}>Anterior</Link>}{pages.materialPagina < materialPages && pages.materialPagina < maxPageNumber && <Link className="button button-secondary" href={pageHref({ materialPagina: pages.materialPagina + 1 })}>Próxima</Link>}</div></nav>}
        </article>}
      </section>
      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">VÍNCULOS DO CATÁLOGO</span><h2>Compatibilidade com bicos</h2></div>
        {!printerOptions.length || !nozzleOptions.length ? <p className="admin-empty">Cadastre impressoras e bicos antes de criar relações.</p> : <article className="account-card admin-banner-create"><h3>Nova relação impressora e bico</h3><RelationForm type="nozzle" printers={printerOptions} entities={nozzleOptions} pages={pages} />
          {(nozzleLinks.data ?? []).map((value) => { const row = value as unknown as RecordRow; return <details className="equipment-edit-form" key={`${row.printer_id}:${row.nozzle_id}`}><summary>{printerLabels.get(String(row.printer_id)) ?? "Impressora"} · {nozzleLabels.get(String(row.nozzle_id)) ?? "Bico"} · {field(row, "catalog_status")}</summary><RelationForm row={row} type="nozzle" printers={printerOptions} entities={nozzleOptions} pages={pages} /></details>; })}
          {!nozzleLinks.error && (nozzleLinks.count ?? 0) > pageSize && <nav className="catalog-pagination admin-catalog-pagination" aria-label="Paginação das relações com bicos"><span>Página {pages.relacaoBicoPagina} de {relationPages} · {nozzleLinks.count} relações</span><div>{pages.relacaoBicoPagina > 1 && <Link className="button button-secondary" href={pageHref({ relacaoBicoPagina: pages.relacaoBicoPagina - 1 })}>Anterior</Link>}{pages.relacaoBicoPagina < relationPages && pages.relacaoBicoPagina < maxPageNumber && <Link className="button button-secondary" href={pageHref({ relacaoBicoPagina: pages.relacaoBicoPagina + 1 })}>Próxima</Link>}</div></nav>}
        </article>}
      </section>
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Catálogo mestre ViraPeça 3D.</p><span>© 2026 ViraPeça 3D</span></div></footer>
  </>;
}
