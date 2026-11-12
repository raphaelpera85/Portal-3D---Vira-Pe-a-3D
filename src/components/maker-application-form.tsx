"use client";

import { useActionState } from "react";
import { submitMakerApplication, type MakerApplicationState } from "@/app/conta/maker-actions";

const initialState: MakerApplicationState = { message: "", success: false };

export function MakerApplicationForm() {
  const [state, action, pending] = useActionState(submitMakerApplication, initialState);
  return (
    <section className="account-card maker-application-card">
      <span className="account-kicker">PARA QUEM FABRICA</span><h2>Solicite sua loja</h2>
      <p>Conte sobre sua oficina. A equipe revisará as informações antes de liberar a publicação de produtos.</p>
      <form className="auth-form" action={action}>
        <label>Nome da oficina ou marca<input name="businessName" minLength={2} maxLength={80} autoComplete="organization" required /></label>
        <label>O que você fabrica?<textarea name="description" minLength={30} maxLength={1200} rows={4} required /></label>
        <label>Portfólio ou rede social (opcional)<input name="portfolioUrl" type="url" maxLength={500} placeholder="https://" /></label>
        <div className="maker-location-fields">
          <label>Cidade (opcional)<input name="city" maxLength={60} autoComplete="address-level2" /></label>
          <label>UF (opcional)<input name="stateCode" minLength={2} maxLength={2} autoComplete="address-level1" placeholder="SP" /></label>
        </div>
        <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar para análise"}</button>
        <p className={`auth-notice${state.message ? state.success ? " is-success" : " is-error" : ""}`} aria-live="polite">{state.message}</p>
      </form>
    </section>
  );
}
