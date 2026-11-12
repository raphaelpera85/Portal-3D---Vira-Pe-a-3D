"use client";

import { useActionState } from "react";
import { submitCustomPrintOffer, type QuoteOfferState } from "@/app/orcamentos/actions";

const initialState: QuoteOfferState = { message: "", success: false };

export function MakerCustomPrintOfferForm({ targetId }: { targetId: string }) {
  const [state, action, pending] = useActionState(submitCustomPrintOffer, initialState);
  return <form className="auth-form quote-offer-form" action={action}>
    <input type="hidden" name="targetId" value={targetId} />
    <label>Valor total da proposta (R$)<input name="totalBrl" type="number" min="0.01" max="1000000000" step="0.01" required /></label>
    <label>Prazo estimado de produção (dias)<input name="leadDays" type="number" min="1" max="365" step="1" defaultValue="7" required /></label>
    <label>Condições, material alternativo ou acabamento<textarea name="terms" maxLength={2000} rows={3} /></label>
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar proposta"}</button>
    {state.message && <p className={`auth-notice${state.success ? " is-success" : " is-error"}`} aria-live="polite">{state.message}</p>}
  </form>;
}
