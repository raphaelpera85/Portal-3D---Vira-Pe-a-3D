"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArchiveRestore, Download, Trash2, Upload } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { deleteBuyerModelUpload } from "@/app/visualizador/actions";
import { prepareModelUploadFiles, type ModelUploadFile } from "@/lib/model-upload";
import type { ModelDimensions } from "@/lib/model-file";
import { getModelFormat } from "@/lib/model-file";
import { CustomPrintRequestForm } from "@/components/custom-print-request-form";

export type SavedModelUpload = {
  id: string;
  bundle_id: string;
  model_name: string;
  total_bytes: number;
  files: ModelUploadFile[];
  dimensions_mm?: ModelDimensions | null;
  created_at: string;
};

export function ModelUploadManager({ buyerId, files, savedModels, materials, dimensionsMm, today, onLoad, libraryError = false }: {
  buyerId: string | null;
  files: File[];
  savedModels: SavedModelUpload[];
  materials: { id: string; label: string }[];
  dimensionsMm: ModelDimensions | null;
  today: string;
  onLoad: (files: File[]) => Promise<boolean>;
  libraryError?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  async function saveCurrentModel() {
    const prepared = prepareModelUploadFiles(files);
    if (prepared.error || !prepared.files) { setMessage(prepared.error ?? "Selecione um modelo válido."); return; }
    const client = createSupabaseBrowserClient();
    if (!buyerId || !client) { setMessage("Entre na conta para salvar modelos privados."); return; }

    const bundleId = crypto.randomUUID();
    const uploaded: string[] = [];
    const modelName = prepared.files.find((file) => getModelFormat(file.name))!.name;
    setPending(true);
    setProgress(0);
    setMessage("Preparando o envio privado…");
    let uploadId: string | null = null;
    try {
      for (let index = 0; index < files.length; index += 1) {
        const path = `${buyerId}/${bundleId}/${prepared.files[index].storage_name}`;
        setProgress(index + 1);
        const { error } = await client.storage.from("buyer-models").upload(path, files[index], { upsert: false, contentType: files[index].type || "application/octet-stream" });
        if (error) throw new Error("upload");
        uploaded.push(path);
      }
      const { data: registeredId, error } = await client.rpc("register_buyer_model_upload", {
        p_bundle_id: bundleId, p_model_name: modelName, p_total_bytes: files.reduce((sum, file) => sum + file.size, 0), p_files: prepared.files,
      });
      if (error || typeof registeredId !== "string") throw new Error("register");
      uploadId = registeredId;
      if (dimensionsMm) {
        const { error: dimensionsError } = await client.rpc("set_buyer_model_upload_dimensions", {
          p_upload_id: registeredId, p_dimensions_mm: dimensionsMm,
        });
        if (dimensionsError) throw new Error("dimensions");
      }
      setMessage("Modelo salvo na sua biblioteca privada.");
      router.refresh();
    } catch {
      if (uploadId) await client.rpc("delete_buyer_model_upload", { p_upload_id: uploadId });
      const cleanup = uploaded.length ? await client.storage.from("buyer-models").remove(uploaded) : { error: null };
      setMessage(cleanup.error
        ? "O envio não foi concluído e alguns arquivos podem ter ficado sem registro. Eles continuam privados."
        : "Não foi possível salvar o modelo. Confira a conexão e tente novamente.");
    } finally {
      setPending(false);
      setProgress(0);
    }
  }

  async function openSavedModel(model: SavedModelUpload) {
    const client = createSupabaseBrowserClient();
    if (!buyerId || !client) return;
    setPending(true);
    setMessage(`Abrindo ${model.model_name}…`);
    try {
      const downloaded: File[] = [];
      for (const file of model.files) {
        const path = `${buyerId}/${model.bundle_id}/${file.storage_name}`;
        const { data, error } = await client.storage.from("buyer-models").download(path);
        if (error || !data) throw new Error("download");
        downloaded.push(new File([data], file.name, { type: data.type || "application/octet-stream" }));
      }
      if (!await onLoad(downloaded)) throw new Error("model");
      setMessage(`Conjunto ${model.model_name} carregado no visualizador.`);
    } catch {
      setMessage("Não foi possível abrir este conjunto. Verifique se os arquivos ainda estão disponíveis.");
    } finally {
      setPending(false);
    }
  }

  async function removeSavedModel(model: SavedModelUpload) {
    if (!window.confirm(`Excluir permanentemente ${model.model_name} da sua biblioteca?`)) return;
    if (!buyerId) return;
    setPending(true);
    setMessage("Excluindo o conjunto…");
    try {
      const result = await deleteBuyerModelUpload(model.id);
      setMessage(result.message);
      if (result.success) router.refresh();
    } catch {
      setMessage("Não foi possível concluir a exclusão. Atualize a biblioteca e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return <section className="model-library" aria-label="Biblioteca privada de modelos">
    <div className="inspector-section-head"><h2>Biblioteca privada</h2><ArchiveRestore size={16} aria-hidden="true" /></div>
    <p className="model-library-note">Salve o modelo e os arquivos associados na sua conta para abri-los em outro momento. O conjunto inteiro fica privado.</p>
    {libraryError ? <p className="model-library-note" role="alert">A biblioteca privada precisa da migração de armazenamento para funcionar.</p> : buyerId ? files.length > 0 ? <button className="button button-primary model-library-save" type="button" onClick={() => void saveCurrentModel()} disabled={pending} aria-busy={pending}>
      <Upload size={15} aria-hidden="true" /> {pending ? `Enviando ${Math.min(progress, files.length)} de ${files.length}…` : "Salvar conjunto na conta"}
    </button> : <p className="model-library-note">Abra um modelo para habilitar o salvamento.</p> : <p className="model-library-note"><Link href="/conta">Entre em uma conta de comprador</Link> para salvar modelos privados.</p>}
    {message && <p className="model-library-message" role="status" aria-live="polite">{message}</p>}
    {savedModels.length > 0 && <ul className="model-library-list">{savedModels.map((model) => <li key={model.id}>
      <div><strong>{model.model_name}</strong><span>{(model.total_bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB · {model.files.length} arquivo(s){model.dimensions_mm ? ` · ${model.dimensions_mm.x} × ${model.dimensions_mm.y} × ${model.dimensions_mm.z} mm` : ""}</span></div>
      <div className="model-library-actions">
        <button className="viewer-icon-button" type="button" disabled={pending} aria-label={`Abrir ${model.model_name}`} title="Abrir" onClick={() => void openSavedModel(model)}><Download size={15} aria-hidden="true" /></button>
        <button className="viewer-icon-button" type="button" disabled={pending} aria-label={`Excluir ${model.model_name}`} title="Excluir" onClick={() => void removeSavedModel(model)}><Trash2 size={15} aria-hidden="true" /></button>
      </div>
    </li>)}</ul>}
    {buyerId && savedModels.length > 0 && <CustomPrintRequestForm models={savedModels} materials={materials} today={today} />}
  </section>;
}
