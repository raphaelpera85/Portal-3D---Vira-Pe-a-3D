"use client";

import { useState } from "react";
import { ImageUp, LoaderCircle } from "lucide-react";
import { MAX_SLICER_OCR_IMAGE_BYTES, MAX_SLICER_OCR_IMAGES, MAX_SLICER_OCR_TOTAL_BYTES } from "@/lib/ocr-image-validation";
import type { parseSlicerOcrTexts } from "@/lib/slicer-ocr";

type Extraction = ReturnType<typeof parseSlicerOcrTexts>;

function validateFiles(files: File[]) {
  if (files.length < 1 || files.length > MAX_SLICER_OCR_IMAGES) return `Selecione de 1 a ${MAX_SLICER_OCR_IMAGES} imagens.`;
  if (files.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type))) return "Use imagens PNG, JPEG ou WebP.";
  if (files.some((file) => file.size < 1 || file.size > MAX_SLICER_OCR_IMAGE_BYTES)) return "Cada imagem precisa ter até 2 MiB.";
  if (files.reduce((total, file) => total + file.size, 0) > MAX_SLICER_OCR_TOTAL_BYTES) return "O conjunto de imagens excede 4 MiB.";
  return null;
}

function errorMessage(code: string) {
  if (code === "ocr_not_configured") return "O OCR ainda não foi conectado ao Google Cloud Vision.";
  if (code === "authentication_required" || code === "maker_account_required") return "Entre em uma conta de fabricante aprovada para usar o OCR.";
  if (code === "ocr_quota_unavailable") return "O limite diário do OCR ainda não está disponível. Confira as migrações do Supabase.";
  if (code === "ocr_daily_limit_reached") return "Você atingiu o limite de 30 imagens de OCR por dia. Tente novamente amanhã.";
  if (code === "ocr_provider_failed") return "O serviço de leitura não conseguiu processar as imagens. Tente novamente ou continue manualmente.";
  if (code === "invalid_image_count") return "Selecione de 1 a 3 imagens válidas.";
  if (code === "image_too_large" || code === "images_too_large") return "Reduza o tamanho das imagens e tente novamente.";
  if (code === "invalid_multipart_request") return "Não foi possível ler os arquivos selecionados. Tente selecionar as imagens novamente.";
  return code;
}

export function SlicerImageImporter({ enabled, configured, onApply }: {
  enabled: boolean; configured: boolean; onApply: (extraction: Extraction) => boolean | null;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  function selectFiles(nextFiles: File[]) {
    const validation = validateFiles(nextFiles);
    setFiles(validation ? [] : nextFiles);
    setExtraction(null);
    setStatus("");
    setError(validation ?? "");
  }

  async function readImages() {
    if (!enabled || !configured || !agreed) return;
    const validation = validateFiles(files);
    if (validation) { setError(validation); return; }
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const form = new FormData();
      files.forEach((file) => form.append("images", file));
      const response = await fetch("/api/ocr/slicer", { method: "POST", body: form });
      const data = await response.json().catch(() => null) as { extraction?: Extraction; error?: string } | null;
      if (!response.ok || !data?.extraction) throw new Error(errorMessage(data?.error ?? "ocr_provider_failed"));
      setExtraction(data.extraction);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível ler as imagens.");
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    if (!extraction) return;
    const applied = onApply(extraction);
    if (applied !== null) setStatus(applied ? "Valores identificados preenchidos. Revise tudo antes de calcular." : "Nenhum valor seguro para preencher; confira os dados reconhecidos ou informe manualmente.");
  }

  return <section className="price-card slicer-ocr-card" aria-labelledby="slicer-ocr-title">
    <div className="price-card-heading"><span className="price-step"><ImageUp size={15} aria-hidden="true" /></span><div><h2 id="slicer-ocr-title">Ler imagem do fatiador</h2><p>Extraia peso, tempo e outras informações para revisar antes de usar no cálculo.</p></div></div>
    {!enabled ? <p className="price-ocr-note">Entre em uma conta de fabricante aprovada para usar a leitura de imagens.</p> : !configured ? <p className="price-ocr-note">O serviço de OCR ainda não está configurado. O preenchimento manual continua disponível.</p> : <>
      <label className="price-ocr-file">Adicionar capturas de tela<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} aria-describedby="ocr-privacy-note" /><small>PNG, JPEG ou WebP · até 3 imagens, 2 MiB por imagem e 4 MiB no total.</small></label>
      {files.length > 0 && <ul className="price-ocr-files">{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name} · {file.type.replace("image/", "").toUpperCase()}</span><small>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(file.size / 1024)} KB</small></li>)}</ul>}
      <label className="price-ocr-consent"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> <span id="ocr-privacy-note">Autorizo o envio dessas imagens ao Google Cloud Vision para leitura. O ViraPeça não as armazena.</span></label>
      <button className="button button-secondary" type="button" onClick={readImages} disabled={loading || !files.length || !agreed}>{loading ? <><LoaderCircle size={15} className="spin" /> Lendo…</> : "Ler dados das imagens"}</button>
      {error && <p className="auth-notice is-error" role="alert">{error}</p>}
      {status && <p className="auth-notice is-success" role="status">{status}</p>}
      {extraction && <div className="price-ocr-result" aria-live="polite">
        <div className="price-ocr-result-heading"><strong>{extraction.slicer}</strong>{extraction.materials.length > 0 && <span>{extraction.materials.join(" · ")}</span>}</div>
        <dl>
          <div><dt>Peso do modelo</dt><dd>{extraction.modelGrams == null ? "Não identificado" : `${extraction.modelGrams.toLocaleString("pt-BR")} g`}</dd></div>
          <div><dt>Suportes</dt><dd>{extraction.supportGrams == null ? "Não identificado" : `${extraction.supportGrams.toLocaleString("pt-BR")} g`}</dd></div>
          <div><dt>Peso total</dt><dd>{extraction.totalGrams == null ? "Não identificado" : `${extraction.totalGrams.toLocaleString("pt-BR")} g`}</dd></div>
          <div><dt>Purga</dt><dd>{extraction.purgeGrams == null ? "Não identificado" : `${extraction.purgeGrams.toLocaleString("pt-BR")} g`}</dd></div>
          <div><dt>Torre de limpeza</dt><dd>{extraction.wipeTowerGrams == null ? "Não identificado" : `${extraction.wipeTowerGrams.toLocaleString("pt-BR")} g`}</dd></div>
          <div><dt>Comprimento</dt><dd>{extraction.lengthMeters == null ? "Não identificado" : `${extraction.lengthMeters.toLocaleString("pt-BR")} m`}</dd></div>
          <div><dt>Tempo</dt><dd>{extraction.printHours == null ? "Não identificado" : `${extraction.printHours.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h`}</dd></div>
          <div><dt>Trocas</dt><dd>{extraction.filamentChanges ?? "Não identificado"}</dd></div>
          <div><dt>Custo reconhecido</dt><dd>{extraction.estimatedCost == null ? "Não identificado" : `${extraction.estimatedCost.toLocaleString("pt-BR")} · confirme a moeda`}</dd></div>
        </dl>
        {extraction.filaments.length > 0 && <div className="price-ocr-filaments"><strong>Consumo por filamento</strong><ul>{extraction.filaments.map((filament) => <li key={filament.index}><span>Filamento {filament.index}{filament.material ? ` · ${filament.material}` : ""}{filament.color ? ` · ${filament.color}` : ""}</span><b>{filament.grams == null ? "—" : `${filament.grams.toLocaleString("pt-BR")} g`}{filament.lengthMeters == null ? "" : ` · ${filament.lengthMeters.toLocaleString("pt-BR")} m`}</b></li>)}</ul></div>}
        {extraction.derivedMass && <p className="price-ocr-note">O total foi somado do peso do modelo e dos suportes. Purga e torre aparecem separadas e não são somadas automaticamente.</p>}
        {(extraction.purgeGrams != null || extraction.wipeTowerGrams != null) && <p className="price-ocr-note">Confira se purga e torre já estão incluídas no peso total do fatiador antes de usar o consumo no cálculo; o portal não as soma novamente.</p>}
        {extraction.conflicts.length > 0 && <p className="price-ocr-conflict" role="alert">Valores divergentes entre imagens: {extraction.conflicts.join(", ")}. Eles foram deixados sem preenchimento.</p>}
        {extraction.text && <details className="price-ocr-text"><summary>Conferir texto reconhecido</summary><pre>{extraction.text}</pre></details>}
        <button className="button button-primary" type="button" onClick={apply}>Revisar e preencher dados</button>
      </div>}
    </>}
  </section>;
}
