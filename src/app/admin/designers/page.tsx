import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { reviewDesignerProfileAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Revisão de designers | ViraPeça 3D", robots: { index: false, follow: false } };
const resultMessages: Record<string, string> = { analisado: "Perfil revisado.", erro: "Não foi possível concluir a revisão." };

export default async function DesignerAdminPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { data, error } = await actor.supabase.from("designer_profiles").select("id, slug, display_name, biography, portfolio_url, city, state_code, specialties, status, response_note, created_at")
    .order("created_at", { ascending: false }).limit(100);
  return <><SiteHeader /><main className="admin-dashboard shell"><Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">CONTROLE DE QUALIDADE</p><h1>Perfis de designers</h1><p>Revise os portfólios antes de publicar no diretório da comunidade.</p></div>
    {resultado && <p className={`auth-notice ${resultado === "erro" ? "is-error" : "is-success"}`} role="status">{resultMessages[resultado] ?? "Ação concluída."}</p>}
    <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">ATÉ 100 MAIS RECENTES</span><h2>Perfis e solicitações</h2></div>
      {error ? <p className="auth-notice is-error">Não foi possível carregar os perfis. Confirme se a migração 029 foi aplicada.</p> : data?.length ? data.map((profile) => <article className="admin-review-card" key={profile.id}>
        <div><span className="account-kicker">{profile.status.toUpperCase()} · {profile.city ? `${profile.city}${profile.state_code ? `/${profile.state_code}` : ""}` : "BRASIL"}</span><h3>{profile.display_name}</h3><p>{profile.biography}</p><p>Especialidades: {profile.specialties.join(", ")}</p>{profile.response_note && <p>Retorno anterior: {profile.response_note}</p>}{profile.portfolio_url && <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer">Abrir portfólio ↗</a>}</div>
        <form action={reviewDesignerProfileAction}><input type="hidden" name="profileId" value={profile.id} /><label>Retorno ao designer (opcional)<input name="note" maxLength={1000} /></label><div className="admin-review-actions">
          {(profile.status === "pending" || profile.status === "rejected") && <><button className="button button-primary" name="decision" value="approved" type="submit">Aprovar perfil</button>{profile.status === "pending" && <button className="button button-secondary" name="decision" value="rejected" type="submit">Solicitar ajustes</button>}</>}
          {profile.status === "published" && <button className="button button-secondary" name="decision" value="suspended" type="submit">Suspender</button>}
          {profile.status === "suspended" && <button className="button button-primary" name="decision" value="reinstated" type="submit">Reativar perfil</button>}
        </div></form>
      </article>) : <p className="admin-empty">Nenhum perfil cadastrado.</p>}
    </section>
  </main></>;
}
