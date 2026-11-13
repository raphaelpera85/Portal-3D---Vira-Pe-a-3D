import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pedidos de modelagem | ViraPeça 3D", robots: { index: false, follow: false } };

export default async function BuyerModelingRequestsPage() {
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { data: requests, error } = await actor.supabase.from("designer_service_requests")
    .select("id, title, brief, due_date, reference_url, status, quote_amount_cents, quote_lead_days, quote_notes, created_at")
    .eq("buyer_id", actor.user!.id).order("created_at", { ascending: false }).limit(100);

  return <><SiteHeader /><main className="account-page shell designer-buyer-requests">
    <Link className="viewer-back-link" href="/conta">← Voltar à conta</Link>
    <div className="account-heading"><p className="eyebrow">SERVIÇOS CRIATIVOS</p><h1>Pedidos de <em>modelagem.</em></h1><p>Acompanhe os briefings enviados e as propostas recebidas.</p></div>
    {error ? <section className="account-card"><h2>Pedidos indisponíveis</h2><p>A migration de serviços de designers ainda precisa ser aplicada ao Supabase.</p></section>
      : requests?.length ? <div className="designer-service-request-list">{requests.map((request) => <article className="account-card designer-service-request-card" key={request.id}>
        <span className="account-kicker">{request.status === "quoted" ? "PROPOSTA RECEBIDA" : "AGUARDANDO DESIGNER"}</span>
        <h2>{request.title}</h2><p className="designer-service-brief">{request.brief}</p>
        {request.due_date && <p>Prazo desejado: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${request.due_date}T00:00:00Z`))}</p>}
        {request.reference_url && <a href={request.reference_url} target="_blank" rel="noopener noreferrer">Abrir referência ↗</a>}
        {request.status === "quoted" && <div className="designer-service-quote-result"><h3>Proposta inicial</h3>
          <p><strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(request.quote_amount_cents! / 100)}</strong> · {request.quote_lead_days} dias</p>
          <p>{request.quote_notes}</p><p>Esta proposta é informativa. Contratação e pagamento ainda não estão disponíveis neste fluxo.</p>
        </div>}
      </article>)}</div> : <section className="account-card"><h2>Nenhum pedido enviado</h2><p>Escolha um designer no <Link href="/designers">diretório de designers</Link> para iniciar um briefing de modelagem.</p></section>}
  </main></>;
}
