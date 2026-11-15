"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createDesignerServiceDeliveryUploads, discardDesignerServiceDeliveryUploads, submitDesignerServiceDelivery } from "@/app/painel/designer/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { uploadSupabaseFile } from "@/lib/supabase/upload-progress";
import { normalizeDesignerServiceDeliveryFiles } from "@/lib/designer-service-delivery";

type PreparedFile = { path: string; name: string; size: number; extension: string; token: string };

export function DesignerServiceDeliveryForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [prepared, setPrepared] = useState<PreparedFile[] | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);

  async function submit(files: PreparedFile[]) {
    setPending(true);
    try {
      const result = await submitDesignerServiceDelivery(requestId, notes, files.map(({ token: _token, ...file }) => file));
      setMessage(result.message);
      if (result.success) {
        setPrepared(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    } catch {
      setMessage("Não foi possível confirmar a entrega. Tente novamente com os mesmos arquivos.");
    } finally { setPending(false); }
  }

  async function prepare() {
    if (pending) return;
    const files = Array.from(inputRef.current?.files ?? []);
    const valid = normalizeDesignerServiceDeliveryFiles(files);
    if (!valid) { setMessage("Selecione de 1 a 10 arquivos 3D compatíveis, com até 50 MiB cada e 100 MiB no total."); return; }
    setPending(true);
    setMessage("Preparando envio privado…");
    setProgress(0);
    let batch: PreparedFile[] = [];
    try {
      const result = await createDesignerServiceDeliveryUploads(requestId, files.map(({ name, type, size }) => ({ name, type, size })));
      if (!result.success) { setMessage(result.message); return; }
      batch = result.uploads;
      const client = createSupabaseBrowserClient();
      if (!client) throw new Error("storage");
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError || !session) throw new Error("session");
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      let uploadedBytes = 0;
      for (let i = 0; i < files.length; i += 1) {
        setMessage(`Enviando arquivo ${i + 1} de ${files.length} para armazenamento privado…`);
        await uploadSupabaseFile({ bucket: "designer-service-deliveries", path: batch[i].path, signedToken: batch[i].token, accessToken: session.access_token, file: files[i], onProgress: (loaded) => {
          setProgress(Math.floor(((uploadedBytes + loaded) / totalBytes) * 100));
        } });
        uploadedBytes += files[i].size;
        setProgress(Math.floor((uploadedBytes / totalBytes) * 100));
      }
      setPrepared(batch);
      setPending(false);
      await submit(batch);
    } catch {
      if (batch.length) await discardDesignerServiceDeliveryUploads(requestId, batch.map(({ path }) => path));
      setMessage("Não foi possível enviar os arquivos com segurança. Confira a conexão e tente novamente.");
    } finally { setPending(false); }
  }

  async function discard() {
    if (!prepared || pending) return;
    setPending(true);
    await discardDesignerServiceDeliveryUploads(requestId, prepared.map(({ path }) => path));
    setPrepared(null);
    if (inputRef.current) inputRef.current.value = "";
    setMessage("Arquivos temporários removidos.");
    setPending(false);
  }

  return <div className="designer-service-delivery-form auth-form">
    <label>Observações para o comprador<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} disabled={pending} /></label>
    {prepared ? <><p>{prepared.length} arquivo(s) enviado(s) ao armazenamento privado e pronto(s) para entrega.</p>
      <div className="chargeback-evidence-actions">
        <button className="button button-primary" type="button" onClick={() => void submit(prepared)} disabled={pending}>{pending ? "Enviando…" : "Concluir e enviar"}</button>
        <button className="button button-secondary" type="button" onClick={() => void discard()} disabled={pending}>Descartar arquivos</button>
      </div>
    </> : <>
      <label>Arquivos finais<input ref={inputRef} type="file" accept=".stl,.3mf,.obj,.mtl,.gltf,.glb,.step,.stp,.blend,.zip" multiple disabled={pending} />
        <small>STL, 3MF, OBJ, MTL, GLTF, GLB, STEP, STP, BLEND ou ZIP · até 10 arquivos · 50 MiB por arquivo e 100 MiB no total.</small>
      </label>
      <button className="button button-secondary" type="button" onClick={() => void prepare()} disabled={pending}>{pending ? message.startsWith("Enviando arquivo") ? `Enviando ${progress}%…` : "Preparando…" : "Enviar arquivos da modelagem"}</button>
    </>}
    {pending && message.startsWith("Enviando arquivo") && <progress className="private-upload-progress" value={progress} max={100} aria-label="Progresso do envio da entrega" />}
    {message && <p className="auth-notice" role="status" aria-live="polite">{message}</p>}
  </div>;
}
