"use client";

import Link from "next/link";
import { useState, type ChangeEvent } from "react";
import { copyPublishedModelPrintProfile, deleteModelPrintProfile, saveModelPrintProfile } from "@/app/modelos/actions";
import { mapThreeMfPlateToSlicerMetrics, type SavedSlicerMetrics } from "@/lib/saved-calculation";
import type { ThreeMfSlicePlate } from "@/lib/model-file";
import { mapSlicerOcrMetricsToModelProfile, modelProfileSlicers, modelProfileTypes } from "@/lib/model-print-profiles";
import { slicerColorPresentation, type parseSlicerOcrTexts } from "@/lib/slicer-ocr";
import { SlicerImageImporter } from "./slicer-image-importer";

export type ModelPrintProfileRecord = {
  id: string; profile_name: string; profile_type: string; slicer: string;
  printer_snapshot: string; material_snapshot: string; nozzle_snapshot: string;
  layer_height_mm: number | string | null; infill_percent: number | string | null; wall_count: number | null;
  supports: boolean; orientation: string; scale_percent: number | string; quantity: number;
  slicer_metrics: SavedSlicerMetrics; created_at: string; sharing_scope: "private" | "community" | "official";
  review_status: "draft" | "pending" | "published" | "rejected"; review_note: string | null; isOwner: boolean;
};

const labelType: Record<string, string> = { economic: "Econômico", fast: "Rápido", detailed: "Detalhado", multicolor: "Multicolorido", custom: "Personalizado" };
const scopeLabels = { private: "Particular", community: "Comunitário", official: "Oficial" };
const statusLabels = { draft: "Privado", pending: "Aguardando revisão", published: "Publicado", rejected: "Precisa de ajustes" };
const metricNumber = (value: number | null) => value == null ? "" : String(value);
const filamentLines = (filaments: SavedSlicerMetrics["filaments"]) => filaments.filter((item) => item.color !== null || item.material !== null || item.grams !== null || item.lengthMeters !== null).map((item) => {
  const presentation = slicerColorPresentation(item.color);
  const color = presentation?.cssColor ? presentation.cssColor.startsWith("#") ? presentation.cssColor.toUpperCase() : item.color!.toLowerCase() : "";
  return `${color}; ${item.material ?? ""}; ${metricNumber(item.grams)}; ${metricNumber(item.lengthMeters)}; ${item.index}`;
}).join("\n");

export function ModelPrintProfileManager({ modelSlug, profiles, plates, authenticated, canUseOcr, ocrConfigured, notice }: {
  modelSlug: string; profiles: ModelPrintProfileRecord[]; plates: ThreeMfSlicePlate[]; authenticated: boolean;
  canUseOcr: boolean; ocrConfigured: boolean; notice: string | null;
}) {
  const noticeLabels: Record<string, string> = {
    salvo: "Perfil particular salvo.", enviado: "Perfil enviado para revisão; ele ficará visível à comunidade após aprovação.",
    copiado: "Cópia particular adicionada à sua conta.", retirado: "Perfil removido da comunidade e tornado particular.",
    excluido: "Perfil removido.", erro: "Não foi possível salvar o perfil. Confira os dados e tente novamente.",
  };
  return <section className="shell model-print-profiles" aria-labelledby="model-print-profiles-title">
    <div className="model-print-profiles-heading"><div><p className="eyebrow">DADOS DE PRODUÇÃO</p><h2 id="model-print-profiles-title">Perfis de impressão deste modelo</h2><p>Consulte perfis comunitários e oficiais; seus próprios perfis podem ser particulares ou enviados à comunidade para revisão.</p></div><span>{profiles.length} {profiles.length === 1 ? "perfil" : "perfis"}</span></div>
    {notice && <p className={`auth-notice${notice === "erro" ? " is-error" : ""}`} role={notice === "erro" ? "alert" : "status"}>{noticeLabels[notice] ?? "Ação concluída."}</p>}
    {profiles.length > 0 && <div className="model-print-profile-list">{profiles.map((profile) => <details className="model-print-profile-card" key={profile.id}>
      <summary><span><strong>{profile.profile_name}</strong><small>{scopeLabels[profile.sharing_scope]} · {statusLabels[profile.review_status]} · {labelType[profile.profile_type] ?? profile.profile_type} · {profile.printer_snapshot || "Impressora não informada"} · {profile.material_snapshot || "Material não informado"}</small></span><span>{profile.slicer_metrics.filamentGrams == null ? "Consumo não informado" : `${profile.slicer_metrics.filamentGrams.toLocaleString("pt-BR")} g`}</span></summary>
      <div className="model-print-profile-details"><p>{profile.slicer} · {profile.quantity} peça(s) · {profile.scale_percent}% · {profile.layer_height_mm ?? "camada não informada"} mm</p>{profile.review_note && profile.isOwner && <p>Retorno da equipe: {profile.review_note}</p>}</div>
      {profile.isOwner && profile.sharing_scope !== "official" && <>
        <ModelPrintProfileForm modelSlug={modelSlug} profile={profile} plates={plates} canUseOcr={false} ocrConfigured={ocrConfigured} />
        {(profile.sharing_scope === "private" || ["pending", "rejected"].includes(profile.review_status)) && <form action={deleteModelPrintProfile} onSubmit={(event) => { if (!window.confirm(`Excluir o perfil “${profile.profile_name}”?`)) event.preventDefault(); }}><input type="hidden" name="modelSlug" value={modelSlug} /><input type="hidden" name="profileId" value={profile.id} /><button type="submit" className="model-print-profile-delete">Excluir perfil</button></form>}
      </>}
      {!profile.isOwner && authenticated && profile.sharing_scope !== "private" && profile.review_status === "published" && <form action={copyPublishedModelPrintProfile}><input type="hidden" name="modelSlug" value={modelSlug} /><input type="hidden" name="profileId" value={profile.id} /><button className="button button-secondary" type="submit">Salvar cópia particular</button></form>}
    </details>)}</div>}
    {!authenticated ? <p className="model-print-profiles-login">Entre para salvar um perfil particular ou compartilhar o seu com a comunidade. <Link href="/conta">Acessar conta</Link></p> : <div className="model-print-profile-card model-print-profile-new"><h3>Novo perfil</h3><ModelPrintProfileForm modelSlug={modelSlug} plates={plates} canUseOcr={canUseOcr} ocrConfigured={ocrConfigured} /></div>}
  </section>;
}

function ModelPrintProfileForm({ modelSlug, profile, plates, canUseOcr, ocrConfigured }: { modelSlug: string; profile?: ModelPrintProfileRecord; plates: ThreeMfSlicePlate[]; canUseOcr: boolean; ocrConfigured: boolean }) {
  const [plateIndex, setPlateIndex] = useState("");
  const [ocrMetrics, setOcrMetrics] = useState<SavedSlicerMetrics | null>(null);
  const [slicer, setSlicer] = useState(modelProfileSlicers.includes(profile?.slicer as typeof modelProfileSlicers[number]) ? profile!.slicer : "Manual");
  const [manualOverrideFields, setManualOverrideFields] = useState<string[]>([]);
  const metrics = profile?.slicer_metrics;
  const importedPlateMetrics = plateIndex === "" ? null : mapThreeMfPlateToSlicerMetrics(plates[Number(plateIndex)], Number(plateIndex) + 1);
  const importedMetrics = importedPlateMetrics ? {
    ...importedPlateMetrics,
    filaments: importedPlateMetrics.filaments.map((item) => ({
      ...item, color: item.color && slicerColorPresentation(item.color)?.cssColor ? item.color : null,
    })),
  } : ocrMetrics;
  const formMetrics = importedMetrics ?? metrics;
  const importedMetricsKey = importedMetrics ? JSON.stringify(importedMetrics) : "profile";
  const markManualOverride = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const field = event.currentTarget.name;
    setManualOverrideFields((current) => current.includes(field) ? current : [...current, field]);
  };
  return <form className="model-print-profile-form" action={saveModelPrintProfile}>
    <input type="hidden" name="modelSlug" value={modelSlug} />
    {profile && <input type="hidden" name="id" value={profile.id} />}
    <label>Nome do perfil<input name="name" required minLength={2} maxLength={80} defaultValue={profile?.profile_name ?? ""} placeholder="PLA detalhado 0,20 mm" /></label>
    <label>Tipo<select name="profileType" defaultValue={profile?.profile_type ?? "custom"}>{modelProfileTypes.map((type) => <option key={type} value={type}>{labelType[type]}</option>)}</select></label>
    <label>Fatiador<select name="slicer" value={slicer} onChange={(event) => setSlicer(event.target.value)}>{modelProfileSlicers.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
    <label>Visibilidade<select name="sharingScope" defaultValue={profile?.sharing_scope === "community" ? "community" : "private"}><option value="private">Particular · só para mim</option><option value="community">Comunidade · publicar após revisão</option></select><small>Perfis comunitários aprovados ficam públicos. Não inclua identificadores ou dados pessoais nos campos.</small></label>
    <label>Impressora<input name="printerName" maxLength={120} defaultValue={profile?.printer_snapshot ?? ""} placeholder="Marca e modelo" /></label>
    <label>Material<input name="materialName" maxLength={120} defaultValue={profile?.material_snapshot ?? ""} placeholder="PLA, PETG, resina…" /></label>
    <label>Bico<input name="nozzleName" maxLength={80} defaultValue={profile?.nozzle_snapshot ?? ""} placeholder="0,4 mm" /></label>
    <label>Altura de camada (mm)<input name="layerHeightMm" type="number" min="0.001" max="5" step="0.001" defaultValue={profile?.layer_height_mm ?? ""} /></label>
    <label>Preenchimento (%)<input name="infillPercent" type="number" min="0" max="100" step="0.1" defaultValue={profile?.infill_percent ?? ""} /></label>
    <label>Paredes<input name="wallCount" type="number" min="0" max="100" step="1" defaultValue={profile?.wall_count ?? ""} /></label>
    <label>Orientação<input name="orientation" maxLength={80} defaultValue={profile?.orientation ?? ""} /></label>
    <label>Escala (%)<input name="scalePercent" type="number" min="10" max="300" step="0.1" defaultValue={profile?.scale_percent ?? 100} /></label>
    <label>Quantidade neste perfil<input name="quantity" type="number" min="1" max="1000000" step="1" required defaultValue={profile?.quantity ?? 1} /></label>
    <label className="model-print-profile-checkbox"><input name="supports" type="checkbox" defaultChecked={profile?.supports ?? false} /> Usa suportes</label>
    {canUseOcr && <SlicerImageImporter enabled configured={ocrConfigured} onApply={(extraction) => {
      const detectedSlicer = modelProfileSlicers.find((option) => option === extraction.slicer);
      const nextSlicer = detectedSlicer ?? slicer;
      const nextMetrics = mapSlicerOcrMetricsToModelProfile(extraction, nextSlicer);
      if (!nextMetrics) return false;
      setSlicer(nextSlicer);
      setOcrMetrics(nextMetrics);
      setPlateIndex("");
      setManualOverrideFields([]);
      return true;
    }} />}
    {canUseOcr && <p className="price-ocr-note">O perfil salva métricas de produção e consumo por filamento; o custo estimado mostrado pelo fatiador não é salvo como preço de material.</p>}
    {plates.length > 0 && <label className="model-print-profile-import">Importar dados do arquivo 3MF<select name="plateIndex" value={plateIndex} onChange={(event) => { setPlateIndex(event.target.value); if (event.target.value) setOcrMetrics(null); }}><option value="">Preencher manualmente</option>{plates.map((plate, index) => <option key={`${plate.index ?? index}-${index}`} value={index}>Placa {plate.index ?? index + 1}</option>)}</select><small>A importação preenche a base; campos que você editar depois substituem somente os valores correspondentes.</small></label>}
    <label>Peso do modelo (g)<input key={importedMetricsKey} name="modelGrams" type="number" min="0" max="1000000000" step="0.001" defaultValue={metricNumber(formMetrics?.modelGrams ?? null)} onChange={markManualOverride} /></label>
    <label>Peso dos suportes (g)<input key={importedMetricsKey} name="supportGrams" type="number" min="0" max="1000000000" step="0.001" defaultValue={metricNumber(formMetrics?.supportGrams ?? null)} onChange={markManualOverride} /></label>
    <label>Peso total (g)<input key={importedMetricsKey} name="totalGrams" type="number" min="0" max="1000000000" step="0.001" defaultValue={metricNumber(formMetrics?.totalGrams ?? null)} onChange={markManualOverride} /></label>
    <label>Purga (g)<input key={importedMetricsKey} name="purgeGrams" type="number" min="0" max="1000000000" step="0.001" defaultValue={metricNumber(formMetrics?.purgeGrams ?? null)} onChange={markManualOverride} /></label>
    <label>Torre de limpeza (g)<input key={importedMetricsKey} name="wipeTowerGrams" type="number" min="0" max="1000000000" step="0.001" defaultValue={metricNumber(formMetrics?.wipeTowerGrams ?? null)} onChange={markManualOverride} /></label>
    <label>Consumo total de filamento (g)<input key={importedMetricsKey} name="filamentGrams" type="number" min="0" max="1000000000" step="0.001" defaultValue={metricNumber(formMetrics?.filamentGrams ?? null)} onChange={markManualOverride} /></label>
    <label>Comprimento total (m)<input key={importedMetricsKey} name="lengthMeters" type="number" min="0" max="1000000000" step="0.001" defaultValue={metricNumber(formMetrics?.lengthMeters ?? null)} onChange={markManualOverride} /></label>
    <label>Tempo de impressão (h)<input key={importedMetricsKey} name="printHours" type="number" min="0" max="1000000000" step="0.001" defaultValue={metricNumber(formMetrics?.printHours ?? null)} onChange={markManualOverride} /></label>
    <label>Trocas de filamento<input key={importedMetricsKey} name="filamentChanges" type="number" min="0" max="1000000000" step="1" defaultValue={metricNumber(formMetrics?.filamentChanges ?? null)} onChange={markManualOverride} /></label>
    <label className="model-print-profile-colors">Consumo por cor (opcional)<textarea key={importedMetricsKey} name="filamentLines" rows={3} maxLength={4000} defaultValue={filamentLines(formMetrics?.filaments ?? [])} placeholder="#336699; PLA; 20; 6,2; 3" onChange={markManualOverride} /><small>Até 32 linhas, uma por filamento: cor hexadecimal ou nome simples; material; gramas; metros; número do filamento. Use cor vazia quando o arquivo não a identifica.</small></label>
    <input type="hidden" name="manualOverrideFields" value={manualOverrideFields.join(",")} />
    <input type="hidden" name="importedMetrics" value={importedMetrics ? JSON.stringify(importedMetrics) : ""} />
    <button className="button button-primary model-print-profile-submit" type="submit">{profile?.sharing_scope === "community" && profile.review_status === "published" ? "Atualizar e reenviar para revisão" : profile?.sharing_scope === "community" ? "Salvar e reenviar para revisão" : profile ? "Salvar como particular" : "Salvar perfil"}</button>
  </form>;
}
