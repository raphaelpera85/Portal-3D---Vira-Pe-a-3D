"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createChargebackEvidenceUploads, discardChargebackEvidenceUploads, submitChargebackEvidence } from "@/app/painel/maker/financeiro/evidence-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { uploadSupabaseFile } from "@/lib/supabase/upload-progress";
import { validateChargebackEvidence } from "@/lib/chargeback-evidence";

type PreparedUpload = { idempotencyKey: string; uploads: { path: string; name: string; type: string; size: number }[] };

export function MakerChargebackEvidenceForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [prepared, setPrepared] = useState<PreparedUpload | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);

  async function send(uploads: PreparedUpload) {
    setPending(true);
    setMessage("Enviando comprovantes ao Mercado Pago…");
    try {
      const result = await submitChargebackEvidence(caseId, uploads.idempotencyKey, uploads.uploads);
      setMessage(result.message);
      if (result.success) {
        await discardChargebackEvidenceUploads(caseId, uploads.uploads.map((file) => file.path));
        setPrepared(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    } catch {
      setMessage("Não foi possível confirmar o envio. Você pode repetir com a mesma chave idempotente ou atualizar a tela.");
    } finally {
      setPending(false);
    }
  }

  async function prepareAndSend() {
    if (pending) return;
    const files = Array.from(inputRef.current?.files ?? []);
    const validation = validateChargebackEvidence(files);
    if (validation) { setMessage(validation); return; }
    setPending(true);
    setMessage("Preparando envio privado…");
    setProgress(0);
    let batch: PreparedUpload | null = null;
    try {
      const tokens = await createChargebackEvidenceUploads(caseId, files.map(({ name, type, size }) => ({ name, type, size })));
      if (!tokens.success) { setMessage(tokens.message); return; }
      const preparedBatch: PreparedUpload = { idempotencyKey: tokens.idempotencyKey, uploads: tokens.uploads.map(({ path, name, type, size }) => ({ path, name, type, size })) };
      batch = preparedBatch;
      const client = createSupabaseBrowserClient();
      if (!client) throw new Error("storage");
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError || !session) throw new Error("session");
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      let uploadedBytes = 0;
      for (let index = 0; index < files.length; index += 1) {
        setMessage(`Enviando arquivo ${index + 1} de ${files.length} para armazenamento privado…`);
        await uploadSupabaseFile({ bucket: "chargeback-evidence", path: tokens.uploads[index].path, signedToken: tokens.uploads[index].token, accessToken: session.access_token, file: files[index], onProgress: (loaded) => {
          setProgress(Math.floor(((uploadedBytes + loaded) / totalBytes) * 100));
        } });
        uploadedBytes += files[index].size;
        setProgress(Math.floor((uploadedBytes / totalBytes) * 100));
      }
      setPrepared(preparedBatch);
      setPending(false);
      await send(preparedBatch);
    } catch {
      if (batch) await discardChargebackEvidenceUploads(caseId, batch.uploads.map((file) => file.path));
      setMessage("Não foi possível enviar os arquivos com segurança. Confira a conexão e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  async function discard() {
    if (!prepared || pending) return;
    setPending(true);
    await discardChargebackEvidenceUploads(caseId, prepared.uploads.map((file) => file.path));
    setPrepared(null);
    if (inputRef.current) inputRef.current.value = "";
    setMessage("Arquivos temporários removidos.");
    setPending(false);
  }

  return <div className="chargeback-evidence-form auth-form">
    {prepared ? <>
      <p>{prepared.uploads.length} arquivo(s) pronto(s). Se o envio ficar inconclusivo, tente novamente para repetir a mesma solicitação.</p>
      <div className="chargeback-evidence-actions">
        <button className="button button-secondary" type="button" onClick={() => void send(prepared)} disabled={pending}>{pending ? "Enviando…" : "Enviar comprovantes"}</button>
        <button className="button button-secondary" type="button" onClick={() => void discard()} disabled={pending}>Descartar arquivos</button>
      </div>
    </> : <>
      <label>Comprovantes da venda<input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" multiple disabled={pending} />
        <small>JPG, PNG ou PDF · até 10 arquivos · até 10 MB no total. O Mercado Pago aceita o envio uma única vez por contestação.</small>
      </label>
      <button className="button button-secondary" type="button" onClick={() => void prepareAndSend()} disabled={pending}>{pending ? message.startsWith("Enviando arquivo") ? `Enviando ${progress}%…` : "Preparando…" : "Enviar comprovantes"}</button>
    </>}
    {pending && message.startsWith("Enviando arquivo") && <progress className="private-upload-progress" value={progress} max={100} aria-label="Progresso do envio dos comprovantes" />}
    {message && <p className="auth-notice" role="status" aria-live="polite">{message}</p>}
  </div>;
}
