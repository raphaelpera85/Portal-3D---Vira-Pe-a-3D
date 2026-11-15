"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { uploadSupabaseFile } from "@/lib/supabase/upload-progress";
import { SUPPORT_ATTACHMENT_MAX_BYTES, SUPPORT_ATTACHMENT_MAX_COUNT, SUPPORT_ATTACHMENT_MAX_TOTAL_BYTES, validateSupportAttachments } from "@/lib/support-attachments";
import { dispatchSupportReplyNotificationsAction } from "@/app/suporte/actions";

const extensionByType: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function SupportReplyForm({ ticketId, admin = false }: { ticketId: string; admin?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState<number | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = String(data.get("message") ?? "").trim();
    const files = Array.from(data.getAll("attachments")).filter((value): value is File => value instanceof File && value.size > 0);
    const validation = message.length < 1 || message.length > 5000 ? "A mensagem precisa ter entre 1 e 5.000 caracteres." : validateSupportAttachments(files);
    if (validation) { setError(true); setStatus(validation); return; }

    startTransition(async () => {
      setError(false);
      setStatus(files.length ? "Enviando mensagem e anexos…" : "Enviando mensagem…");
      const supabase = createSupabaseBrowserClient();
      if (!supabase) { setError(true); setStatus("O atendimento ainda não está conectado."); return; }

      const { data: messageId, error: replyError } = await supabase.rpc("reply_support_ticket_with_id", { p_ticket_id: ticketId, p_message: message });
      if (replyError || typeof messageId !== "string") { setError(true); setStatus("Não foi possível enviar a resposta."); return; }
      if (admin) await dispatchSupportReplyNotificationsAction();

      const uploaded: string[] = [];
      if (files.length) {
        setAttachmentProgress(0);
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          setAttachmentProgress(null);
          setError(true);
          setStatus("A mensagem foi enviada, mas a sessão expirou antes do envio dos anexos. Tente anexá-los novamente em outra resposta.");
          form.reset();
          router.refresh();
          return;
        }
        const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        let uploadedBytes = 0;
        try {
          for (const file of files) {
            const path = `${ticketId}/${crypto.randomUUID()}.${extensionByType[file.type]}`;
            await uploadSupabaseFile({ bucket: "support-attachments", path, accessToken: session.access_token, file, onProgress: (loaded) => {
              setAttachmentProgress(Math.floor(((uploadedBytes + loaded) / totalBytes) * 100));
            } });
            uploadedBytes += file.size;
            setAttachmentProgress(Math.floor((uploadedBytes / totalBytes) * 100));
            uploaded.push(path);
          }
        } catch {
          if (uploaded.length) await supabase.storage.from("support-attachments").remove(uploaded);
          setAttachmentProgress(null);
          setError(true);
          setStatus("A mensagem foi enviada, mas um anexo falhou. Ela já aparece no histórico; tente anexar os arquivos novamente em outra resposta.");
          form.reset();
          router.refresh();
          return;
        }

        const { error: registerError } = await supabase.rpc("register_support_attachments", {
          p_ticket_id: ticketId,
          p_message_id: messageId,
          p_attachments: files.map((file, index) => ({ path: uploaded[index], name: file.name, contentType: file.type, size: file.size })),
        });
        if (registerError) {
          await supabase.storage.from("support-attachments").remove(uploaded);
          setAttachmentProgress(null);
          setError(true);
          setStatus("A mensagem foi enviada, mas não foi possível registrar os anexos. Ela já aparece no histórico; tente anexar os arquivos novamente em outra resposta.");
          form.reset();
          router.refresh();
          return;
        }
        setAttachmentProgress(null);
      }

      form.reset();
      setStatus(files.length ? "Resposta e anexos enviados." : "Resposta enviada.");
      router.refresh();
    });
  }

  return <form onSubmit={submit} className="auth-form support-reply-form">
    <label>{admin ? "Resposta ao usuário" : "Responder"}<textarea name="message" maxLength={5000} rows={3} required /></label>
    <label>Anexos (opcional)<input name="attachments" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple /><small>Até {SUPPORT_ATTACHMENT_MAX_COUNT} arquivos PDF/JPEG/PNG/WebP · {Math.round(SUPPORT_ATTACHMENT_MAX_BYTES / 1024 / 1024)} MiB por arquivo · {Math.round(SUPPORT_ATTACHMENT_MAX_TOTAL_BYTES / 1024 / 1024)} MiB no total. Arquivos privados para participantes do atendimento.</small></label>
    <button className={`button ${admin ? "button-primary" : "button-secondary"}`} type="submit" disabled={pending}>{pending ? attachmentProgress == null ? "Enviando resposta…" : `Enviando anexos ${attachmentProgress}%…` : "Enviar resposta"}</button>
    {pending && attachmentProgress != null && <progress className="private-upload-progress" value={attachmentProgress} max={100} aria-label="Progresso do envio dos anexos" />}
    {status && <p className={`auth-notice ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>{status}</p>}
  </form>;
}
