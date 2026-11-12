import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { reviewPrinterModelSuggestionAction, savePrinterModelAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catálogo mestre de impressoras | ViraPeça 3D", robots: { index: false, follow: false } };

type PrinterModelRecord = Record<string, string | number | boolean | null | Record<string, unknown>> & { id: string };
const field = (model: PrinterModelRecord | undefined, name: string) => model?.[name] == null ? "" : String(model[name]);
const notices: Record<string, string> = {
  salvo: "Modelo de impressora salvo.",
  "sugestao-aprovada": "Sugestão aprovada e vinculada ao catálogo. Se o modelo for novo, ele entra como rascunho para revisão técnica.",
  "sugestao-recusada": "Sugestão recusada.",
  "sugestao-analisada": "Essa sugestão já foi analisada por outro administrador.",
  erro: "Não foi possível salvar. Confira os campos, a URL de fonte e a migração do catálogo técnico.",
};

function PrinterModelForm({ model }: { model?: PrinterModelRecord }) {
  return <form action={savePrinterModelAction} className="printer-model-form">
    {model && <input type="hidden" name="modelId" value={model.id} />}
    <label>Fabricante<input name="manufacturer" minLength={1} maxLength={100} defaultValue={field(model, "manufacturer")} required /></label>
    <label>Modelo<input name="model" minLength={1} maxLength={120} defaultValue={field(model, "model")} required /></label>
    <label>Variante<input name="variant" maxLength={80} defaultValue={field(model, "variant") || "standard"} /></label>
    <label>Ano de lançamento<input name="modelYear" type="number" min="1970" max="2100" step="1" defaultValue={field(model, "model_year")} /></label>
    <label>Tecnologia<select name="technology" defaultValue={field(model, "technology") || "FDM"}><option>FDM</option><option>SLA</option><option>MSLA</option><option>DLP</option></select></label>
    <label>Status<select name="catalogStatus" defaultValue={field(model, "catalog_status") || "draft"}><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="archived">Arquivado</option></select></label>
    <label>Volume X (mm)<input name="buildVolumeX" type="number" min="0.01" step="any" defaultValue={field(model, "build_volume_x_mm")} /></label>
    <label>Volume Y (mm)<input name="buildVolumeY" type="number" min="0.01" step="any" defaultValue={field(model, "build_volume_y_mm")} /></label>
    <label>Volume Z (mm)<input name="buildVolumeZ" type="number" min="0.01" step="any" defaultValue={field(model, "build_volume_z_mm")} /></label>
    <label>Extrusores<input name="extruderCount" type="number" min="1" step="1" defaultValue={field(model, "extruder_count")} /></label>
    <label>Diâmetro do filamento (mm)<input name="filamentDiameter" type="number" min="0.01" step="any" defaultValue={field(model, "filament_diameter_mm")} /></label>
    <label>Interface do bico<input name="nozzleInterface" maxLength={120} defaultValue={field(model, "nozzle_interface")} /></label>
    <label>Diâmetro do bico original (mm)<input name="originalNozzleDiameter" type="number" min="0.01" step="any" defaultValue={field(model, "original_nozzle_diameter_mm")} /></label>
    <label>Temperatura máxima do bico (°C)<input name="maxNozzleTemperature" type="number" min="0.01" step="any" defaultValue={field(model, "max_nozzle_temperature_c")} /></label>
    <label>Temperatura máxima da mesa (°C)<input name="maxBedTemperature" type="number" min="0.01" step="any" defaultValue={field(model, "max_bed_temperature_c")} /></label>
    <label>Mesa aquecida<select name="heatedBed" defaultValue={field(model, "heated_bed")}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select></label>
    <label>Câmara fechada<select name="enclosure" defaultValue={field(model, "enclosure")}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select></label>
    <label>Velocidade máxima anunciada (mm/s)<input name="maxPrintSpeed" type="number" min="0.01" step="any" defaultValue={field(model, "max_print_speed_mm_s")} /></label>
    <label>Potência nominal máxima (W)<input name="maximumPower" type="number" min="0.01" step="any" defaultValue={field(model, "maximum_power_w")} /></label>
    <label>Potência média medida (W)<input name="measuredAveragePower" type="number" min="0.01" step="any" defaultValue={field(model, "measured_average_power_w")} /></label>
    <label>Condições da medição<input name="averagePowerConditions" maxLength={500} defaultValue={field(model, "average_power_conditions")} /></label>
    <label>Sistema multicolorido<input name="multicolorSystem" maxLength={100} defaultValue={field(model, "multicolor_system")} /></label>
    <label>Quantidade de filamentos multicoloridos<input name="multicolorFilamentCount" type="number" min="2" step="1" defaultValue={field(model, "multicolor_filament_count")} /></label>
    <label>Documentação HTTPS<input name="documentationUrl" type="url" maxLength={2048} defaultValue={field(model, "documentation_url")} /></label>
    <label>Fonte das especificações HTTPS<input name="sourceUrl" type="url" maxLength={2048} defaultValue={field(model, "source_url")} /></label>
    <label>Conferido em<input name="verifiedAt" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={field(model, "verified_at")} /></label>
    <label className="printer-model-json">Outras especificações (objeto JSON)<textarea name="technicalProperties" rows={5} defaultValue={JSON.stringify(model?.technical_properties ?? {}, null, 2)} /></label>
    <button className="button button-primary" type="submit">{model ? "Salvar modelo" : "Cadastrar modelo"}</button>
  </form>;
}

export default async function PrinterCatalogAdminPage({ searchParams }: { searchParams: Promise<{ resultado?: string; pagina?: string }> }) {
  const [{ resultado, pagina }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const requestedPage = typeof pagina === "string" && /^[1-9]\d{0,3}$/.test(pagina) ? Number(pagina) : 1;
  const pageSize = 30;
  const [models, suggestions] = await Promise.all([
    actor.supabase.from("printer_models").select("*", { count: "exact" }).order("manufacturer").order("model").range((requestedPage - 1) * pageSize, requestedPage * pageSize - 1),
    actor.supabase.from("printer_model_suggestions").select("id, suggested_by, manufacturer, model, variant, technology, source_url, notes, created_at").eq("status", "pending").order("created_at").limit(100),
  ]);
  const pages = Math.max(1, Math.ceil((models.count ?? 0) / pageSize));
  if (requestedPage > pages) redirect(`/admin/catalogos/impressoras?pagina=${pages}`);

  return <>
    <SiteHeader />
    <main className="admin-dashboard shell">
      <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
      <nav className="admin-catalog-links" aria-label="Catálogos técnicos"><Link aria-current="page" href="/admin/catalogos/impressoras">Impressoras</Link><Link href="/admin/catalogos/materiais">Materiais e resinas</Link><Link href="/admin/catalogos/bicos">Bicos e compatibilidade</Link></nav>
      <div className="account-heading maker-dashboard-heading"><p className="eyebrow">CURADORIA TÉCNICA</p><h1>Impressoras</h1><p>Cadastre especificações com fonte e data de conferência. Só publique registros verificados.</p></div>
      {resultado && notices[resultado] && <p className={`auth-notice ${resultado === "erro" ? "is-error" : "is-success"}`} role="status">{notices[resultado]}</p>}
      <section className="account-card admin-banner-create"><div className="admin-section-title"><span className="account-kicker">NOVO REGISTRO</span><h2>Adicionar impressora</h2></div><PrinterModelForm /></section>
      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">CURADORIA DA COMUNIDADE</span><h2>Sugestões de fabricantes</h2></div>
        {suggestions.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar sugestões. Confira a migração 022.</p> : !suggestions.data?.length ? <p className="admin-empty">Nenhuma sugestão aguarda revisão.</p> : suggestions.data.map((suggestion) => <article className="admin-review-card" key={suggestion.id}>
          <div><span className="account-kicker">{suggestion.technology} · SUGERIDA EM {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(suggestion.created_at))}</span>
            <h3>{suggestion.manufacturer} {suggestion.model} · {suggestion.variant}</h3>
            <p>Autor: {suggestion.suggested_by}</p>
            {suggestion.source_url && <p>Fonte sugerida: <a href={suggestion.source_url} target="_blank" rel="noreferrer">{suggestion.source_url}</a></p>}
            {suggestion.notes && <p>{suggestion.notes}</p>}
            <p>A aprovação associa o modelo se já existir; um modelo novo vira rascunho. Especificações e fonte precisam ser revisadas antes da publicação.</p>
          </div>
          <form action={reviewPrinterModelSuggestionAction}><input type="hidden" name="suggestionId" value={suggestion.id} /><label>Retorno ao fabricante (opcional)<input name="note" maxLength={1000} /></label><div className="admin-review-actions"><button className="button button-primary" name="decision" value="approve" type="submit">Aprovar sugestão</button><button className="button button-secondary" name="decision" value="reject" type="submit">Recusar</button></div></form>
        </article>)}
      </section>
      <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">CATÁLOGO MESTRE</span><h2>Modelos cadastrados</h2></div>
        {models.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar modelos. Confira a migração 002.</p> : !models.data?.length ? <p className="admin-empty">Nenhum modelo cadastrado no banco. As referências locais não são copiadas automaticamente para o catálogo compartilhado.</p> : models.data.map((row) => {
          const model = row as unknown as PrinterModelRecord;
          return <article className="account-card admin-banner-record" key={model.id}>
            <div className="admin-banner-record-heading"><div><span className="account-kicker">{field(model, "catalog_status").toUpperCase()} · {field(model, "technology")}</span><h3>{field(model, "manufacturer")} {field(model, "model")} · {field(model, "variant")}</h3><p>Fonte: {field(model, "source_url") || "não informada"} · conferido: {field(model, "verified_at") || "não informado"}</p></div></div>
            <details className="equipment-edit-form"><summary>Editar especificações</summary><PrinterModelForm model={model} /></details>
          </article>;
        })}
        {(models.count ?? 0) > pageSize && <nav className="catalog-pagination admin-catalog-pagination" aria-label="Paginação dos modelos de impressora"><span>Página {requestedPage} de {pages} · {models.count} modelos</span><div>{requestedPage > 1 && <Link className="button button-secondary" href={`/admin/catalogos/impressoras?pagina=${requestedPage - 1}`}>Anterior</Link>}{requestedPage < pages && <Link className="button button-secondary" href={`/admin/catalogos/impressoras?pagina=${requestedPage + 1}`}>Próxima</Link>}</div></nav>}
      </section>
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Catálogo mestre ViraPeça 3D.</p><span>© 2026 ViraPeça 3D</span></div></footer>
  </>;
}
