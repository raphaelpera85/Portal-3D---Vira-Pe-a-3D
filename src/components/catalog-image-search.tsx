"use client";

import { useState } from "react";
import { ImageUp, LoaderCircle } from "lucide-react";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function CatalogImageSearch({ configured, category }: { configured: boolean; category: string }) {
  const [image, setImage] = useState<File | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function search() {
    if (!image || !agreed || loading) return;
    setLoading(true);
    setMessage("");
    setError(false);
    try {
      const form = new FormData();
      form.append("image", image);
      form.append("consent", "yes");
      const response = await fetch("/api/catalog/image-search", { method: "POST", body: form });
      const data = await response.json().catch(() => null) as { query?: string; terms?: string[]; error?: string } | null;
      if (!response.ok || !data?.query) throw new Error(data?.error ?? "image_search_provider_failed");
      const params = new URLSearchParams({ q: data.query });
      if (category) params.set("categoria", category);
      window.location.href = `/?${params.toString()}#produtos`;
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "image_search_provider_failed";
      const messages: Record<string, string> = {
        image_search_not_configured: "A busca por imagem ainda não está conectada ao Google Cloud Vision.",
        image_search_quota_unavailable: "A cota diária da busca por imagem não está disponível.",
        image_search_daily_limit_reached: "Limite diário de buscas por imagem atingido. Tente amanhã.",
        image_search_provider_failed: "Não foi possível reconhecer essa imagem. Tente outra foto ou use a busca por texto.",
        invalid_image: "Use uma imagem PNG, JPEG ou WebP de até 2 MiB.",
      };
      setError(true);
      setMessage(messages[code] ?? "Não foi possível buscar por imagem.");
    } finally { setLoading(false); }
  }

  return <div className="catalog-image-search">
    <label className="catalog-image-file"><ImageUp size={16} aria-hidden="true" /> Buscar por imagem<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!configured || loading} onChange={(event) => { const file = event.target.files?.[0] ?? null; setImage(file && file.size <= MAX_IMAGE_BYTES && ["image/png", "image/jpeg", "image/webp"].includes(file.type) ? file : null); setMessage(file && (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > MAX_IMAGE_BYTES) ? "Use uma imagem PNG, JPEG ou WebP de até 2 MiB." : ""); setError(Boolean(file && (file.size > MAX_IMAGE_BYTES || !["image/png", "image/jpeg", "image/webp"].includes(file.type)))); }} /></label>
    {!configured ? <p className="catalog-image-note">Configure Google Cloud Vision para ativar essa busca.</p> : <>
      {image && <span className="catalog-image-name">{image.name}</span>}
      <label className="catalog-image-consent"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> Enviar a imagem ao Google Cloud Vision para reconhecer objetos e encontrar modelos relacionados.</label>
      <button className="catalog-image-submit" type="button" onClick={search} disabled={!image || !agreed || loading}>{loading ? <><LoaderCircle size={14} className="spin" /> Buscando…</> : "Encontrar modelos"}</button>
      {message && <p className={`catalog-image-note${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>{message}</p>}
      <small className="catalog-image-note">A imagem é enviada ao Google Vision e não fica armazenada pelo ViraPeça. Até 5 buscas por IP ao dia.</small>
    </>}
  </div>;
}
