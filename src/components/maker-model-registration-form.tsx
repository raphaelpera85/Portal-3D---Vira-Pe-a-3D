"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CREATOR_MODEL_MAX_UPLOAD_BYTES, normalizeCreatorModelUpload } from "@/lib/creator-model-upload";
import { discardCreatorModelUpload, finalizeCreatorModelUpload, prepareCreatorModelUpload, submitCreatorModel, type CreatorModelUploadPreparation } from "@/app/painel/maker/model-actions";
import { modelShowcaseCategories } from "@/lib/model-showcase";

export function MakerModelRegistrationForm({ availableAssets }: { availableAssets: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const file = (form.elements.namedItem("modelFile") as HTMLInputElement | null)?.files?.[0];
    if (!file || !normalizeCreatorModelUpload(file)) {
      setMessage("Selecione um arquivo 3MF válido de até 50 MiB.");
      return;
    }
    setPending(true);
    setMessage("Preparando envio privado…");
    let upload: Extract<CreatorModelUploadPreparation, { success: true }>["upload"] | null = null;
    try {
      const values = Object.fromEntries([...new FormData(form).entries()].filter(([key]) => key !== "modelFile")) as Record<string, string>;
      const prepared = await prepareCreatorModelUpload(values, { name: file.name, size: file.size, type: file.type });
      if (!prepared.success) { setMessage(prepared.message); return; }
      upload = prepared.upload;
      const client = createSupabaseBrowserClient();
      if (!client) throw new Error("storage");
      setMessage("Enviando o arquivo para armazenamento privado…");
      const { error } = await client.storage.from("creator-model-uploads").uploadToSignedUrl(
        upload.path, upload.token, file, { contentType: "application/octet-stream" },
      );
      if (error) throw new Error("upload");
      const result = await finalizeCreatorModelUpload(upload.id);
      if (!result.success) {
        await discardCreatorModelUpload(upload.id);
        setMessage(result.message);
        return;
      }
      form.reset();
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
        <label>Arquivo 3MF<input name="modelFile" type="file" accept=".3mf,application/vnd.ms-3mfdocument,application/octet-stream" required disabled={pending} /><small>Até {Math.round(CREATOR_MODEL_MAX_UPLOAD_BYTES / 1024 / 1024)} MiB. O arquivo fica privado enquanto aguarda revisão.</small></label>
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
