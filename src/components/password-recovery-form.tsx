"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, updatePasswordAction, type AuthActionState } from "@/app/conta/actions";

const initialState: AuthActionState = { message: "", success: false };

export function PasswordResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialState);
  return <section className="account-card password-recovery-card">
    <span className="account-kicker">RECUPERAR ACESSO</span><h2>Receba um link por e-mail</h2>
    <p>Informe o e-mail da sua conta. Se houver um cadastro, enviaremos as instruções para criar uma nova senha.</p>
    <form className="auth-form" action={action}>
      <label>E-mail<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar link de recuperação"}</button>
      {state.message && <p className={`auth-notice ${state.success ? "is-success" : "is-error"}`} role="status" aria-live="polite">{state.message}</p>}
    </form>
    <Link className="account-recovery-link" href="/conta">Voltar para entrar</Link>
  </section>;
}

export function PasswordUpdateForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initialState);
  return <section className="account-card password-recovery-card">
    <span className="account-kicker">NOVA SENHA</span><h2>Escolha uma senha segura</h2>
    <form className="auth-form" action={action}>
      <label>Nova senha<input type="password" name="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
      <label>Confirme a nova senha<input type="password" name="confirmation" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Salvando…" : "Atualizar senha"}</button>
      {state.message && <p className={`auth-notice ${state.success ? "is-success" : "is-error"}`} role="status" aria-live="polite">{state.message}</p>}
    </form>
    {state.success && <Link className="account-recovery-link" href="/conta">Acessar minha conta</Link>}
  </section>;
}
