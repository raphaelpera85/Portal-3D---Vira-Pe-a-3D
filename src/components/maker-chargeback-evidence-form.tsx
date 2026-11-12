"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createChargebackEvidenceUploads, discardChargebackEvidenceUploads, submitChargebackEvidence } from "@/app/painel/maker/financeiro/evidence-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { validateChargebackEvidence } from "@/lib/chargeback-evidence";

type PreparedUpload = { idempotencyKey: string; uploads: { path: string; name: string; type: string; size: number }[] };

export function MakerChargebackEvidenceForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [prepared, setPrepared] = useState<PreparedUpload | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

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
    let batch: PreparedUpload | null = null;
    try {
      const tokens = await createChargebackEvidenceUploads(caseId, files.map(({ name, type, size }) => ({ name, type, size })));
      if (!tokens.success) { setMessage(tokens.message); return; }
      const preparedBatch: PreparedUpload = { idempotencyKey: tokens.idempotencyKey, uploads: tokens.uploads.map(({ path, name, type, size }) => ({ path, name, type, size })) };
      batch = preparedBatch;
      const client = createSupabaseBrowserClient();
      if (!client) throw new Error("storage");
      for (let index = 0; index < files.length; index += 1) {
        setMessage(`Enviando arquivo ${index + 1} de ${files.length} para armazenamento privado…`);
        const { error } = await client.storage.from("chargeback-evidence").uploadToSignedUrl(
          tokens.uploads[index].path, tokens.uploads[index].token, files[index], { contentType: files[index].type },
        );
        if (error) throw new Error("upload");
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
      <button className="button button-secondary" type="button" onClick={() => void prepareAndSend()} disabled={pending}>{pending ? "Preparando…" : "Enviar comprovantes"}</button>
    </>}
    {message && <p className="auth-notice" role="status" aria-live="polite">{message}</p>}
  </div>;
}
