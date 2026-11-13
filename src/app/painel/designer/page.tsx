import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { DesignerProfileForm } from "@/components/designer-profile-form";
import { DesignerServiceRequestInbox } from "@/components/designer-service-request-inbox";
import { getUserWithRole } from "@/lib/auth-role.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel do designer | ViraPeça 3D", robots: { index: false, follow: false } };

export default async function DesignerDashboard({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("designer")]);
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { data: profile, error } = await actor.supabase.from("designer_profiles")
    .select("id, slug, display_name, biography, portfolio_url, city, state_code, specialties, status, response_note")
    .eq("user_id", actor.user!.id).maybeSingle();
  const requestsResult = profile ? await actor.supabase.from("designer_service_requests")
    .select("id, title, brief, due_date, reference_url, created_at, status, quote_amount_cents, quote_lead_days, quote_notes, work_started_at, work_completed_at")
    .eq("designer_profile_id", profile.id).in("status", ["pending", "quoted", "accepted", "paid", "in_progress", "completed"]).order("created_at", { ascending: true }).limit(100) : null;
  const requestIds = (requestsResult?.data ?? []).map(({ id }) => id);
  const deliveriesResult = requestIds.length ? await actor.supabase.from("designer_service_deliveries")
    .select("id, request_id, notes, created_at, designer_service_delivery_files(id, file_name, file_size, storage_path)")
    .in("request_id", requestIds) : { data: [], error: null };
  const requests = await Promise.all((requestsResult?.data ?? []).map(async (request) => {
    const delivery = deliveriesResult.data?.find((item) => item.request_id === request.id);
    const files = await Promise.all((delivery?.designer_service_delivery_files ?? []).map(async (file) => {
      const { data } = await actor.supabase!.storage.from("designer-service-deliveries")
        .createSignedUrl(file.storage_path, 3600, { download: file.file_name });
      return { ...file, downloadUrl: data?.signedUrl ?? null };
    }));
    return { ...request, delivery: delivery ? { ...delivery, files } : null };
  }));
  const resultMessages: Record<string, string> = {
    "modelagem-iniciada": "Modelagem iniciada. O comprador já pode acompanhar o andamento.",
    "modelagem-concluida": "Entrega enviada ao comprador.",
    "modelagem-erro": "Não foi possível atualizar o serviço. Confirme o pagamento e tente novamente.",
  };

  return <><SiteHeader /><main className="account-page shell"><Link className="viewer-back-link" href="/conta">← Voltar à conta</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">ESPAÇO DO CRIADOR</p><h1>Seu perfil, <em>seu trabalho.</em></h1><p>Atualize as informações que aparecem no diretório público de designers.</p></div>
    {resultado && resultMessages[resultado] && <p className={`auth-notice ${resultado === "modelagem-erro" ? "is-error" : "is-success"}`} role="status">{resultMessages[resultado]}</p>}
    <p className="maker-finance-link"><Link className="button button-secondary" href="/painel/maker/financeiro">Vendas e financeiro →</Link> <Link className="button button-secondary" href="/suporte">Central de atendimento →</Link></p>
    {error ? <section className="account-card"><h2>Perfil indisponível</h2><p>A migração do cadastro de designers ainda não foi aplicada.</p></section> : profile ? <><DesignerProfileForm profile={profile} /><DesignerServiceRequestInbox requests={requests} error={Boolean(requestsResult?.error || deliveriesResult.error)} /></> : <section className="account-card"><h2>Nenhum perfil encontrado</h2><p><Link href="/conta">Envie seus dados pela página da conta.</Link></p></section>}
  </main></>;
}
