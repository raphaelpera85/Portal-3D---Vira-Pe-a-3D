"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, signUpAction, type AuthActionState } from "@/app/conta/actions";

const initialState: AuthActionState = { message: "", success: false };

export function AuthForms() {
  const [signInState, signIn, signingIn] = useActionState(signInAction, initialState);
  const [signUpState, signUp, signingUp] = useActionState(signUpAction, initialState);

  return (
    <div className="auth-grid">
      <section className="account-card">
        <span className="account-kicker">JÁ TEM CONTA?</span><h2>Entre na sua conta</h2>
        <form className="auth-form" action={signIn}>
          <label>E-mail<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
          <label>Senha<input type="password" name="password" autoComplete="current-password" minLength={8} maxLength={128} required /></label>
          <Link className="account-recovery-link" href="/conta/recuperar-senha">Esqueceu a senha?</Link>
          <button className="button button-primary" type="submit" disabled={signingIn}>{signingIn ? "Entrando…" : "Entrar"}</button>
          <p className={`auth-notice${signInState.message ? " is-error" : ""}`} aria-live="polite">{signInState.message}</p>
        </form>
      </section>
      <section className="account-card account-card-signup">
        <span className="account-kicker">PRIMEIRA VEZ AQUI?</span><h2>Crie seu espaço</h2>
        <form className="auth-form" action={signUp}>
          <label>Como podemos chamar você?<input type="text" name="displayName" autoComplete="name" minLength={2} maxLength={80} required /></label>
          <label>E-mail<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
          <label>Crie uma senha<input type="password" name="password" autoComplete="new-password" minLength={8} maxLength={128} required /><small>Use pelo menos 8 caracteres.</small></label>
          <button className="button button-primary" type="submit" disabled={signingUp}>{signingUp ? "Criando conta…" : "Criar conta"}</button>
          <p className={`auth-notice${signUpState.message ? (signUpState.success ? " is-success" : " is-error") : ""}`} aria-live="polite">{signUpState.message}</p>
        </form>
      </section>
    </div>
  );
}
