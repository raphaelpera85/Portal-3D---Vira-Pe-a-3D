"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import Link from "next/link";
import { Client, handle_file } from "@gradio/client";

const ModelViewer = dynamic(() => import("@/components/model-viewer").then((module) => module.ModelViewer), { ssr: false });
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function TriposrGenerator({ spaceId }: { spaceId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; name: string; today: string } | null>(null);

  function selectFile(selected: File | undefined) {
    setError("");
    setResult(null);
    if (!selected) { setFile(null); return; }
    if (!ACCEPTED_IMAGE_TYPES.has(selected.type)) { setFile(null); setError("Escolha uma imagem PNG, JPEG ou WebP."); return; }
    if (selected.size > MAX_IMAGE_BYTES) { setFile(null); setError("A imagem deve ter até 5 MiB."); return; }
    setFile(selected);
  }

  async function generate() {
    if (!file || !consent || !spaceId || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    setStatus("Conectando ao Hugging Face…");
    let client: Client | undefined;
    try {
      let generatedUrl = "";
      client = await Client.connect(spaceId, {
        events: ["data", "status"],
        status_callback: (space) => setStatus(space.status === "running" ? "Space pronto; iniciando a geração…" : "Acordando o serviço de geração…"),
      });
      const job = client.submit("/generate", [handle_file(file)]);
      for await (const event of job) {
        if (event.type === "status") {
          setStatus(event.stage === "complete" && generatedUrl
            ? "Modelo gerado. Revise a malha antes de imprimir."
            : event.queue && event.position !== undefined
            ? `Na fila do Hugging Face · posição ${event.position + 1}`
            : event.stage === "generating" ? "Gerando a malha 3D…" : "Processando a imagem…");
        } else if (event.type === "data") {
          const download = event.data[1] as { url?: string; orig_name?: string } | null;
          if (!download?.url) throw new Error("Arquivo de saída indisponível");
          generatedUrl = download.url;
          setResult({ url: download.url, name: download.orig_name || "modelo-gerado.glb", today: new Date().toISOString().slice(0, 10) });
          setStatus("Modelo gerado. Revise a malha antes de imprimir.");
        }
      }
      if (!generatedUrl) throw new Error("Arquivo de saída indisponível");
    } catch {
      setError("Não foi possível gerar o modelo agora. A fila gratuita pode estar indisponível ou sem cota; tente novamente mais tarde.");
      setStatus("");
    } finally {
      client?.close();
      setBusy(false);
    }
  }

  return <div className="ai-model-panel">
    {spaceId ? <>
      <label className="ai-model-upload">Imagem de entrada<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectFile(event.target.files?.[0])} /><small>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MiB` : "PNG, JPEG ou WebP · máximo 5 MiB"}</small></label>
      <label className="ai-model-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Autorizo o envio desta imagem ao Hugging Face para processamento pelo TripoSR. A plataforma externa pode processar e reter temporariamente o arquivo conforme suas próprias regras. <Link href="/privacidade">Leia a política de privacidade.</Link></span></label>
      <button className="button button-primary" type="button" disabled={!file || !consent || busy} onClick={generate}>{busy ? "Gerando modelo…" : "Gerar modelo 3D"}</button>
      {status && <p className="ai-model-status" role="status" aria-live="polite">{status}</p>}
      {error && <p className="ai-model-error" role="alert">{error}</p>}
      {result && <section className="ai-model-result" aria-label="Modelo gerado"><ModelViewer buyerId={null} today={result.today} previewUrl={result.url} modelName="Rascunho gerado por IA" readOnly /><a className="button button-secondary" href={result.url} download={result.name}>Baixar modelo GLB</a><p>Este arquivo pode ter faces abertas, espessura insuficiente ou partes desconectadas. Ele não é um 3MF pronto para impressão nem entra automaticamente no catálogo.</p></section>}
    </> : <div className="ai-model-setup"><p>O gerador está aguardando a conexão com o Space do Hugging Face.</p><p>O Space precisa ser publicado e configurado como ZeroGPU antes de receber imagens.</p><Link className="button button-secondary" href="/modelos">Explorar modelos do catálogo</Link></div>}
    <p className="ai-model-limit">Piloto gratuito sujeito à disponibilidade e à cota diária de GPU do Hugging Face. Usuários sem autenticação na plataforma têm uma cota menor. Imagens enviadas vão diretamente do navegador para o Space externo; não use imagens confidenciais.</p>
  </div>;
}
