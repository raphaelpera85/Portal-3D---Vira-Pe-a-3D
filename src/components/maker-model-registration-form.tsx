"use client";

import { useEffect, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CREATOR_MODEL_MAX_PREVIEW_BYTES, CREATOR_MODEL_MAX_UPLOAD_BYTES, normalizeCreatorModelPreview, normalizeCreatorModelUpload } from "@/lib/creator-model-upload";
import { differenceHash } from "@/lib/visual-image-search";
import { readThreeMfPackage } from "@/lib/model-file";
import { discardCreatorModelUpload, finalizeCreatorModelUpload, prepareCreatorModelUpload, submitCreatorModel, type CreatorModelUploadPreparation } from "@/app/painel/maker/model-actions";
import { modelShowcaseCategories } from "@/lib/model-showcase";

export function MakerModelRegistrationForm({ availableAssets }: { availableAssets: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInspection, setFileInspection] = useState<Awaited<ReturnType<typeof readThreeMfPackage>> | null>(null);
  const [fileInspectionPending, setFileInspectionPending] = useState(false);
  const [fileInspectionError, setFileInspectionError] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [draggingFile, setDraggingFile] = useState(false);

  useEffect(() => {
    if (!selectedFile) { setFileInspection(null); setFileInspectionError(false); setFileInspectionPending(false); return; }
    let current = true;
    setFileInspection(null);
    setFileInspectionError(false);
    setFileInspectionPending(true);
    void selectedFile.arrayBuffer().then((buffer) => readThreeMfPackage(new Uint8Array(buffer))).then((result) => {
      if (current) setFileInspection(result);
    }).catch(() => {
      if (current) setFileInspectionError(true);
    }).finally(() => {
      if (current) setFileInspectionPending(false);
    });
    return () => { current = false; };
  }, [selectedFile]);

  const detectedColors = fileInspection ? [...new Set([
    ...fileInspection.colors.palette,
    ...fileInspection.colors.objectColors,
    ...fileInspection.colors.componentPaintColors.flat(),
    ...fileInspection.colors.componentPartColors.flat(),
    ...Object.values(fileInspection.colors.namedColors),
    ...fileInspection.colors.paintPaletteColors,
  ])].filter((color) => /^[\da-f]{6}$/i.test(color)).slice(0, 12) : [];

  function selectModelFile(file: File | undefined) {
    if (!file) return;
    if (!normalizeCreatorModelUpload(file)) {
      setSelectedFile(null);
      setFileError("Escolha um arquivo 3MF válido de até 50 MiB.");
      return;
    }
    setSelectedFile(file);
    setFileError("");
  }

  function selectPreview(file: File | undefined) {
    if (!file) return;
    if (!normalizeCreatorModelPreview(file)) {
      setSelectedPreview(null);
      setFileError("Escolha uma capa PNG, JPEG ou WebP de até 5 MiB.");
      return;
    }
    setSelectedPreview(file);
    setFileError("");
  }

  function dropModelFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDraggingFile(false);
    if (pending) return;
    if (event.dataTransfer.files.length > 1) {
      setSelectedFile(null);
      setFileError("Envie apenas um arquivo 3MF por cadastro.");
      return;
    }
    selectModelFile(event.dataTransfer.files[0]);
  }

  async function hashPreview(file: File) {
    const bitmap = await createImageBitmap(file, { resizeWidth: 9, resizeHeight: 8, resizeQuality: "high" });
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 9;
      canvas.height = 8;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("preview_hash_failed");
      context.drawImage(bitmap, 0, 0, 9, 8);
      return differenceHash(context.getImageData(0, 0, 9, 8).data);
    } finally { bitmap.close(); }
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const file = selectedFile;
    const previewFile = selectedPreview;
    if (!file || !normalizeCreatorModelUpload(file)) {
      setFileError("Escolha um arquivo 3MF válido de até 50 MiB.");
      return;
    }
    setPending(true);
    setMessage("Preparando envio privado…");
    let upload: Extract<CreatorModelUploadPreparation, { success: true }>["upload"] | null = null;
    try {
      const values = Object.fromEntries([...new FormData(form).entries()].filter(([key]) => key !== "modelFile" && key !== "previewFile")) as Record<string, string>;
      const previewHash = previewFile ? await hashPreview(previewFile) : null;
      const prepared = await prepareCreatorModelUpload(values, { name: file.name, size: file.size, type: file.type }, previewFile ? { name: previewFile.name, size: previewFile.size, type: previewFile.type } : null, previewHash);
      if (!prepared.success) { setMessage(prepared.message); return; }
      upload = prepared.upload;
      const client = createSupabaseBrowserClient();
      if (!client) throw new Error("storage");
      setMessage("Enviando o arquivo para armazenamento privado…");
      const { error } = await client.storage.from("creator-model-uploads").uploadToSignedUrl(
        upload.path, upload.token, file, { contentType: "application/octet-stream" },
      );
      if (error) throw new Error("upload");
      if (previewFile && !upload.preview) throw new Error("preview_upload");
      if (previewFile && upload.preview) {
        const { error: previewError } = await client.storage.from("creator-model-uploads").uploadToSignedUrl(
          upload.preview.path, upload.preview.token, previewFile, { contentType: upload.preview.contentType },
        );
        if (previewError) throw new Error("preview_upload");
      }
      const result = await finalizeCreatorModelUpload(upload.id);
      if (!result.success) {
        await discardCreatorModelUpload(upload.id);
        setMessage(result.message);
        return;
      }
      form.reset();
      setSelectedFile(null);
      setSelectedPreview(null);
      setMessage(result.message);
      router.refresh();
    } catch {
      if (upload) await discardCreatorModelUpload(upload.id);
      setMessage("Não foi possível enviar o modelo. Confira sua conexão e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return <section id="modelos-3d" className="account-card maker-products-card" aria-labelledby="maker-model-registration-title">
    <span className="account-kicker">COLEÇÃO DA COMUNIDADE</span>
    <h2 id="maker-model-registration-title">Cadastrar modelo 3D</h2>
    <p>Envie um arquivo 3MF para revisão. Após a aprovação, o modelo aparece na coleção pública com autoria e tags.</p>
    <form onSubmit={(event) => void submitUpload(event)} className="auth-form">
      <div className="equipment-form-grid">
        <div className="creator-model-file-field">
          <label className={`creator-model-file-dropzone${draggingFile ? " is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); if (!pending) setDraggingFile(true); }} onDragLeave={() => setDraggingFile(false)} onDrop={dropModelFile}>
            <span>Arquivo 3MF</span>
            <input name="modelFile" type="file" accept=".3mf,application/vnd.ms-3mfdocument,application/octet-stream" required={!selectedFile} disabled={pending} onChange={(event) => { selectModelFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
            <small>{draggingFile ? "Solte o arquivo para selecioná-lo" : `Arraste um 3MF até aqui ou escolha no dispositivo · máximo ${Math.round(CREATOR_MODEL_MAX_UPLOAD_BYTES / 1024 / 1024)} MiB`}</small>
          </label>
          {selectedFile && <div className="creator-model-file-selection"><span>{selectedFile.name} · {(selectedFile.size / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MiB</span><button className="button button-secondary" type="button" disabled={pending} onClick={() => setSelectedFile(null)}>Remover arquivo</button></div>}
          {selectedFile && <div className="creator-model-file-inspection" aria-live="polite">
            {fileInspectionPending ? <small>Lendo metadados locais do 3MF…</small> : fileInspectionError ? <small>Não foi possível ler os metadados deste arquivo. Ele ainda pode ser enviado para revisão.</small> : fileInspection && <>
              <strong>Informações encontradas no arquivo</strong>
              <small>Unidade: {fileInspection.unit ?? "não informada"} · Placas de fatiamento: {fileInspection.slicePlates.length || "não encontradas"}</small>
              {fileInspection.slicePlates.length > 0 && <small>{fileInspection.slicePlates.map((plate, index) => `Placa ${plate.index ?? index + 1}: ${plate.weightGrams == null ? "peso não informado" : `${plate.weightGrams.toLocaleString("pt-BR")} g`}${plate.printTimeSeconds == null ? "" : ` · ${(plate.printTimeSeconds / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h`}`).join("; ")}</small>}
              <small>Cores encontradas nos metadados: {detectedColors.length || "nenhuma"}. Confira a aparência no visualizador após a aprovação.</small>
              {detectedColors.length > 0 && <ul className="creator-model-file-colors" aria-label="Cores encontradas no arquivo">{detectedColors.map((color) => <li key={color}><i style={{ backgroundColor: `#${color}` }} aria-hidden="true" /><code>#{color.toUpperCase()}</code></li>)}</ul>}
            </>}
          </div>}
          <label className="creator-model-preview-file">Capa do modelo (opcional)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={(event) => { selectPreview(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /><small>PNG, JPEG ou WebP · até {Math.round(CREATOR_MODEL_MAX_PREVIEW_BYTES / 1024 / 1024)} MiB. A imagem fica privada até a aprovação.</small></label>
          {selectedPreview && <div className="creator-model-file-selection"><span>{selectedPreview.name} · {(selectedPreview.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB</span><button className="button button-secondary" type="button" disabled={pending} onClick={() => setSelectedPreview(null)}>Remover capa</button></div>}
          {fileError && <p className="auth-notice is-error" role="alert">{fileError}</p>}
          <small>O arquivo fica privado enquanto aguarda revisão.</small>
        </div>
        <label>Nome do modelo<input name="name" minLength={2} maxLength={120} required disabled={pending} /></label>
        <label>Categoria<select name="categorySlug" required defaultValue="" disabled={pending}><option value="" disabled>Escolha uma categoria</option>{modelShowcaseCategories.map(({ name, slug }) => <option value={slug} key={slug}>{name}</option>)}</select></label>
        <label>Criador original<input name="creatorName" minLength={2} maxLength={100} required disabled={pending} /></label>
        <label>Tags separadas por vírgula<input name="tags" maxLength={400} placeholder="ex.: dragão, articulado, brinquedo" required disabled={pending} /></label>
        <label>Link da fonte (opcional)<input name="sourceUrl" type="url" maxLength={2048} placeholder="https://..." disabled={pending} /></label>
      </div>
      <label className="creator-model-rights"><input type="checkbox" name="rightsConfirmed" required disabled={pending} /> Confirmo que tenho os direitos ou autorização para publicar este arquivo e os dados informados.</label>
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar para revisão"}</button>
    </form>
    {message && <p className="auth-notice" role="status" aria-live="polite">{message}</p>}
    {availableAssets.length > 0 && <details className="maker-model-git-assets"><summary>Usar um arquivo já versionado no portal</summary>
      <form action={submitCreatorModel} className="auth-form">
        <div className="equipment-form-grid">
          <label>Arquivo do Git<select name="assetPath" required defaultValue=""><option value="" disabled>Escolha um arquivo 3MF</option>{availableAssets.map((assetPath) => <option value={assetPath} key={assetPath}>{assetPath.split("/").at(-1)}</option>)}</select></label>
          <label>Nome do modelo<input name="name" minLength={2} maxLength={120} required /></label>
          <label>Categoria<select name="categorySlug" required defaultValue=""><option value="" disabled>Escolha uma categoria</option>{modelShowcaseCategories.map(({ name, slug }) => <option value={slug} key={slug}>{name}</option>)}</select></label>
          <label>Criador original<input name="creatorName" minLength={2} maxLength={100} required /></label>
          <label>Tags separadas por vírgula<input name="tags" maxLength={400} required /></label>
          <label>Link da fonte (opcional)<input name="sourceUrl" type="url" maxLength={2048} /></label>
        </div>
        <label className="creator-model-rights"><input type="checkbox" name="rightsConfirmed" required /> Confirmo que tenho autorização para publicar este modelo.</label>
        <button className="button button-secondary" type="submit">Cadastrar arquivo do Git</button>
      </form>
    </details>}
  </section>;
}
