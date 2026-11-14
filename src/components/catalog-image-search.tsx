"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUp, LoaderCircle, X } from "lucide-react";
import { differenceHash, rankVisualCandidates, type RankedVisualCandidate, type VisualImageCandidate } from "@/lib/visual-image-search";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function CatalogImageSearch({ configured, category, redirectPath = "/modelos", visualIndex = [] }: { configured: boolean; category: string; redirectPath?: string; visualIndex?: VisualImageCandidate[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [localMatches, setLocalMatches] = useState<RankedVisualCandidate[] | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const localSearchAvailable = visualIndex.length > 0;
  const canUpload = configured || localSearchAvailable;

  useEffect(() => {
    if (!image) {
      setImagePreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(image);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  async function searchLocally() {
    if (!image || !localSearchAvailable || localLoading || loading) return;
    setLocalLoading(true);
    setMessage("");
    setError(false);
    setLocalMatches(null);
    try {
      const bitmap = await createImageBitmap(image, { resizeWidth: 9, resizeHeight: 8, resizeQuality: "high" });
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 9;
        canvas.height = 8;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("image_preview_failed");
        context.drawImage(bitmap, 0, 0, 9, 8);
        const hash = differenceHash(context.getImageData(0, 0, 9, 8).data);
        setLocalMatches(rankVisualCandidates(hash, visualIndex, category, 5));
      } finally { bitmap.close(); }
    } catch {
      setError(true);
      setMessage("Não foi possível ler essa imagem neste dispositivo. Tente outra imagem PNG, JPEG ou WebP.");
    } finally { setLocalLoading(false); }
  }

  async function searchWithVision() {
    if (!image || !agreed || loading || localLoading) return;
    setLoading(true);
    setMessage("");
    setError(false);
    setLocalMatches(null);
    try {
      const form = new FormData();
      form.append("image", image);
      form.append("consent", "yes");
      const response = await fetch("/api/catalog/image-search", { method: "POST", body: form });
      const data = await response.json().catch(() => null) as { query?: string; terms?: string[]; error?: string } | null;
      if (!response.ok || !data?.query) throw new Error(data?.error ?? "image_search_provider_failed");
      const params = new URLSearchParams({ q: data.query });
      if (category) params.set("categoria", category);
      window.location.href = `${redirectPath}?${params.toString()}#modelos`;
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "image_search_provider_failed";
      const messages: Record<string, string> = {
        image_search_not_configured: "A busca por reconhecimento ainda não está conectada ao Google Cloud Vision.",
        image_search_quota_unavailable: "A cota diária da busca por imagem não está disponível.",
        image_search_daily_limit_reached: "Limite diário de buscas por imagem atingido. Tente amanhã.",
        image_search_provider_failed: "Não foi possível reconhecer essa imagem. Tente outra foto ou use a busca visual local.",
        invalid_image: "Use uma imagem PNG, JPEG ou WebP de até 2 MiB.",
      };
      setError(true);
      setMessage(messages[code] ?? "Não foi possível buscar por imagem.");
    } finally { setLoading(false); }
  }

  function selectImage(file: File | null) {
    const valid = file && file.size <= MAX_IMAGE_BYTES && IMAGE_TYPES.includes(file.type);
    setImage(valid ? file : null);
    setLocalMatches(null);
    setMessage(file && !valid ? "Use uma imagem PNG, JPEG ou WebP de até 2 MiB." : "");
    setError(Boolean(file && !valid));
  }

  function clearImage() {
    setImage(null);
    setLocalMatches(null);
    setMessage("");
    setError(false);
    fileInputRef.current?.focus();
  }

  return <div className="catalog-image-search">
    <label className="catalog-image-file"><ImageUp size={16} aria-hidden="true" /> Buscar por imagem<input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={!canUpload || loading || localLoading} onChange={(event) => { const file = event.currentTarget.files?.[0] ?? null; selectImage(file); event.currentTarget.value = ""; }} /></label>
    {image && imagePreviewUrl && <span className="catalog-image-selected"><img src={imagePreviewUrl} alt={`Imagem selecionada: ${image.name}`} width="44" height="44" /><span className="catalog-image-name">{image.name}</span><button className="catalog-image-clear" type="button" aria-label={`Remover imagem ${image.name}`} onClick={clearImage} disabled={loading || localLoading}><X size={15} aria-hidden="true" /></button></span>}
    {localSearchAvailable && <button className="catalog-image-submit" type="button" onClick={searchLocally} disabled={!image || localLoading || loading}>{localLoading ? <><LoaderCircle size={14} className="spin" /> Comparando…</> : "Comparar com prévias"}</button>}
    {configured ? <>
      <label className="catalog-image-consent"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> Enviar a imagem ao Google Cloud Vision para reconhecer objetos e encontrar modelos relacionados.</label>
      <button className="catalog-image-submit" type="button" onClick={searchWithVision} disabled={!image || !agreed || loading || localLoading}>{loading ? <><LoaderCircle size={14} className="spin" /> Buscando…</> : "Reconhecer objeto"}</button>
      <small className="catalog-image-note">A comparação local não envia a imagem. O reconhecimento do Google Vision não armazena a imagem no ViraPeça; limite de 5 buscas por IP ao dia.</small>
    </> : localSearchAvailable ? <small className="catalog-image-note">Comparação visual local com as prévias do catálogo; a imagem não sai deste dispositivo. Reconhecimento semântico exige Google Cloud Vision.</small> : <p className="catalog-image-note">Configure Google Cloud Vision para ativar a busca por imagem.</p>}
    {localMatches && <div className="catalog-image-results" role="status">{localMatches.length ? <><strong>Prévias mais parecidas</strong><ol>{localMatches.map((model) => <li key={model.id}><a href={`/modelos/${model.id}`}><img src={model.image} alt="" width="48" height="36" /><span>{model.name}<small>Diferença visual: {model.distance}/64</small></span></a></li>)}</ol><small>Ordenadas pela semelhança com as prévias. Para encontrar o mesmo objeto em outro ângulo, use o reconhecimento do Google Vision.</small></> : <p>Nenhuma prévia teve semelhança suficiente. Tente outra imagem ou use o reconhecimento do objeto, se estiver disponível.</p>}</div>}
    {message && <p className={`catalog-image-note${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>{message}</p>}
  </div>;
}
