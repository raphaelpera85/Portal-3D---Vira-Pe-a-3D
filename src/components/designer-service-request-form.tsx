"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createDesignerServiceRequest, type DesignerServiceRequestState } from "@/app/designers/actions";

const initialState: DesignerServiceRequestState = { message: "", success: false };

export function DesignerServiceRequestForm({ slug, today }: { slug: string; today: string }) {
  const [state, action, pending] = useActionState(createDesignerServiceRequest.bind(null, slug), initialState);
  if (state.success) return <section className="designer-service-request account-card" aria-live="polite">
    <p className="auth-notice is-success" role="status">{state.message}</p>
    <Link className="button button-secondary" href="/conta/modelagem">Acompanhar pedido</Link>
  </section>;

  return <form className="designer-service-request auth-form" action={action}>
    <span className="account-kicker">SERVIÇO DE MODELAGEM</span>
    <h2>Conte sua ideia ao designer</h2>
    <p>Descreva o modelo, o uso e os arquivos que precisa receber. O pedido fica privado entre você e este designer.</p>
    <label>O que você precisa?<input name="title" minLength={3} maxLength={120} required placeholder="Ex.: suporte personalizado para luminária" /></label>
    <label>Detalhes do projeto<textarea name="brief" minLength={30} maxLength={2000} rows={5} required placeholder="Descreva a função, dimensões aproximadas, formato de entrega e outros requisitos." /></label>
    <label>Prazo desejado (opcional)<input name="dueDate" type="date" min={today} /></label>
    <label>Link de referência (opcional)<input name="referenceUrl" type="url" maxLength={1000} placeholder="https://…" /></label>
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar pedido de modelagem"}</button>
    {state.message && <p className="auth-notice is-error" role="alert">{state.message}</p>}
  </form>;
}
