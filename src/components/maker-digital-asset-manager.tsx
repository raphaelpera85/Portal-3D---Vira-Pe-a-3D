"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { registerDigitalAssetAction } from "@/app/painel/maker/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MAX_DIGITAL_MODEL_BYTES, MAX_DIGITAL_PREVIEW_BYTES, validateDigitalAsset, validateDigitalPreview } from "@/lib/digital-assets";

export function MakerDigitalAssetManager({ productId, storeId, personalPriceBrl, status, asset }: {
  productId: string;
  storeId: string;
  personalPriceBrl: number;
  status: string;
  asset?: { file_name: string; has_preview: boolean; commercial_price_brl: number | null } | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const editable = status === "draft";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const file = inputRef.current?.files?.[0];
    const previewFile = previewInputRef.current?.files?.[0];
    const commercialPrice = String(form.get("commercialPriceBrl") ?? "");
    const rightsAccepted = form.get("rightsAccepted") === "on";
    const preview = previewFile ? validateDigitalPreview({ filename: previewFile.name, size: previewFile.size }) : null;
    if (!file || !validateDigitalAsset({ filename: file.name, size: file.size, personalPriceBrl: personalPriceBrl.toFixed(2), commercialPriceBrl: commercialPrice, rightsAccepted })
      || (!asset?.has_preview && !previewFile) || (previewFile && !preview)) {
      setSuccess(false);
      setMessage("Envie o arquivo original STL/3MF e uma prévia GLB de até 20 MB. Confira as licenças e os direitos autorais.");
      return;
    }
    const extension = file.name.toLowerCase().endsWith(".3mf") ? "3mf" : "stl";
    const path = `${storeId}/${productId}/${crypto.randomUUID()}.${extension}`;
    const previewPath = preview ? `${storeId}/${productId}/preview-${crypto.randomUUID()}.glb` : null;
    startTransition(async () => {
      setMessage("Enviando arquivo original e prévia…");
      setSuccess(false);
      const supabase = createSupabaseBrowserClient();
      if (!supabase) { setMessage("O armazenamento não está configurado."); return; }
      const { error: uploadError } = await supabase.storage.from("digital-assets").upload(path, file, { contentType: "application/octet-stream", upsert: false });
      if (uploadError) { setMessage("O upload falhou. Confira a conexão e tente novamente."); return; }
      if (previewFile && previewPath) {
        const { error: previewError } = await supabase.storage.from("digital-assets").upload(previewPath, previewFile, { contentType: "model/gltf-binary", upsert: false });
        if (previewError) {
          await supabase.storage.from("digital-assets").remove([path]);
          setMessage("Não foi possível enviar a prévia GLB. O arquivo original não foi registrado.");
          return;
        }
      }
      const result = await registerDigitalAssetAction(productId, path, file.name, file.size, commercialPrice, rightsAccepted, previewPath);
      if (!result.success) {
        await supabase.storage.from("digital-assets").remove([path, ...(previewPath ? [previewPath] : [])]);
        setMessage(result.message);
        return;
      }
      setSuccess(true);
      setMessage(result.message);
      if (inputRef.current) inputRef.current.value = "";
      if (previewInputRef.current) previewInputRef.current.value = "";
    });
  }

  return <div className="digital-asset-manager">
    <span className="account-kicker">ARQUIVO DIGITAL · {asset ? "CADASTRADO" : "PENDENTE"}</span>
    {asset && <p>STL/3MF: {asset.file_name} · prévia 3D {asset.has_preview ? "disponível" : "pendente"} · licença pessoal {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(personalPriceBrl)}{asset.commercial_price_brl ? ` · licença comercial ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(asset.commercial_price_brl)}` : ""}</p>}
    {editable ? <form onSubmit={submit} className="auth-form">
      <label>Arquivo original STL ou 3MF<input ref={inputRef} type="file" accept=".stl,.3mf,model/stl,application/vnd.ms-package.3dmanufacturing-3dmodel+xml" required /><small>Privado até a compra · máximo {Math.round(MAX_DIGITAL_MODEL_BYTES / 1024 / 1024)} MB. Não envie um modelo de prévia por este campo.</small></label>
      <label>Prévia 3D pública GLB<input ref={previewInputRef} type="file" accept=".glb,model/gltf-binary" required={!asset?.has_preview} /><small>O GLB será visível a qualquer visitante do anúncio; envie uma cópia de prévia sem conteúdo que precise permanecer exclusivo · máximo {Math.round(MAX_DIGITAL_PREVIEW_BYTES / 1024 / 1024)} MB. Gere uma cópia pelo visualizador ViraPeça 3D.</small></label>
      <label>Preço da licença comercial (opcional, R$)<input name="commercialPriceBrl" type="number" min="0.01" max="1000000" step="0.01" defaultValue={asset?.commercial_price_brl ?? ""} placeholder="Deixe em branco para oferecer somente uso pessoal" /></label>
      <label className="quote-consent"><input type="checkbox" name="rightsAccepted" required /><span>Confirmo que possuo os direitos para comercializar este modelo e conceder as licenças informadas.</span></label>
      <button className="button button-secondary" type="submit" disabled={pending}>{pending ? "Enviando…" : asset ? "Salvar arquivo e prévia" : "Enviar arquivo, prévia e registrar licença"}</button>
    </form> : <p>O arquivo e as licenças ficam bloqueados enquanto o anúncio está publicado ou arquivado. Para alterações, solicite a reabertura à equipe.</p>}
    {message && <p className={`auth-notice ${success ? "is-success" : "is-error"}`} role="status">{message}</p>}
  </div>;
}
