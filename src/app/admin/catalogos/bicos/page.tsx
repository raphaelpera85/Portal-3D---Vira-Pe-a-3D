import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
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

function NozzleForm({ row }: { row?: RecordRow }) {
  return <form action={saveNozzleAction} className="printer-model-form">
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
  row, printers, entities, type,
}: { row?: RecordRow; printers: Option[]; entities: Option[]; type: "material" | "nozzle" }) {
  const action = type === "material" ? saveMaterialCompatibilityAction : saveNozzleCompatibilityAction;
  const entityId = row?.[type === "material" ? "material_id" : "nozzle_id"];
  const relationStatus = field(row, type === "material" ? "compatibility" : "fit");
  return <form action={action} className="printer-model-form relationship-form">
    {row && <><input type="hidden" name="oldPrinterId" value={field(row, "printer_id")} /><input type="hidden" name="oldEntityId" value={String(entityId ?? "")} /></>}
    <label>Impressora<select name="printerId" defaultValue={field(row, "printer_id")} required>{printers.map((printer) => <option key={printer.id} value={printer.id}>{printer.label}</option>)}</select></label>
    <label>{type === "material" ? "Material" : "Bico"}<select name="entityId" defaultValue={String(entityId ?? "")} required>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.label}</option>)}</select></label>
    <label>Resultado<select name={type === "material" ? "compatibility" : "fit"} defaultValue={relationStatus || "unverified"}><option value="compatible">Compatível</option><option value="conditional">Condicional</option><option value="incompatible">Incompatível</option><option value="unverified">Não verificado</option></select></label>
    <label>Condições ou observações<input name="conditions" maxLength={1000} defaultValue={field(row, "conditions")} /></label>
    <label>Status<select name="catalogStatus" defaultValue={field(row, "catalog_status") || "draft"}><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="archived">Arquivado</option></select></label>
    <label>Fonte HTTPS<input name="sourceUrl" type="url" maxLength={2048} defaultValue={field(row, "source_url")} /></label>
    <label>Conferido em<input name="verifiedAt" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={field(row, "verified_at")} /></label>
    <button className="button button-primary" type="submit">{row ? "Salvar compatibilidade" : "Adicionar compatibilidade"}</button>
  </form>;
}

export default async function NozzleCatalogAdminPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  // shortcut: nozzle and relation lists cap at 250; add pagination when either count exceeds this limit.
  const [nozzles, printerRows, materialRows, materialLinks, nozzleLinks] = await Promise.all([
    actor.supabase.from("nozzle_catalog").select("*", { count: "exact" }).order("manufacturer").order("diameter_mm").limit(250),
    actor.supabase.from("printer_models").select("id, manufacturer, model, variant, catalog_status").order("manufacturer").order("model").limit(1000),
    actor.supabase.from("material_catalog").select("id, manufacturer, product, catalog_status").order("manufacturer").order("product").limit(1000),
    actor.supabase.from("printer_material_compatibility").select("*", { count: "exact" }).order("printer_id").limit(250),
    actor.supabase.from("printer_nozzle_compatibility").select("*", { count: "exact" }).order("printer_id").limit(250),
  ]);
  const printerOptions: Option[] = (printerRows.data ?? []).map((row) => ({ id: row.id, label: `${row.manufacturer} ${row.model} · ${row.variant} (${row.catalog_status})` }));
  const materialOptions: Option[] = (materialRows.data ?? []).map((row) => ({ id: row.id, label: `${row.manufacturer} · ${row.product} (${row.catalog_status})` }));
  const nozzleOptions: Option[] = (nozzles.data ?? []).map((value) => { const row = value as unknown as RecordRow; return { id: String(row.id), label: `${field(row, "manufacturer")} · ${field(row, "model")} · ${field(row, "diameter_mm")} mm (${field(row, "catalog_status")})` }; });
  const printerLabels = new Map(printerOptions.map((item) => [item.id, item.label]));
  const materialLabels = new Map(materialOptions.map((item) => [item.id, item.label]));
  const nozzleLabels = new Map(nozzleOptions.map((item) => [item.id, item.label]));
  const hasErrors = [nozzles, printerRows, materialRows, materialLinks, nozzleLinks].some((result) => result.error);

  return <>
    <SiteHeader />
    <main className="admin-dashboard shell">
      <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
      <nav className="admin-catalog-links" aria-label="Catálogos técnicos"><Link href="/admin/catalogos/impressoras">Impressoras</Link><Link href="/admin/catalogos/materiais">Materiais e resinas</Link><Link aria-current="page" href="/admin/catalogos/bicos">Bicos e compatibilidade</Link><Link href="/admin/catalogos/atualizacoes">Atualizações</Link></nav>
      <div className="account-heading maker-dashboard-heading"><p className="eyebrow">CURADORIA TÉCNICA</p><h1>Bicos e compatibilidade</h1><p>Diâmetro, interface e compatibilidade são relações distintas. Cada vínculo publicado exige fonte própria.</p></div>
      {resultado && notices[resultado] && <p className={`auth-notice ${resultado === "erro" ? "is-error" : "is-success"}`} role="status">{notices[resultado]}</p>}
      {hasErrors && <p className="auth-notice is-error" role="alert">Parte do catálogo não pôde ser carregada. Confira a migração 002.</p>}
      <section className="account-card admin-banner-create"><div className="admin-section-title"><span className="account-kicker">NOVO REGISTRO</span><h2>Adicionar bico</h2></div><NozzleForm /></section>
      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">CATÁLOGO MESTRE</span><h2>Bicos cadastrados</h2></div>
        {nozzles.error ? <p className="admin-empty">Bicos indisponíveis até corrigir a consulta.</p> : !nozzles.data?.length ? <p className="admin-empty">Nenhum bico cadastrado no banco.</p> : nozzles.data.map((value) => { const row = value as unknown as RecordRow; return <article className="account-card admin-banner-record" key={row.id}><div className="admin-banner-record-heading"><div><span className="account-kicker">{field(row, "catalog_status").toUpperCase()}</span><h3>{field(row, "manufacturer")} · {field(row, "model")} · {field(row, "diameter_mm")} mm</h3><p>Encaixe: {field(row, "interface") || "não informado"} · Fonte: {field(row, "source_url") || "não informada"}</p></div></div><details className="equipment-edit-form"><summary>Editar especificações</summary><NozzleForm row={row} /></details></article>; })}
        {(nozzles.count ?? 0) > 250 && <p className="admin-empty">Esta tela mostra os 250 primeiros bicos.</p>}
      </section>
      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">VÍNCULOS DO CATÁLOGO</span><h2>Compatibilidade com materiais</h2></div>
        {!printerOptions.length || !materialOptions.length ? <p className="admin-empty">Cadastre impressoras e materiais antes de criar relações.</p> : <article className="account-card admin-banner-create"><h3>Nova relação impressora e material</h3><RelationForm type="material" printers={printerOptions} entities={materialOptions} />
          {(materialLinks.data ?? []).map((value) => { const row = value as unknown as RecordRow; return <details className="equipment-edit-form" key={`${row.printer_id}:${row.material_id}`}><summary>{printerLabels.get(String(row.printer_id)) ?? "Impressora"} · {materialLabels.get(String(row.material_id)) ?? "Material"} · {field(row, "catalog_status")}</summary><RelationForm row={row} type="material" printers={printerOptions} entities={materialOptions} /></details>; })}
          {(materialLinks.count ?? 0) > 250 && <p className="admin-empty">Mostrando 250 relações; as demais não podem ser editadas nesta página.</p>}
        </article>}
      </section>
      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">VÍNCULOS DO CATÁLOGO</span><h2>Compatibilidade com bicos</h2></div>
        {!printerOptions.length || !nozzleOptions.length ? <p className="admin-empty">Cadastre impressoras e bicos antes de criar relações.</p> : <article className="account-card admin-banner-create"><h3>Nova relação impressora e bico</h3><RelationForm type="nozzle" printers={printerOptions} entities={nozzleOptions} />
          {(nozzleLinks.data ?? []).map((value) => { const row = value as unknown as RecordRow; return <details className="equipment-edit-form" key={`${row.printer_id}:${row.nozzle_id}`}><summary>{printerLabels.get(String(row.printer_id)) ?? "Impressora"} · {nozzleLabels.get(String(row.nozzle_id)) ?? "Bico"} · {field(row, "catalog_status")}</summary><RelationForm row={row} type="nozzle" printers={printerOptions} entities={nozzleOptions} /></details>; })}
          {(nozzleLinks.count ?? 0) > 250 && <p className="admin-empty">Mostrando 250 relações; as demais não podem ser editadas nesta página.</p>}
        </article>}
      </section>
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Catálogo mestre ViraPeça 3D.</p><span>© 2026 ViraPeça 3D</span></div></footer>
  </>;
}
