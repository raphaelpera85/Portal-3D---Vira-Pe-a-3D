import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { startSellerOrderPayment } from "@/app/orcamentos/payment-actions";
import { getUserWithRole } from "@/lib/auth-role.server";
import { isMercadoPagoCheckoutUrl } from "@/lib/mercado-pago-payments";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pedidos de modelagem | ViraPeça 3D", robots: { index: false, follow: false } };

export default async function BuyerModelingRequestsPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("buyer")]);
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { data: requests, error } = await actor.supabase.from("designer_service_requests")
    .select("id, title, brief, due_date, reference_url, status, quote_amount_cents, quote_lead_days, quote_notes, created_at")
    .eq("buyer_id", actor.user!.id).order("created_at", { ascending: false }).limit(100);
  const requestIds = (requests ?? []).map((request) => request.id);
  const paymentResult = requestIds.length ? await actor.supabase.from("seller_order_payments")
    .select("id, designer_service_request_id, status, checkout_url, created_at")
    .eq("buyer_id", actor.user!.id).in("designer_service_request_id", requestIds).order("created_at", { ascending: false }) : { data: [], error: null };
  const paymentsByRequest = new Map<string, NonNullable<typeof paymentResult.data>[number]>();
  for (const payment of paymentResult.data ?? []) if (payment.designer_service_request_id && !paymentsByRequest.has(payment.designer_service_request_id)) {
    paymentsByRequest.set(payment.designer_service_request_id, payment);
  }
  const resultMessages: Record<string, string> = {
    "retorno-pagamento": "Retorno recebido. A confirmação pode levar alguns instantes; o status será atualizado aqui.",
    "pagamento-conta-vendedor": "O designer ainda precisa conectar uma conta de recebimento ativa.",
    "pagamento-configurar": "O checkout ainda não está configurado. Tente novamente mais tarde.",
    "pagamento-erro": "Não foi possível iniciar o pagamento. Atualize a página e tente novamente.",
    "pagamento-aguardando": "Estamos confirmando a criação do checkout. Atualize esta página em instantes.",
    "pagamento-email": "Sua conta precisa ter um e-mail confirmado para iniciar o checkout.",
  };

  return <><SiteHeader /><main className="account-page shell designer-buyer-requests">
    <Link className="viewer-back-link" href="/conta">← Voltar à conta</Link>
    <div className="account-heading"><p className="eyebrow">SERVIÇOS CRIATIVOS</p><h1>Pedidos de <em>modelagem.</em></h1><p>Acompanhe os briefings enviados e as propostas recebidas.</p></div>
    {resultado && resultMessages[resultado] && <p className={`auth-notice ${resultado === "retorno-pagamento" ? "is-success" : "is-error"}`} role="status">{resultMessages[resultado]}</p>}
    {paymentResult.error && <p className="auth-notice is-error" role="status">O status do checkout está temporariamente indisponível.</p>}
    {error ? <section className="account-card"><h2>Pedidos indisponíveis</h2><p>A migration de serviços de designers ainda precisa ser aplicada ao Supabase.</p></section>
      : requests?.length ? <div className="designer-service-request-list">{requests.map((request) => {
        const payment = paymentsByRequest.get(request.id);
        const checkoutUrl = payment?.status === "pending" && payment.checkout_url && isMercadoPagoCheckoutUrl(payment.checkout_url) ? payment.checkout_url : null;
        return <article className="account-card designer-service-request-card" key={request.id}>
        <span className="account-kicker">{request.status === "paid" ? "PAGAMENTO CONFIRMADO" : request.status === "accepted" ? "AGUARDANDO PAGAMENTO" : request.status === "quoted" ? "PROPOSTA RECEBIDA" : "AGUARDANDO DESIGNER"}</span>
        <h2>{request.title}</h2><p className="designer-service-brief">{request.brief}</p>
        {request.due_date && <p>Prazo desejado: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${request.due_date}T00:00:00Z`))}</p>}
        {request.reference_url && <a href={request.reference_url} target="_blank" rel="noopener noreferrer">Abrir referência ↗</a>}
        {request.quote_amount_cents && <div className="designer-service-quote-result"><h3>Proposta</h3>
          <p><strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(request.quote_amount_cents! / 100)}</strong> · {request.quote_lead_days} dias</p>
          <p>{request.quote_notes}</p>
          {request.status === "paid" || payment?.status === "paid" ? <p>Pagamento confirmado. O designer pode iniciar o trabalho.</p>
            : checkoutUrl ? <><p>O pagamento está pendente no Mercado Pago.</p><a className="button button-primary" href={checkoutUrl} rel="noreferrer">Continuar pagamento</a></>
            : payment?.status === "creating" ? <p>Estamos preparando o checkout. Atualize a página em instantes.</p>
            : payment && ["partially_refunded", "refunded", "charged_back"].includes(payment.status) ? <p>Este pagamento precisa de atendimento antes de uma nova tentativa.</p>
            : <form action={startSellerOrderPayment} className="auth-form"><input type="hidden" name="designerServiceRequestId" value={request.id} /><button className="button button-primary" type="submit">Aceitar proposta e pagar</button><small>Você será direcionado ao checkout seguro do Mercado Pago.</small></form>}
        </div>}
      </article>})}</div> : <section className="account-card"><h2>Nenhum pedido enviado</h2><p>Escolha um designer no <Link href="/designers">diretório de designers</Link> para iniciar um briefing de modelagem.</p></section>}
  </main></>;
}
