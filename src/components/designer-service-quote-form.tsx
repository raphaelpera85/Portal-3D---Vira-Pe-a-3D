"use client";

import { useActionState } from "react";
import { submitDesignerServiceQuote, type DesignerServiceQuoteState } from "@/app/painel/designer/actions";

const initialState: DesignerServiceQuoteState = { message: "", success: false };

export function DesignerServiceQuoteForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(submitDesignerServiceQuote, initialState);
  if (state.success) return <p className="auth-notice is-success" role="status">{state.message}</p>;
  return <form className="auth-form designer-service-quote" action={action}>
    <input type="hidden" name="requestId" value={requestId} />
    <label>Valor total estimado (R$)<input name="totalBrl" type="number" min="0.01" max="1000000000" step="0.01" required /></label>
    <label>Prazo para entrega (dias)<input name="leadDays" type="number" min="1" max="365" step="1" defaultValue="7" required /></label>
    <label>Entregáveis, formatos e condições<textarea name="terms" minLength={20} maxLength={2000} rows={3} required placeholder="Ex.: arquivo STEP e STL, duas revisões incluídas, sem impressão física." /></label>
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar proposta"}</button>
    {state.message && <p className="auth-notice is-error" role="alert">{state.message}</p>}
  </form>;
}
