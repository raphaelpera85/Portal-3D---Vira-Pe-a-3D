import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { saveMaterialAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catálogo de materiais e resinas | ViraPeça 3D", robots: { index: false, follow: false } };

type RecordRow = Record<string, string | number | boolean | null | unknown[]> & { id: string };
const field = (row: RecordRow | undefined, name: string) => row?.[name] == null ? "" : String(row[name]);
const jsonField = (row: RecordRow | undefined, name: string, fallback: unknown) => JSON.stringify(row?.[name] ?? fallback, null, 2);
const notices: Record<string, string> = { salvo: "Material salvo.", erro: "Não foi possível salvar. Confira fonte, medidas e a migração 002." };

function MaterialForm({ row }: { row?: RecordRow }) {
  return <form action={saveMaterialAction} className="printer-model-form">
    {row && <input type="hidden" name="materialId" value={row.id} />}
    <label>Fabricante<input name="manufacturer" maxLength={100} defaultValue={field(row, "manufacturer")} required /></label>
    <label>Produto<input name="product" maxLength={120} defaultValue={field(row, "product")} required /></label>
    <label>Família<input name="family" maxLength={80} defaultValue={field(row, "family")} required /></label>
    <label>Processo<select name="process" defaultValue={field(row, "process") || "filament"}><option value="filament">Filamento</option><option value="resin">Resina</option></select></label>
    <label>Status<select name="catalogStatus" defaultValue={field(row, "catalog_status") || "draft"}><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="archived">Arquivado</option></select></label>
    <label>Diâmetro do filamento (mm)<input name="filamentDiameter" type="number" min="0.01" step="any" defaultValue={field(row, "filament_diameter_mm")} /></label>
    <label>Densidade (g/cm³)<input name="density" type="number" min="0.0001" step="any" defaultValue={field(row, "density_g_cm3")} /></label>
    <label>Temperatura do bico mínima (°C)<input name="nozzleMin" type="number" min="0.01" step="any" defaultValue={field(row, "nozzle_temperature_min_c")} /></label>
    <label>Temperatura do bico máxima (°C)<input name="nozzleMax" type="number" min="0.01" step="any" defaultValue={field(row, "nozzle_temperature_max_c")} /></label>
    <label>Temperatura da mesa mínima (°C)<input name="bedMin" type="number" min="0" step="any" defaultValue={field(row, "bed_temperature_min_c")} /></label>
    <label>Temperatura da mesa máxima (°C)<input name="bedMax" type="number" min="0" step="any" defaultValue={field(row, "bed_temperature_max_c")} /></label>
    <label>Requer câmara fechada<select name="enclosure" defaultValue={field(row, "requires_enclosure")}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select></label>
    <label>Material abrasivo<select name="abrasive" defaultValue={field(row, "abrasive")}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select></label>
    <label>Compatível com sistema multicolorido<select name="multicolorCompatible" defaultValue={field(row, "multicolor_compatible")}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select></label>
    <label>Secagem requerida<select name="dryingRequired" defaultValue={field(row, "drying_required")}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Opcional</option></select></label>
    <label>Temperatura de secagem (°C)<input name="dryingTemperature" type="number" min="0.01" step="any" defaultValue={field(row, "drying_temperature_c")} /></label>
    <label>Tempo de secagem (h)<input name="dryingHours" type="number" min="0.01" step="any" defaultValue={field(row, "drying_hours")} /></label>
    <label>Velocidade máxima indicada (mm/s)<input name="maxPrintSpeed" type="number" min="0.01" step="any" defaultValue={field(row, "max_print_speed_mm_s")} /></label>
    <label>Comprimento de onda UV da resina (nm)<input name="resinWavelength" type="number" min="0.01" step="any" defaultValue={field(row, "resin_wavelength_nm")} /></label>
    <label>Exposição da resina (s)<input name="resinExposure" type="number" min="0.01" step="any" defaultValue={field(row, "resin_exposure_seconds")} /></label>
    <label>Documentação HTTPS<input name="documentationUrl" type="url" maxLength={2048} defaultValue={field(row, "documentation_url")} /></label>
    <label>Fonte técnica HTTPS<input name="sourceUrl" type="url" maxLength={2048} defaultValue={field(row, "source_url")} /></label>
    <label>Conferido em<input name="verifiedAt" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={field(row, "verified_at")} /></label>
    <label className="printer-model-json">Cores (JSON)<textarea name="colors" rows={4} defaultValue={jsonField(row, "colors", [])} /></label>
    <label className="printer-model-json">Outras propriedades (JSON)<textarea name="technicalProperties" rows={4} defaultValue={jsonField(row, "technical_properties", {})} /></label>
    <button className="button button-primary" type="submit">{row ? "Salvar material" : "Cadastrar material"}</button>
  </form>;
}

export default async function MaterialCatalogAdminPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  // shortcut: only the first 250 records are editable here; add pagination when the catalog exceeds this cap.
  const rows = await actor.supabase.from("material_catalog").select("*", { count: "exact" }).order("manufacturer").order("product").limit(250);
  return <>
    <SiteHeader />
    <main className="admin-dashboard shell">
      <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
      <nav className="admin-catalog-links" aria-label="Catálogos técnicos"><Link href="/admin/catalogos/impressoras">Impressoras</Link><Link aria-current="page" href="/admin/catalogos/materiais">Materiais e resinas</Link><Link href="/admin/catalogos/bicos">Bicos e compatibilidade</Link></nav>
      <div className="account-heading maker-dashboard-heading"><p className="eyebrow">CURADORIA TÉCNICA</p><h1>Materiais e resinas</h1><p>Registre as condições por produto. Campos desconhecidos permanecem vazios; publicar exige fonte HTTPS e data de conferência.</p></div>
      {resultado && notices[resultado] && <p className={`auth-notice ${resultado === "erro" ? "is-error" : "is-success"}`} role="status">{notices[resultado]}</p>}
      <section className="account-card admin-banner-create"><div className="admin-section-title"><span className="account-kicker">NOVO REGISTRO</span><h2>Adicionar material</h2></div><MaterialForm /></section>
      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">CATÁLOGO MESTRE</span><h2>Produtos cadastrados</h2></div>
        {rows.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar produtos. Confira a migração 002.</p> : !rows.data?.length ? <p className="admin-empty">Nenhum material ou resina cadastrado no banco.</p> : rows.data.map((value) => {
          const row = value as unknown as RecordRow;
          return <article className="account-card admin-banner-record" key={row.id}><div className="admin-banner-record-heading"><div><span className="account-kicker">{field(row, "catalog_status").toUpperCase()} · {field(row, "process") === "resin" ? "RESINA" : "FILAMENTO"}</span><h3>{field(row, "manufacturer")} · {field(row, "product")}</h3><p>Fonte: {field(row, "source_url") || "não informada"} · conferido: {field(row, "verified_at") || "não informado"}</p></div></div><details className="equipment-edit-form"><summary>Editar especificações</summary><MaterialForm row={row} /></details></article>;
        })}
        {(rows.count ?? 0) > 250 && <p className="admin-empty">Esta tela mostra os 250 primeiros registros.</p>}
      </section>
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Catálogo mestre ViraPeça 3D.</p><span>© 2026 ViraPeça 3D</span></div></footer>
  </>;
}
