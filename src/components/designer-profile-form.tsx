"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitDesignerProfile, type DesignerProfileState } from "@/app/conta/designer-actions";

type DesignerProfileValues = {
  slug?: string;
  display_name?: string;
  biography?: string;
  portfolio_url?: string | null;
  city?: string | null;
  state_code?: string | null;
  specialties?: string[];
  status?: "pending" | "published" | "rejected" | "suspended";
  response_note?: string | null;
};

const initialState: DesignerProfileState = { message: "", success: false };
const statusLabels = { pending: "Em análise", published: "Publicado", rejected: "Precisa de ajustes", suspended: "Suspenso" };

export function DesignerProfileForm({ profile }: { profile?: DesignerProfileValues | null }) {
  const [state, action, pending] = useActionState(submitDesignerProfile, initialState);
  const locked = profile?.status === "suspended";
  return (
    <section className="account-card maker-application-card">
      <span className="account-kicker">PORTFÓLIO CRIATIVO</span><h2>{profile ? "Seu perfil de designer" : "Apresente seu trabalho"}</h2>
      {profile?.status && <p className={`designer-status status-${profile.status}`}>Status: {statusLabels[profile.status]}</p>}
      {profile?.response_note && <p className="auth-notice">Retorno da equipe: {profile.response_note}</p>}
      <p>Mostre sua especialidade em modelagem 3D e faça parte do diretório de criadores da ViraPeça. Após a aprovação, nome, apresentação, localização, especialidades e link do portfólio ficam públicos.</p>
      {profile?.status === "published" && <p><Link className="button button-secondary" href={`/designers/${profile.slug}`}>Ver perfil público</Link></p>}
      <form className="auth-form" action={action}>
        <label>Nome público<input name="displayName" defaultValue={profile?.display_name ?? ""} minLength={2} maxLength={80} autoComplete="name" required disabled={locked} /></label>
        <label>Sobre seu trabalho<textarea name="biography" defaultValue={profile?.biography ?? ""} minLength={30} maxLength={1200} rows={5} required disabled={locked} /></label>
        <label>Portfólio ou site (opcional)<input name="portfolioUrl" type="url" defaultValue={profile?.portfolio_url ?? ""} maxLength={500} placeholder="https://" disabled={locked} /></label>
        <div className="maker-location-fields">
          <label>Cidade (opcional)<input name="city" defaultValue={profile?.city ?? ""} maxLength={60} autoComplete="address-level2" disabled={locked} /></label>
          <label>UF (opcional)<input name="stateCode" defaultValue={profile?.state_code ?? ""} minLength={2} maxLength={2} autoComplete="address-level1" placeholder="SP" disabled={locked} /></label>
        </div>
        <label>Especialidades, separadas por vírgula<input name="specialties" defaultValue={profile?.specialties?.join(", ") ?? ""} maxLength={400} placeholder="Miniaturas, modelagem paramétrica" required disabled={locked} /></label>
        {!locked && <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Salvando…" : profile ? "Salvar perfil" : "Enviar para análise"}</button>}
        <p className={`auth-notice${state.message ? state.success ? " is-success" : " is-error" : ""}`} aria-live="polite">{state.message}</p>
      </form>
    </section>
  );
}
