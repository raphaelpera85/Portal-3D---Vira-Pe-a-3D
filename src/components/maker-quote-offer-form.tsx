"use client";

import { useActionState } from "react";
import { submitProductQuoteOffer, type QuoteOfferState } from "@/app/orcamentos/actions";

const initialState: QuoteOfferState = { message: "", success: false };

export function MakerQuoteOfferForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(submitProductQuoteOffer, initialState);
  return <form className="auth-form quote-offer-form" action={action}>
    <input type="hidden" name="requestId" value={requestId} />
    <label>Valor total (R$)<input name="totalBrl" type="number" min="0.01" max="1000000000" step="0.01" required /></label>
    <label>Prazo de produção (dias)<input name="leadDays" type="number" min="1" max="365" step="1" defaultValue="7" required /></label>
    <label>Condições da proposta (opcional)<textarea name="terms" maxLength={2000} rows={2} /></label>
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar proposta"}</button>
    <p className={`auth-notice${state.message ? state.success ? " is-success" : " is-error" : ""}`} aria-live="polite">{state.message}</p>
  </form>;
}
