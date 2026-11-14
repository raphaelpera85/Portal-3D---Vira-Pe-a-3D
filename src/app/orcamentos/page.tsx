import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { cancelCustomPrintRequest, cancelProductQuoteRequest, confirmCustomPrintDelivery, confirmSellerPurchaseOrderDelivery, respondToCustomPrintOffer, respondToCustomPrintShippingQuote, respondToProductQuoteOffer, respondToSellerOrderShippingQuote, saveCustomPrintDeliveryAddress, submitMarketplaceReviewAction } from "./actions";
import { cancelPendingSellerPayment, startSellerOrderPayment } from "./payment-actions";
import { downloadDigitalAssetAction } from "./digital-actions";
import { getUserWithRole } from "@/lib/auth-role.server";
import { formatBrl, formatBrlTotal } from "@/lib/money";
import { getCustomPrintEventLabel } from "@/lib/custom-print-events";
import { isMercadoPagoCheckoutUrl } from "@/lib/mercado-pago-payments";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata: Metadata = { title: "Meus pedidos e orçamentos | ViraPeça 3D", robots: { index: false, follow: false } };

const resultMessages: Record<string, string> = {
  solicitado: "Pedido de orçamento enviado ao fabricante.", "compra-solicitada": "Solicitação de compra enviada ao fabricante. Nenhum pagamento foi realizado.", aceita: "Proposta aceita. Nenhum pagamento foi realizado.",
  "pedido-enviado": "Pedidos enviados às lojas. Você receberá as confirmações aqui; nenhum pagamento foi processado.",
  recusada: "Proposta recusada.", cancelada: "Pedido cancelado.", erro: "Não foi possível concluir essa ação. Atualize a página e tente novamente.",
  "pagamento-configurar": "O checkout ainda não está configurado para esta loja. Tente novamente mais tarde.",
  "pagamento-conta-vendedor": "A conta de recebimento da loja precisa ser reconectada antes do pagamento.",
  "pagamento-email": "Sua conta precisa ter um e-mail confirmado para iniciar o checkout.",
  "pagamento-erro": "Não foi possível iniciar o pagamento. Atualize a página e tente novamente.",
  "pagamento-aguardando": "Estamos confirmando a criação do checkout. Atualize esta página em instantes.",
  "pagamento-frete": "Aceite a cotação de frete da loja antes de iniciar o pagamento.",
  "compra-carrinho": "Compras físicas precisam passar pelo carrinho para informar endereço e receber uma proposta de entrega antes do pagamento.",
  "pagamento-cancelado": "Checkout cancelado no Mercado Pago. O estoque reservado foi liberado.",
  "cancelamento-pendente": "O Mercado Pago ainda não confirmou o cancelamento. Atualize a página e tente novamente; a solicitação será repetida com segurança.",
  "cancelamento-indisponivel": "Esta cobrança já está em processamento ou foi concluída e não pode ser cancelada.",
  "cancelamento-dados-invalidos": "Confirme o cancelamento e tente novamente.",
  "download-erro": "O download não está disponível. Confirme o pagamento ou tente novamente.",
  "retorno-pagamento": "Retorno recebido. A confirmação do pagamento pode levar alguns instantes; consulte o status abaixo.",
  "frete-aceito": "Opção de entrega aceita. Você já pode pagar o pedido.", "frete-recusado": "Opção recusada. A loja poderá enviar outra.",
  "frete-erro": "Não foi possível atualizar a cotação de frete. Atualize a página e tente novamente.",
  "pedido-entregue": "Recebimento confirmado. Você pode concluir o pedido quando estiver tudo certo.", "pedido-concluido": "Pedido concluído. Obrigado por comprar no ViraPeça 3D.",
  "entrega-erro": "Não foi possível atualizar o status da entrega.",
  "avaliacao-enviada": "Sua avaliação foi enviada para moderação.", "avaliacao-erro": "Não foi possível enviar a avaliação. Confirme se o pedido foi pago e concluído.",
  "custom-solicitado": "Solicitação enviada às lojas compatíveis. Acompanhe as propostas nesta página.",
  "custom-aceita": "Proposta escolhida. Selecione um endereço para cotar entrega ou aguarde uma opção de retirada local.",
  "custom-recusada": "Proposta recusada.", "custom-cancelada": "Solicitação cancelada e acesso aos arquivos revogado.",
};
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : null;
const offerStatus = (value: string) => ({ offered: "Proposta enviada", accepted: "Aceita", declined: "Recusada" }[value] ?? value);
const requestStatus = (value: string, type: string) => type === "purchase" ? ({ pending: "Aguardando fabricante", accepted: "Disponibilidade confirmada", declined: "Pedido recusado", cancelled: "Cancelado" }[value] ?? value) : ({ pending: "Aguardando proposta", offered: "Proposta recebida", accepted: "Proposta aceita", declined: "Proposta recusada", cancelled: "Cancelado" }[value] ?? value);
type ReviewSource = "cart" | "purchase" | "custom_print";
type BuyerShippingPackage = { order_id: string | null; custom_print_request_id: string | null; package_index: number; packages: { height: number; width: number; length: number; weight: number }[]; status: string; tracking_code: string | null; tracking_url: string | null };
function ReviewForm({ sourceType, sourceId, reviewType, itemId = "", label }: { sourceType: ReviewSource; sourceId: string; reviewType: "product" | "store"; itemId?: string; label: string }) {
  return <form action={submitMarketplaceReviewAction} className="auth-form"><input type="hidden" name="sourceType" value={sourceType} /><input type="hidden" name="sourceId" value={sourceId} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="reviewType" value={reviewType} /><label>Nota<select name="rating" defaultValue="5" required><option value="5">5 · Excelente</option><option value="4">4 · Muito bom</option><option value="3">3 · Bom</option><option value="2">2 · Regular</option><option value="1">1 · Ruim</option></select></label><label>Comentário (opcional)<textarea name="body" maxLength={1200} rows={3} /></label><button className="button button-primary" type="submit">{label}</button></form>;
}
const reviewStatus = (review: { status: string; rating: number }) => `${review.status === "pending" ? "Aguardando moderação" : review.status === "published" ? "Avaliação publicada" : "Avaliação não publicada"} · ${review.rating}/5`;
function PendingPaymentCancellation({ payment }: { payment: { id: string; status: string; cancellations?: { status: string }[] } }) {
  if (payment.status !== "pending") return null;
  const cancellation = payment.cancellations?.[0];
  if (cancellation?.status === "failed") return <p className="quote-small-note">O Mercado Pago informou que esta cobrança não pode mais ser cancelada. Atualize a página para consultar o status.</p>;
  return <details className="seller-refund-details"><summary>Cancelar pagamento pendente</summary><form action={cancelPendingSellerPayment} className="seller-refund-form">
    <label className="seller-refund-confirm"><input type="checkbox" name="confirmCancel" value="yes" required />Confirmo o cancelamento desta cobrança ainda não paga.</label>
    <input type="hidden" name="paymentId" value={payment.id} /><input type="hidden" name="idempotencyKey" value={randomUUID()} />
    <button className="button button-secondary" type="submit">Cancelar checkout</button>
  </form></details>;
}

export default async function BuyerQuotesPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("buyer")]);
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const [addressResult, requestResult, orderResult, customResult] = await Promise.all([
    actor.supabase.from("buyer_addresses").select("id, label, recipient_name, postal_code, street, number, complement, district, city, state_code, reference, is_default").eq("buyer_id", actor.user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    actor.supabase.from("product_quote_requests")
      .select("id, request_type, license_type, product_id, unit_price_brl, product_name, store_name, quantity, customization, due_date, status, created_at, product:marketplace_products(slug), offer:product_quote_offers(id, total_brl, lead_days, terms, status), payments:seller_order_payments(id, status, checkout_url, total_cents, created_at, cancellations:seller_order_payment_cancellations(status)), downloads:digital_asset_downloads(id, created_at)")
      .eq("buyer_id", actor.user.id).order("created_at", { ascending: false }),
    actor.supabase.from("seller_purchase_orders").select("id, store_name, status, created_at, coupon_code, coupon_discount_cents, delivery_recipient_name, delivery_postal_code, delivery_street, delivery_number, delivery_complement, delivery_district, delivery_city, delivery_state_code, delivery_reference, shipping_quote_status, shipping_carrier, shipping_service, shipping_cost_cents, shipping_delivery_days, shipment_status, shipping_tracking_code, shipping_tracking_url, shipping_expected_date, shipping_shipped_at, shipping_delivered_at, completed_at, items:seller_purchase_order_items(id, product_id, product_name, unit_price_brl, quantity), payments:seller_order_payments(id, status, checkout_url, total_cents, created_at, cancellations:seller_order_payment_cancellations(status)), events:seller_purchase_order_events(id, event_type, description, created_at)")
      .eq("buyer_id", actor.user.id).order("created_at", { ascending: false }),
    actor.supabase.from("custom_print_requests").select("id, upload_id, model_name, dimensions_x_mm, dimensions_y_mm, dimensions_z_mm, scale_percent, material_snapshot, quantity, color, quality, due_date, notes, status, winning_store_id, production_started_at, production_completed_at, created_at, offers:custom_print_offers(id, store_name, total_brl, lead_days, terms, status), delivery:custom_print_deliveries(*), payments:seller_order_payments(id, status, checkout_url, total_cents, shipping_cents, created_at, cancellations:seller_order_payment_cancellations(status)), targets:custom_print_request_targets(id, store:stores(name), events:custom_print_request_events(id, event_type, event_data, actor_user_id, created_at))")
      .eq("buyer_id", actor.user.id).order("created_at", { ascending: false }),
  ]);
  const addresses = addressResult.data ?? [];
  const { data, error } = requestResult;
  const orders = orderResult.data ?? [];
  const customRequests = customResult.data ?? [];
  const { data: shippingPackages } = await actor.supabase.rpc("get_shipping_label_packages") as unknown as { data: BuyerShippingPackage[] | null };
  const shippingPackagesByOrder = new Map(orders.map((order) => [order.id,
    (shippingPackages ?? []).filter((parcel) => parcel.order_id === order.id)]));
  const shippingPackagesByCustomPrint = new Map(customRequests.map((request) => [request.id,
    (shippingPackages ?? []).filter((parcel) => parcel.custom_print_request_id === request.id)]));
  const purchaseIds = (data ?? []).filter((request) => request.request_type === "purchase").map((request) => request.id);
  const [cartReviews, purchaseReviews, customPrintReviews] = await Promise.all([
    orders.length ? actor.supabase.from("marketplace_reviews").select("id, order_id, order_item_id, purchase_request_id, custom_print_request_id, review_type, rating, status").in("order_id", orders.map((order) => order.id)) : Promise.resolve({ data: [], error: null }),
    purchaseIds.length ? actor.supabase.from("marketplace_reviews").select("id, order_id, order_item_id, purchase_request_id, custom_print_request_id, review_type, rating, status").in("purchase_request_id", purchaseIds) : Promise.resolve({ data: [], error: null }),
    customRequests.length ? actor.supabase.from("marketplace_reviews").select("id, order_id, order_item_id, purchase_request_id, custom_print_request_id, review_type, rating, status").in("custom_print_request_id", customRequests.map((request) => request.id)) : Promise.resolve({ data: [], error: null }),
  ]);
  const reviewsUnavailable = Boolean(cartReviews.error || purchaseReviews.error || customPrintReviews.error);
  const reviews = [...(cartReviews.data ?? []), ...(purchaseReviews.data ?? []), ...(customPrintReviews.data ?? [])];

  return <>
    <SiteHeader />
    <main className="account-page shell quote-page">
      <Link className="viewer-back-link" href="/">← Voltar para o início</Link>
      <div className="account-heading"><p className="eyebrow">ÁREA DO COMPRADOR</p><h1>Meus pedidos e orçamentos</h1><p>Acompanhe solicitações e propostas dos fabricantes.</p></div>
      {resultado && resultMessages[resultado] && <p className={`auth-notice ${["erro", "pagamento-configurar", "pagamento-conta-vendedor", "pagamento-email", "pagamento-erro", "avaliacao-erro"].includes(resultado) ? "is-error" : "is-success"}`} role="status">{resultMessages[resultado]}</p>}
      {resultado === "frete-endereco" && <p className="auth-notice is-success" role="status">Endereço de entrega enviado somente à loja vencedora. Aguardando cotação de frete.</p>}
      {resultado === "entrega-confirmada" && <p className="auth-notice is-success" role="status">Recebimento confirmado. Obrigado pela compra.</p>}
      {reviewsUnavailable && <p className="auth-notice is-error" role="status">Algumas avaliações estão temporariamente indisponíveis. A equipe precisa aplicar as migrações 034 e 036 do banco.</p>}
      {error || orderResult.error || customResult.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar seus pedidos. Confira as migrações do marketplace e de impressão personalizada.</p> : !data?.length && !orders.length && !customRequests.length ? <section className="account-card"><h2>Nenhum pedido por enquanto</h2><p>Explore produtos ou envie um modelo 3D para receber propostas de impressão.</p><Link className="button button-primary" href="/#produtos">Explorar produtos</Link><Link className="button button-secondary" href="/visualizador">Enviar modelo 3D</Link></section> : <section className="quote-list" aria-label="Pedidos e orçamentos">
        {customRequests.map((request) => {
          const payment = [...(request.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          const acceptedOffer = request.offers?.find((offer) => offer.status === "accepted");
          const delivery = Array.isArray(request.delivery) ? request.delivery[0] : request.delivery;
          const shippingCents = Number(delivery?.shipping_cost_cents ?? 0);
          const customTotalCents = Math.round(Number(acceptedOffer?.total_brl ?? 0) * 100) + shippingCents;
          const eventHistory = (request.targets ?? []).flatMap((target) => {
            const store = Array.isArray(target.store) ? target.store[0] : target.store;
            return (target.events ?? []).map((event) => ({ ...event, storeName: store?.name ?? "Loja" }));
          }).sort((a, b) => a.created_at.localeCompare(b.created_at));
          const paymentLocked = ["creating", "pending", "paid", "partially_refunded", "charged_back"].includes(payment?.status ?? "");
          return <article className="account-card quote-card" key={request.id}>
          <div className="quote-card-heading"><div><span className="account-kicker">IMPRESSÃO PERSONALIZADA · {request.material_snapshot}</span><h2>{request.model_name}</h2></div><span className={`quote-status status-${request.status}`}>{({ pending: "Buscando propostas", offered: "Propostas recebidas", accepted: "Proposta escolhida", in_production: "Em produção", completed: "Impressão concluída", declined: "Sem propostas compatíveis", cancelled: "Cancelada" } as Record<string, string>)[request.status] ?? request.status}</span></div>
          <p className="quote-meta">{request.quantity} peça(s) · escala {Number(request.scale_percent).toLocaleString("pt-BR")}% · dimensões finais {([request.dimensions_x_mm, request.dimensions_y_mm, request.dimensions_z_mm].map((value) => (Number(value) * Number(request.scale_percent) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })).join(" × "))} mm{request.color ? ` · cor: ${request.color}` : ""}{request.due_date ? ` · prazo desejado: ${dateLabel(request.due_date)}` : ""}</p>
          <p className="quote-meta">Qualidade: {({ standard: "Padrão", fine: "Detalhada", fast: "Rápida", custom: "A combinar" } as Record<string, string>)[request.quality] ?? request.quality}</p>
          {request.notes && <p className="quote-description">{request.notes}</p>}
          {request.offers?.length ? <div className="custom-print-offers"><h3>Propostas para comparar</h3>{request.offers.map((offer) => <div className="quote-offer-summary" key={offer.id}>
            <div><span className="account-kicker">{offer.store_name} · {offer.status === "accepted" ? "ESCOLHIDA" : offer.status === "declined" ? "RECUSADA" : offer.status === "closed" ? "ENCERRADA" : "PROPOSTA"}</span><strong>{formatBrl(offer.total_brl)}</strong><span>Prazo de produção: {offer.lead_days} dias</span>{offer.terms && <p>{offer.terms}</p>}</div>
            {request.status === "offered" && offer.status === "offered" && <div className="quote-actions"><form action={respondToCustomPrintOffer}><input type="hidden" name="offerId" value={offer.id} /><input type="hidden" name="response" value="accept" /><button className="button button-primary" type="submit">Escolher proposta</button></form><form action={respondToCustomPrintOffer}><input type="hidden" name="offerId" value={offer.id} /><input type="hidden" name="response" value="decline" /><button className="button button-secondary" type="submit">Recusar</button></form></div>}
          </div>)}</div> : <p className="quote-meta">Nenhuma proposta recebida ainda.</p>}
          {request.status === "accepted" && <section className="custom-print-shipping" aria-label="Entrega da impressão personalizada"><h3>Entrega e frete</h3>
            {delivery?.delivery_recipient_name && <div className="order-delivery-address"><span className="account-kicker">ENDEREÇO DE ENTREGA</span><strong>{delivery.delivery_recipient_name}</strong><span>{delivery.delivery_street}, {delivery.delivery_number}{delivery.delivery_complement ? ` · ${delivery.delivery_complement}` : ""}</span><span>{delivery.delivery_district} · {delivery.delivery_city}/{delivery.delivery_state_code} · CEP {delivery.delivery_postal_code!.replace(/(\d{5})(\d{3})/, "$1-$2")}</span>{delivery.delivery_reference && <small>Referência: {delivery.delivery_reference}</small>}</div>}
            {request.status === "accepted" && !paymentLocked && !["offered", "accepted"].includes(delivery?.shipping_quote_status ?? "") && addresses.length > 0 && <form action={saveCustomPrintDeliveryAddress} className="auth-form"><label>{delivery?.delivery_recipient_name ? "Alterar endereço de entrega" : "Endereço para entrega"}<select name="addressId" defaultValue={addresses.find((address) => address.is_default)?.id ?? addresses[0].id} required>{addresses.map((address) => <option key={address.id} value={address.id}>{address.label} · {address.city}/{address.state_code} · CEP {address.postal_code.replace(/(\d{5})(\d{3})/, "$1-$2")}</option>)}</select></label><input type="hidden" name="requestId" value={request.id} /><button className="button button-secondary" type="submit">{delivery?.delivery_recipient_name ? "Atualizar endereço" : "Enviar endereço para cotar frete"}</button><small>O endereço completo será compartilhado com a loja escolhida apenas para cotar e entregar. Para retirada local, não é necessário informar endereço.</small></form>}
            {request.status === "accepted" && !paymentLocked && !["offered", "accepted"].includes(delivery?.shipping_quote_status ?? "") && addresses.length === 0 && <p className="quote-small-note">Para receber a impressão, cadastre um endereço em <Link href="/conta#enderecos">Minha conta → Meus endereços</Link>. Para retirada local, não é preciso informar endereço.</p>}
            {!delivery && <p className="quote-small-note">Você pode escolher um endereço quando quiser receber a impressão. O fabricante também pode propor retirada local sem pedir ou compartilhar seu endereço.</p>}
            {delivery?.shipping_quote_status === "awaiting_quote" && <p className="quote-small-note">{delivery.delivery_recipient_name ? "Endereço enviado à loja vencedora. Aguardando cotação de frete." : "Aguardando proposta de retirada local. Para receber em um endereço, selecione-o acima."}</p>}
            {delivery?.shipping_quote_status === "declined" && <p className="quote-small-note">A proposta foi recusada. Selecione um endereço para cotar entrega ou aguarde uma nova proposta de retirada local.</p>}
            {delivery?.shipping_quote_status === "offered" && <div className="quote-offer-summary"><strong>{delivery.shipping_carrier === "correios" ? "Correios" : delivery.shipping_carrier === "melhor_envio" ? "Melhor Envio" : delivery.shipping_carrier === "retirada_local" ? "Retirada local" : "Transportadora"} · {delivery.shipping_service}</strong><span>{delivery.shipping_carrier === "retirada_local" ? "Retirada local · sem frete" : `Frete: ${formatBrl(shippingCents / 100)} · transporte em ${delivery.shipping_delivery_days} dia(s)`}</span><div className="quote-actions"><form action={respondToCustomPrintShippingQuote}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="response" value="accept" /><button className="button button-primary" type="submit">{delivery.shipping_carrier === "retirada_local" ? "Aceitar retirada local" : "Aceitar frete"} · total {formatBrl(customTotalCents / 100)}</button></form><form action={respondToCustomPrintShippingQuote}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="response" value="decline" /><button className="button button-secondary" type="submit">{delivery.shipping_carrier === "retirada_local" ? "Recusar retirada" : "Recusar frete"}</button></form></div></div>}
            {delivery?.shipping_quote_status === "accepted" && <p className="cart-store-total">{delivery.shipping_carrier === "retirada_local" ? "Retirada local · " + delivery.shipping_service + " · sem frete" : "Frete · " + delivery.shipping_service + ": " + formatBrl(shippingCents / 100)} · total da proposta: <strong>{formatBrl(customTotalCents / 100)}</strong></p>}
          </section>}
          {(request.status === "pending" || request.status === "offered" || (request.status === "accepted" && !paymentLocked)) && <form action={cancelCustomPrintRequest} className="quote-cancel-form"><input type="hidden" name="requestId" value={request.id} /><button className="button button-secondary" type="submit">{request.status === "accepted" ? "Cancelar antes da produção" : "Cancelar solicitação"}</button></form>}
          {request.status === "accepted" && <>
            {payment?.status === "charged_back" ? <p className="auth-notice is-error" role="status">O Mercado Pago registrou uma contestação deste pagamento. Não faça outro pagamento; fale com a loja e consulte sua conta Mercado Pago.</p>
              : payment?.status === "paid" ? <p className="auth-notice is-success" role="status">Pagamento confirmado: {formatBrl(payment.total_cents / 100)}. A loja pode iniciar a produção.</p>
              : payment?.status === "refunded" ? <p className="auth-notice" role="status">O pagamento foi reembolsado. Esta solicitação não pode ser paga novamente.</p>
                : payment?.status === "partially_refunded" ? <p className="auth-notice is-error" role="status">O Mercado Pago registrou um reembolso parcial. Entre em contato com a loja para alinhar a produção.</p>
                  : payment?.status === "pending" && isMercadoPagoCheckoutUrl(payment.checkout_url ?? "")
                    ? <div className="quote-offer-summary"><span>Pagamento aguardando confirmação · {formatBrl(payment.total_cents / 100)}</span><a className="button button-primary" href={payment.checkout_url!} rel="noreferrer">Continuar pagamento</a></div>
                    : payment?.status === "creating" ? <><p className="quote-small-note" role="status">O checkout está sendo preparado. Você pode retomar a mesma tentativa.</p><form action={startSellerOrderPayment}><input type="hidden" name="customPrintRequestId" value={request.id} /><button className="button button-secondary" type="submit">Retomar checkout</button></form></>
                      : <>
                        {payment && <p className="auth-notice is-error" role="status">A tentativa anterior foi encerrada. Você pode iniciar uma nova.</p>}
                        {acceptedOffer && delivery?.shipping_quote_status === "accepted" && <form action={startSellerOrderPayment}><input type="hidden" name="customPrintRequestId" value={request.id} /><button className="button button-primary" type="submit">{payment ? "Tentar pagamento novamente" : "Pagar e iniciar produção"} · {formatBrl(customTotalCents / 100)}</button></form>}
                      </>}
            {payment?.status === "pending" && <PendingPaymentCancellation payment={payment} />}
            <p className="quote-small-note">A produção só começa após a confirmação do pagamento. Qualquer frete aceito será cobrado junto com a proposta.</p>
          </>}
          {request.status === "in_production" && <p className="quote-small-note">O fabricante iniciou a produção em {dateLabel(request.production_started_at)}.</p>}
          {request.status === "completed" && <p className="quote-small-note">O fabricante marcou a impressão como concluída em {dateLabel(request.production_completed_at)}.</p>}
          {request.status === "completed" && (delivery?.shipment_status === "shipped" || delivery?.shipment_status === "ready_for_pickup") && <div className="order-delivery-address"><span className="account-kicker">{delivery.shipment_status === "ready_for_pickup" ? "PRONTA PARA RETIRADA" : "ENVIO EM TRÂNSITO"}</span><strong>{delivery.shipping_service}</strong>{delivery.shipment_status === "shipped" && <>{(shippingPackagesByCustomPrint.get(request.id) ?? []).length ? shippingPackagesByCustomPrint.get(request.id)!.map((parcel) => <span key={parcel.package_index}>Remessa {parcel.package_index}{parcel.packages.length > 1 ? ` · ${parcel.packages.length} volumes` : ""}: {parcel.tracking_code ?? "rastreio pendente"}{parcel.tracking_url && <> · <a href={parcel.tracking_url} target="_blank" rel="noreferrer">acompanhar</a></>}</span>) : <span>Código de rastreio: {delivery.shipping_tracking_code}</span>}</>}{delivery.shipping_expected_date && <span>Previsão: {dateLabel(delivery.shipping_expected_date)}</span>}{delivery.shipping_tracking_url && !(shippingPackagesByCustomPrint.get(request.id)?.length) && <a href={delivery.shipping_tracking_url} target="_blank" rel="noreferrer">Abrir rastreio</a>}<form action={confirmCustomPrintDelivery}><input type="hidden" name="requestId" value={request.id} /><button className="button button-primary" type="submit">Confirmar recebimento</button></form></div>}
          {delivery?.shipment_status === "delivered" && <p className="auth-notice is-success" role="status">Recebimento confirmado em {dateLabel(delivery.shipping_delivered_at)}.</p>}
          {request.status === "completed" && payment?.status === "paid" && !customPrintReviews.error && <section className="marketplace-order-reviews" aria-label="Avaliar impressão personalizada"><h3>Avaliação da impressão</h3><div className="marketplace-review-form-card"><strong>Avalie a loja {request.offers?.find((offer) => offer.status === "accepted")?.store_name ?? "fabricante"}</strong>{reviews.find((review) => review.custom_print_request_id === request.id) ? <p className="quote-small-note">{reviewStatus(reviews.find((review) => review.custom_print_request_id === request.id)!)}</p> : <ReviewForm sourceType="custom_print" sourceId={request.id} reviewType="store" label="Enviar avaliação da loja" />}</div></section>}
          {eventHistory.length > 0 && <div className="quote-delivery-status"><strong>Histórico da solicitação</strong><ol className="custom-print-timeline">{eventHistory.map((event) => <li key={event.id}><time dateTime={event.created_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(event.created_at))}</time><span>{getCustomPrintEventLabel(event.event_type)}{event.event_type === "proposal_sent" ? ` · ${formatBrl(Number(event.event_data?.total_brl))} · ${event.event_data?.lead_days} dias` : ""}</span><small>{event.actor_user_id === actor.user.id ? `Você · ${event.storeName}` : event.storeName}</small></li>)}</ol></div>}
          </article>;
        })}
        {orders.map((order) => {
          const subtotalCents = (order.items ?? []).reduce((total, item) => total + Math.round(Number(item.unit_price_brl) * 100) * item.quantity, 0);
          const couponDiscountCents = Number(order.coupon_discount_cents ?? 0);
          const payableSubtotalCents = subtotalCents - couponDiscountCents;
          const shippingCents = order.shipping_quote_status === "accepted" ? Number(order.shipping_cost_cents ?? 0) : 0;
          const totalCents = payableSubtotalCents + shippingCents;
          const payment = [...(order.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          const storeReview = reviews.find((review) => review.order_id === order.id && review.review_type === "store");
          const carrierLabel = ({ correios: "Correios", melhor_envio: "Melhor Envio", transportadora: "Transportadora", retirada_local: "Retirada local" } as Record<string, string>)[order.shipping_carrier ?? ""] ?? "Frete";
          return <article className="account-card quote-card" key={order.id}>
            <div className="quote-card-heading"><div><span className="account-kicker">PEDIDO DO CARRINHO · {order.store_name}</span><h2>{order.items?.length ?? 0} produto(s)</h2></div><span className={`quote-status status-${order.status}`}>{order.status === "pending" ? "Aguardando fabricante" : order.status === "accepted" ? "Disponibilidade confirmada" : "Pedido recusado"}</span></div>
            <ul className="cart-order-items">{order.items?.map((item) => <li key={item.id}><span>{item.quantity} × {item.product_name}</span><strong>{formatBrlTotal(item.unit_price_brl, item.quantity)}</strong></li>)}</ul>
            <p className="cart-store-total">Subtotal dos produtos: <strong>{formatBrl(subtotalCents / 100)}</strong></p>
            {couponDiscountCents > 0 && <><p className="cart-store-total">Cupom {order.coupon_code}: <strong>−{formatBrl(couponDiscountCents / 100)}</strong></p><p className="cart-store-total">Produtos após desconto: <strong>{formatBrl(payableSubtotalCents / 100)}</strong></p></>}
            {order.status === "accepted" && order.shipping_quote_status === "offered" && <div className="quote-offer-summary"><div><span className="account-kicker">COTAÇÃO DE FRETE</span><strong>{carrierLabel} · {order.shipping_service}</strong><span>{formatBrl(Number(order.shipping_cost_cents) / 100)} · prazo estimado de transporte: {order.shipping_carrier === "retirada_local" ? "retirada combinada, sem frete" : order.shipping_delivery_days + " dia(s)"}</span></div><div className="quote-actions"><form action={respondToSellerOrderShippingQuote}><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="response" value="accept" /><button className="button button-primary" type="submit">{order.shipping_carrier === "retirada_local" ? "Aceitar retirada local" : "Aceitar frete"}</button></form><form action={respondToSellerOrderShippingQuote}><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="response" value="decline" /><button className="button button-secondary" type="submit">Recusar</button></form></div></div>}
            {order.status === "accepted" && order.shipping_quote_status === "awaiting_quote" && <p className="quote-small-note">A loja está preparando uma cotação de frete para este pedido.</p>}
            {order.status === "accepted" && order.shipping_quote_status === "declined" && <p className="quote-small-note">Cotação recusada. Aguardando uma nova opção da loja.</p>}
            {order.status === "accepted" && order.shipping_quote_status === "accepted" && <p className="cart-store-total">{order.shipping_carrier === "retirada_local" ? "Retirada local · " + order.shipping_service + " · sem frete" : "Frete · " + carrierLabel + " (" + order.shipping_service + "): " + formatBrl(shippingCents / 100)}</p>}
            {order.status === "accepted" && order.shipping_quote_status === "accepted" && <p className="cart-store-total">Total do pedido: <strong>{formatBrl(totalCents / 100)}</strong></p>}
            {order.delivery_recipient_name && <div className="order-delivery-address"><span className="account-kicker">ENDEREÇO ENVIADO À LOJA</span><strong>{order.delivery_recipient_name}</strong><span>{order.delivery_street}, {order.delivery_number}{order.delivery_complement ? ` · ${order.delivery_complement}` : ""}</span><span>{order.delivery_district} · {order.delivery_city}/{order.delivery_state_code} · CEP {order.delivery_postal_code?.replace(/(\d{5})(\d{3})/, "$1-$2")}</span>{order.delivery_reference && <small>Referência: {order.delivery_reference}</small>}</div>}
            {order.status === "accepted" && order.shipping_quote_status === "accepted" && <>
              {payment?.status === "charged_back" ? <p className="auth-notice is-error" role="status">O Mercado Pago registrou uma contestação deste pagamento. Não inicie outra cobrança; fale com a loja e consulte sua conta Mercado Pago.</p>
                : payment?.status === "paid" ? <p className="auth-notice is-success" role="status">Pagamento aprovado pelo Mercado Pago. Total do pedido com frete: {formatBrl(payment.total_cents / 100)}.</p>
                : payment?.status === "refunded" ? <p className="auth-notice" role="status">Pagamento reembolsado pelo Mercado Pago. Para comprar novamente, faça um novo pedido.</p>
                  : payment?.status === "partially_refunded" ? <p className="auth-notice" role="status">Pagamento aprovado com reembolso parcial registrado pelo Mercado Pago.</p>
                  : payment?.status === "pending" && isMercadoPagoCheckoutUrl(payment.checkout_url ?? "")
                  ? <div className="quote-offer-summary"><span>Pagamento aguardando confirmação · {formatBrl(payment.total_cents / 100)}</span><a className="button button-primary" href={payment.checkout_url!} rel="noreferrer">Continuar pagamento</a></div>
                    : payment?.status === "creating" ? <p className="quote-small-note" role="status">O checkout está sendo preparado. A mesma tentativa pode ser retomada.</p>
                    : payment && <p className="auth-notice is-error" role="status">A tentativa anterior de pagamento foi encerrada. Você pode iniciar uma nova tentativa.</p>}
              {payment?.status === "pending" && <PendingPaymentCancellation payment={payment} />}
              {payment?.status !== "paid" && payment?.status !== "refunded" && payment?.status !== "partially_refunded" && payment?.status !== "charged_back" && payment?.status !== "pending" && <form action={startSellerOrderPayment}><input type="hidden" name="orderId" value={order.id} /><button className="button button-primary" type="submit">{payment?.status === "creating" ? "Retomar checkout" : "Pagar com Mercado Pago"} · {formatBrl(totalCents / 100)}</button></form>}
              <p className="quote-small-note">O checkout cobra os produtos e o frete aceito. A comissão da plataforma é calculada sobre o subtotal dos produtos.</p>
            </>}
            {order.shipment_status !== "awaiting_shipment" && <div className="order-delivery-address"><span className="account-kicker">RASTREAMENTO · {order.shipment_status === "ready_for_pickup" ? "PRONTO PARA RETIRADA" : order.shipment_status === "shipped" ? "ENVIADO" : order.shipment_status === "delivered" ? "ENTREGUE" : "CONCLUÍDO"}</span><strong>{carrierLabel} · {order.shipping_service}</strong>{order.shipment_status === "shipped" && <>{(shippingPackagesByOrder.get(order.id) ?? []).length ? shippingPackagesByOrder.get(order.id)!.map((parcel) => <span key={parcel.package_index}>Remessa {parcel.package_index}{parcel.packages.length > 1 ? ` · ${parcel.packages.length} volumes` : ""}: {parcel.tracking_code ?? "rastreio pendente"}{parcel.tracking_url && <> · <a href={parcel.tracking_url} target="_blank" rel="noreferrer">acompanhar</a></>}</span>) : <span>Código: {order.shipping_tracking_code}</span>}</>}{order.shipping_expected_date && <span>Previsão de entrega: {dateLabel(order.shipping_expected_date)}</span>}{order.shipping_tracking_url && !(shippingPackagesByOrder.get(order.id)?.length) && <a href={order.shipping_tracking_url} target="_blank" rel="noreferrer">Rastrear envio</a>}
              {(order.shipment_status === "shipped" || order.shipment_status === "ready_for_pickup") && <form action={confirmSellerPurchaseOrderDelivery}><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="complete" value="false" /><button className="button button-secondary" type="submit">Confirmar recebimento</button></form>}
              {order.shipment_status === "delivered" && <form action={confirmSellerPurchaseOrderDelivery}><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="complete" value="true" /><button className="button button-primary" type="submit">Concluir pedido</button></form>}
            </div>}
            {order.shipment_status === "completed" && payment?.status === "paid" && !cartReviews.error && <section className="marketplace-order-reviews" aria-label="Avaliar sua compra">
              <h3>Avaliações da compra</h3>
              <div className="marketplace-review-form-card"><strong>Avalie a loja {order.store_name}</strong>{storeReview ? <p className="quote-small-note">{reviewStatus(storeReview)}</p> : <ReviewForm sourceType="cart" sourceId={order.id} reviewType="store" label="Enviar avaliação da loja" />}</div>
              {order.items?.map((item) => {
                const itemReview = reviews.find((review) => review.order_item_id === item.id && review.review_type === "product");
                return <div className="marketplace-review-form-card" key={item.id}><strong>Avalie {item.product_name}</strong>{itemReview ? <p className="quote-small-note">{reviewStatus(itemReview)}</p> : <ReviewForm sourceType="cart" sourceId={order.id} itemId={item.id} reviewType="product" label="Enviar avaliação do produto" />}</div>;
              })}
            </section>}
            {Array.isArray(order.events) && order.events.length > 0 && <div className="quote-delivery-status" aria-label="Histórico do pedido"><strong>Histórico</strong>{[...order.events].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((event) => <div key={event.id}><span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))} · {event.description}</span></div>)}</div>}
          </article>;
        })}
        {data.map((request) => {
          const offer = Array.isArray(request.offer) ? request.offer[0] : request.offer;
          const product = Array.isArray(request.product) ? request.product[0] : request.product;
          const payment = [...(request.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          return <article className="account-card quote-card" key={request.id}>
            <div className="quote-card-heading"><div><span className="account-kicker">{request.request_type === "purchase" ? "SOLICITAÇÃO DE COMPRA" : "ORÇAMENTO"} · {request.store_name}</span><h2>{request.product_name}</h2></div><span className={`quote-status status-${request.status}`}>{requestStatus(request.status, request.request_type)}</span></div>
            <p className="quote-meta">Quantidade: {request.quantity}{request.due_date ? ` · Prazo desejado: ${dateLabel(request.due_date)}` : ""}</p>
            {request.license_type && <p className="quote-meta">Licença: {request.license_type === "commercial" ? "Comercial" : "Pessoal"} · versão registrada na data da compra.</p>}
            {request.request_type === "purchase" && request.unit_price_brl != null && <p className="quote-meta">Preço informado: {formatBrl(request.unit_price_brl)} cada · Total estimado: {formatBrlTotal(request.unit_price_brl, request.quantity)}</p>}
            {request.customization && <p className="quote-description">{request.customization}</p>}
            {offer && <div className="quote-offer-summary"><div><span className="account-kicker">{offerStatus(offer.status)}</span><strong>{formatBrl(offer.total_brl)}</strong><span>Produção em {offer.lead_days} dias</span>{offer.terms && <p>{offer.terms}</p>}</div>
              {request.status === "offered" && <div className="quote-actions"><form action={respondToProductQuoteOffer}><input type="hidden" name="offerId" value={offer.id} /><input type="hidden" name="response" value="accept" /><button className="button button-primary" type="submit">Aceitar proposta</button></form><form action={respondToProductQuoteOffer}><input type="hidden" name="offerId" value={offer.id} /><input type="hidden" name="response" value="decline" /><button className="button button-secondary" type="submit">Recusar</button></form></div>}
            </div>}
            {(request.status === "pending" || request.status === "offered") && <form action={cancelProductQuoteRequest} className="quote-cancel-form"><input type="hidden" name="requestId" value={request.id} /><button className="button button-secondary" type="submit">Cancelar pedido</button></form>}
            {request.status === "accepted" && request.request_type === "purchase" && !request.license_type && <>
              <p className="auth-notice is-error" role="status">Esta solicitação física foi criada pelo fluxo antigo e não inclui endereço nem frete. Refaça o pedido pelo carrinho para receber uma proposta de entrega antes de pagar.</p>
              {payment?.status === "creating" && <p className="quote-small-note" role="status">O checkout antigo ainda está sendo preparado. Atualize esta página antes de enviar outro pedido.</p>}
              {payment?.status === "pending" && <PendingPaymentCancellation payment={payment} />}
              {payment?.status === "paid" && <p className="quote-small-note">Este pedido já foi pago. Entre em contato com a loja para combinar a entrega.</p>}
              {!payment || !["creating", "pending", "paid"].includes(payment.status) ? typeof product?.slug === "string" && <Link className="button button-secondary" href={`/produtos/${encodeURIComponent(product.slug)}#comprar`}>Abrir produto e adicionar ao carrinho</Link> : null}
            </>}
            {request.status === "accepted" && request.request_type === "purchase" && request.license_type && <>
              {payment?.status === "charged_back" ? <p className="auth-notice is-error" role="status">O Mercado Pago registrou uma contestação deste pagamento. Não faça outro pagamento; fale com a loja e consulte sua conta Mercado Pago.</p>
                : payment?.status === "paid" ? request.license_type ? <><p className="auth-notice is-success" role="status">Pagamento aprovado. Sua licença {request.license_type === "commercial" ? "comercial" : "pessoal"} está ativa.</p><form action={downloadDigitalAssetAction}><input type="hidden" name="requestId" value={request.id} /><button className="button button-primary" type="submit">Baixar arquivo privado</button></form><p className="quote-small-note">Downloads registrados: {request.downloads?.length ?? 0}{request.downloads?.length ? ` · último em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(request.downloads[request.downloads.length - 1].created_at))}` : ""}. Cada link seguro expira em 2 minutos.</p></> : <p className="auth-notice is-success" role="status">Pagamento aprovado pelo Mercado Pago: {formatBrl(payment.total_cents / 100)}.</p>
                : payment?.status === "refunded" ? <p className="auth-notice" role="status">Pagamento reembolsado pelo Mercado Pago.</p>
                  : payment?.status === "partially_refunded" ? <p className="auth-notice" role="status">Pagamento aprovado com reembolso parcial registrado pelo Mercado Pago.</p>
                    : payment?.status === "pending" && isMercadoPagoCheckoutUrl(payment.checkout_url ?? "")
                      ? <div className="quote-offer-summary"><span>Pagamento aguardando confirmação · {formatBrl(payment.total_cents / 100)}</span><a className="button button-primary" href={payment.checkout_url!} rel="noreferrer">Continuar pagamento</a></div>
                      : payment?.status === "creating" ? <p className="quote-small-note" role="status">O checkout está sendo preparado.</p>
                        : payment && <p className="auth-notice is-error" role="status">A tentativa anterior foi encerrada. Você pode iniciar uma nova.</p>}
              {payment?.status === "pending" && <PendingPaymentCancellation payment={payment} />}
              {payment?.status !== "paid" && payment?.status !== "refunded" && payment?.status !== "partially_refunded" && payment?.status !== "charged_back" && payment?.status !== "pending" && <form action={startSellerOrderPayment}><input type="hidden" name="purchaseRequestId" value={request.id} /><button className="button button-primary" type="submit">{payment?.status === "creating" ? "Retomar checkout" : "Pagar com Mercado Pago"} · {formatBrlTotal(request.unit_price_brl!, request.quantity)}</button></form>}
              <p className="quote-small-note">{request.license_type ? "O download fica disponível somente após confirmação do pagamento." : "O fabricante confirmou a disponibilidade. O checkout cobra os produtos; o frete é combinado com a loja."}</p>
            </>}
            {request.status === "accepted" && request.request_type === "purchase" && payment?.status === "paid" && !purchaseReviews.error && <section className="marketplace-order-reviews" aria-label="Avaliar sua compra"><h3>Avaliações da compra</h3>{(["store", "product"] as const).map((reviewType) => {
              const review = reviews.find((item) => item.purchase_request_id === request.id && item.review_type === reviewType);
              const label = reviewType === "store" ? `loja ${request.store_name}` : request.product_name;
              return <div className="marketplace-review-form-card" key={reviewType}><strong>Avalie {label}</strong>{review ? <p className="quote-small-note">{reviewStatus(review)}</p> : <ReviewForm sourceType="purchase" sourceId={request.id} reviewType={reviewType} label={`Enviar avaliação ${reviewType === "store" ? "da loja" : "do produto"}`} />}</div>;
            })}</section>}
            {request.status === "accepted" && request.request_type !== "purchase" && <p className="quote-small-note">A proposta foi aceita. O pagamento e a contratação serão combinados fora da plataforma nesta versão.</p>}
          </article>;
        })}
      </section>}
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Seus pedidos de orçamento.</p><span>© 2026 ViraPeça 3D</span></div></footer>
  </>;
}
