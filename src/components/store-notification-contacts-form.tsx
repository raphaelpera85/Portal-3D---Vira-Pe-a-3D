"use client";

import { useActionState } from "react";
import { saveStoreNotificationContacts, type StoreNotificationContactState } from "@/app/painel/maker/actions";

const initialState: StoreNotificationContactState = { message: "", success: false };

export function StoreNotificationContactsForm({ email, whatsapp, whatsappOptIn }: { email: string; whatsapp: string | null; whatsappOptIn: boolean }) {
  const [state, action, pending] = useActionState(saveStoreNotificationContacts, initialState);
  return <section className="account-card maker-listing-card">
    <span className="account-kicker">AVISOS DE PEDIDOS E ORÇAMENTOS</span><h2>Seus contatos</h2>
    <p>Solicitações de compra e orçamento aparecem no painel e enviamos avisos para estes contatos. O WhatsApp exige consentimento.</p>
    <form className="auth-form" action={action}>
      <label>E-mail para notificações<input name="email" type="email" maxLength={254} autoComplete="email" defaultValue={email} required /></label>
      <label>WhatsApp com DDD<input name="whatsapp" type="tel" maxLength={24} autoComplete="tel" placeholder="(11) 99999-0000" defaultValue={whatsapp ?? ""} /></label>
      <label className="quote-consent"><input name="whatsappOptIn" type="checkbox" defaultChecked={whatsappOptIn} /> Autorizo receber no WhatsApp avisos sobre solicitações feitas à minha loja.</label>
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar contatos"}</button>
      <p className={`auth-notice${state.message ? state.success ? " is-success" : " is-error" : ""}`} aria-live="polite">{state.message}</p>
    </form>
  </section>;
}
