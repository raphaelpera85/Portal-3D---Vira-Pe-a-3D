"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMercadoPagoSellerAccessToken } from "@/lib/mercado-pago-access-token.server";
import { calculateMarketplaceFeeCents, customPrintOfferPaymentItem, formatMercadoPagoAmount, isMercadoPagoOrderForPayment, mapMercadoPagoOrderStatus, parseMercadoPagoOrderResponse } from "@/lib/mercado-pago-payments";
import { getMercadoPagoOrderCancellationStatus } from "@/lib/mercado-pago-cancellations";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserWithRole } from "@/lib/auth-role.server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const objectValue = (value: unknown): Record<string, unknown> => Array.isArray(value) ? objectValue(value[0]) : value && typeof value === "object" ? value as Record<string, unknown> : {};

export async function startSellerOrderPayment(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  const purchaseRequestId = formData.get("purchaseRequestId");
  const customPrintRequestId = formData.get("customPrintRequestId");
  const isOrder = typeof orderId === "string" && uuidPattern.test(orderId);
  const isDirectPurchase = typeof purchaseRequestId === "string" && uuidPattern.test(purchaseRequestId);
  const isCustomPrint = typeof customPrintRequestId === "string" && uuidPattern.test(customPrintRequestId);
  if ([isOrder, isDirectPurchase, isCustomPrint].filter(Boolean).length !== 1) redirect("/orcamentos?resultado=pagamento-erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  if (!actor.user.email) redirect("/orcamentos?resultado=pagamento-email");
  const siteUrl = getSiteUrl();
  const admin = createSupabaseAdminClient();
  const feeSetting = process.env.MP_MARKETPLACE_FEE_PERCENT;
  const feePercent = feeSetting?.trim() ? Number(feeSetting) : NaN;
  if (!siteUrl || !admin || !process.env.MP_WEBHOOK_SECRET || !Number.isFinite(feePercent) || feePercent < 0 || feePercent >= 100) {
    redirect("/orcamentos?resultado=pagamento-configurar");
  }

  const { data: order, error: orderError } = isOrder
    ? await actor.supabase.from("seller_purchase_orders")
      .select("id, store_id, store_name, status, coupon_code, coupon_discount_cents, shipping_quote_status, shipping_carrier, shipping_service, shipping_cost_cents, items:seller_purchase_order_items(product_name, unit_price_brl, quantity)")
      .eq("id", orderId).eq("buyer_id", actor.user.id).maybeSingle()
    : isDirectPurchase ? await actor.supabase.from("product_quote_requests")
      .select("id, store_id, store_name, product_name, unit_price_brl, quantity, status, request_type, license_type")
      .eq("id", purchaseRequestId).eq("buyer_id", actor.user.id).maybeSingle()
      : await actor.supabase.from("custom_print_requests")
        .select("id, status, winning_store_id, model_name, offer:custom_print_offers(status, store_id, total_brl), delivery:custom_print_deliveries(shipping_quote_status, shipping_service, shipping_cost_cents)")
        .eq("id", customPrintRequestId).eq("buyer_id", actor.user.id).maybeSingle();
  const orderRow = objectValue(order);
  const customPrintDelivery = objectValue(orderRow.delivery);
  const customPrintItem = isCustomPrint ? customPrintOfferPaymentItem(order) : null;
  const licensedProductName = typeof orderRow.product_name === "string" && typeof orderRow.license_type === "string"
    ? `${orderRow.product_name} · licença ${orderRow.license_type === "commercial" ? "comercial" : "pessoal"}` : orderRow.product_name;
  const itemsSource = isOrder ? orderRow.items : isDirectPurchase ? [{ product_name: licensedProductName, unit_price_brl: orderRow.unit_price_brl, quantity: orderRow.quantity }] : [];
  const sourceId = typeof orderRow.id === "string" ? orderRow.id : "";
  const storeId = typeof orderRow.store_id === "string" ? orderRow.store_id : typeof orderRow.winning_store_id === "string" ? orderRow.winning_store_id : "";
  if (orderError || !order || !uuidPattern.test(sourceId) || !uuidPattern.test(storeId) || orderRow.status !== "accepted"
    || (isDirectPurchase && orderRow.request_type !== "purchase") || (isCustomPrint && !customPrintItem)) {
    redirect("/orcamentos?resultado=pagamento-erro");
  }
  if (isOrder && orderRow.shipping_quote_status !== "accepted") redirect("/orcamentos?resultado=pagamento-frete");
  if (isCustomPrint && customPrintDelivery.shipping_quote_status !== "accepted") redirect("/orcamentos?resultado=pagamento-frete");
  const items = isCustomPrint && customPrintItem ? [
    { name: customPrintItem.name, unitPrice: customPrintItem.unitCents / 100, unitCents: customPrintItem.unitCents, quantity: customPrintItem.quantity },
  ] : (Array.isArray(itemsSource) ? itemsSource : []).map((raw) => {
    const item = objectValue(raw);
    const name = typeof item.product_name === "string" ? item.product_name.slice(0, 240) : "";
    const unitPrice = Number(item.unit_price_brl);
    const quantity = Number(item.quantity);
    const unitCents = Math.round(unitPrice * 100);
    return { name, unitPrice, unitCents, quantity };
  });
  const subtotalCents = items.reduce((sum, item) => sum + item.unitCents * item.quantity, 0);
  const couponDiscountCents = isOrder ? Number(orderRow.coupon_discount_cents ?? 0) : 0;
  const payableSubtotalCents = subtotalCents - couponDiscountCents;
  const shippingCents = isOrder ? Number(orderRow.shipping_cost_cents) : isCustomPrint ? Number(customPrintDelivery.shipping_cost_cents) : 0;
  const totalCents = payableSubtotalCents + shippingCents;
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 1 || !Number.isSafeInteger(couponDiscountCents) || couponDiscountCents < 0
    || payableSubtotalCents < 1 || !Number.isSafeInteger(shippingCents) || shippingCents < 0
    || !Number.isSafeInteger(totalCents) || totalCents < 1
    || items.some((item) => !item.name || !Number.isSafeInteger(item.unitCents) || item.unitCents < 1 || !Number.isInteger(item.quantity) || item.quantity < 1)) {
    redirect("/orcamentos?resultado=pagamento-erro");
  }
  let feeCents: number;
  try { feeCents = calculateMarketplaceFeeCents(payableSubtotalCents, feePercent); }
  catch { redirect("/orcamentos?resultado=pagamento-configurar"); }

  const { data: connection } = await admin.from("store_payment_connections").select("provider_user_id")
    .eq("store_id", storeId).maybeSingle();
  if (!connection) redirect("/orcamentos?resultado=pagamento-conta-vendedor");
  let accessToken: string;
  try { accessToken = await getMercadoPagoSellerAccessToken(storeId); }
  catch { redirect("/orcamentos?resultado=pagamento-conta-vendedor"); }

  const { data: attempts, error: attemptError } = isOrder
    ? await admin.rpc("create_seller_order_payment", {
      p_order_id: sourceId, p_buyer_id: actor.user.id, p_marketplace_fee_cents: feeCents,
    })
    : isDirectPurchase ? await admin.rpc("create_product_purchase_payment", {
      p_request_id: sourceId, p_buyer_id: actor.user.id, p_marketplace_fee_cents: feeCents,
    }) : await admin.rpc("create_custom_print_payment", {
      p_request_id: sourceId, p_buyer_id: actor.user.id, p_marketplace_fee_cents: feeCents, p_expected_shipping_cents: shippingCents,
    });
  const payment = Array.isArray(attempts) ? objectValue(attempts[0]) : {};
  if (attemptError || typeof payment.payment_id !== "string") redirect("/orcamentos?resultado=pagamento-erro");
  if (payment.payment_status === "pending" && typeof payment.payment_checkout_url === "string") {
    const existing = parseMercadoPagoOrderResponse({ id: payment.payment_provider_order_id, checkout_url: payment.payment_checkout_url });
    if (existing) redirect(existing.checkoutUrl);
  }
  const persistedTotalCents = Number(payment.payment_total_cents);
  const persistedFeeCents = Number(payment.payment_fee_cents);
  if (payment.payment_status !== "creating" || persistedTotalCents !== totalCents || !Number.isSafeInteger(persistedFeeCents)
    || persistedFeeCents < 0 || persistedFeeCents >= subtotalCents) {
    redirect("/orcamentos?resultado=pagamento-erro");
  }

  let response: Response;
  try {
    response = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST", headers: {
        Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "X-Idempotency-Key": payment.payment_id,
      },
      body: JSON.stringify({
        type: "online", processing_mode: "manual", capture_mode: "automatic_async", expiration_time: "P1D",
        external_reference: payment.payment_id, total_amount: formatMercadoPagoAmount(totalCents),
        ...(persistedFeeCents > 0 ? { marketplace_fee: formatMercadoPagoAmount(persistedFeeCents) } : {}),
        payer: { email: actor.user.email },
        items: [
          ...(isOrder && couponDiscountCents > 0
            ? [{ title: `Produtos do pedido · cupom ${String(orderRow.coupon_code ?? "")}`.slice(0, 240), unit_price: formatMercadoPagoAmount(payableSubtotalCents), quantity: 1 }]
            : items.map((item) => ({ title: item.name, unit_price: formatMercadoPagoAmount(item.unitCents), quantity: item.quantity }))),
          ...(shippingCents > 0 ? [{ title: `Frete — ${typeof (isOrder ? orderRow.shipping_service : customPrintDelivery.shipping_service) === "string" ? String(isOrder ? orderRow.shipping_service : customPrintDelivery.shipping_service).slice(0, 200) : "Loja"}`, unit_price: formatMercadoPagoAmount(shippingCents), quantity: 1 }] : []),
        ],
        config: { online: {
          success_url: new URL("/orcamentos?resultado=retorno-pagamento", siteUrl).toString(),
          failure_url: new URL("/orcamentos?resultado=retorno-pagamento", siteUrl).toString(),
          pending_url: new URL("/orcamentos?resultado=retorno-pagamento", siteUrl).toString(),
          auto_return: "approved",
        } },
      }),
      signal: AbortSignal.timeout(10_000), cache: "no-store", redirect: "error",
    });
  } catch {
    redirect("/orcamentos?resultado=pagamento-aguardando");
  }

  if (!response.ok) {
    if (response.status >= 400 && response.status < 500 && response.status !== 409) {
      await admin.rpc("fail_seller_order_payment", { p_payment_id: payment.payment_id, p_status: "failed", p_provider_status: `http_${response.status}` });
    }
    redirect("/orcamentos?resultado=pagamento-erro");
  }
  const providerValue: unknown = await response.json().catch(() => null);
  const providerData = objectValue(providerValue);
  const providerOrder = parseMercadoPagoOrderResponse(providerValue);
  if (!providerOrder || providerData.external_reference !== payment.payment_id
    || String(providerData.user_id) !== connection.provider_user_id || providerData.currency !== "BRL"
    || Math.round(Number(providerData.total_amount) * 100) !== persistedTotalCents) {
    redirect("/orcamentos?resultado=pagamento-erro");
  }
  const { error: saveError } = await admin.rpc("save_seller_order_payment_provider_order", {
    p_payment_id: payment.payment_id, p_provider_order_id: providerOrder.id, p_checkout_url: providerOrder.checkoutUrl,
  });
  if (saveError) redirect("/orcamentos?resultado=pagamento-aguardando");
  revalidatePath("/orcamentos");
  redirect(providerOrder.checkoutUrl);
}

export async function cancelPendingSellerPayment(formData: FormData): Promise<void> {
  const paymentId = formData.get("paymentId");
  const idempotencyKey = formData.get("idempotencyKey");
  if (typeof paymentId !== "string" || !uuidPattern.test(paymentId) || typeof idempotencyKey !== "string"
    || !uuidPattern.test(idempotencyKey) || formData.get("confirmCancel") !== "yes") {
    redirect("/orcamentos?resultado=cancelamento-dados-invalidos");
  }
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: payment } = await actor.supabase.from("seller_order_payments")
    .select("id, store_id, buyer_id, total_cents, marketplace_fee_cents, provider_order_id, status")
    .eq("id", paymentId).eq("buyer_id", actor.user.id).maybeSingle();
  if (!payment || !payment.provider_order_id || payment.status !== "pending") {
    redirect("/orcamentos?resultado=cancelamento-indisponivel");
  }
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/orcamentos?resultado=pagamento-configurar");
  const { data: reservationData, error: reservationError } = await admin.rpc("reserve_seller_order_payment_cancellation", {
    p_payment_id: payment.id, p_buyer_id: actor.user.id, p_idempotency_key: idempotencyKey,
  });
  if (reservationError) redirect("/orcamentos?resultado=cancelamento-indisponivel");
  const reservation = Array.isArray(reservationData) ? reservationData[0] : reservationData;
  if (!reservation || reservation.cancellation_payment_id !== payment.id
    || typeof reservation.cancellation_status !== "string" || typeof reservation.cancellation_idempotency_key !== "string") {
    redirect("/orcamentos?resultado=cancelamento-indisponivel");
  }
  if (reservation.cancellation_status === "processed") redirect("/orcamentos?resultado=pagamento-cancelado");
  if (reservation.cancellation_status === "failed") redirect("/orcamentos?resultado=cancelamento-indisponivel");

  const { data: connection, error: connectionError } = await admin.from("store_payment_connections")
    .select("provider_user_id").eq("store_id", payment.store_id).maybeSingle();
  if (connectionError || !connection) redirect("/orcamentos?resultado=pagamento-conta-vendedor");
  let accessToken: string;
  try { accessToken = await getMercadoPagoSellerAccessToken(payment.store_id); }
  catch { redirect("/orcamentos?resultado=cancelamento-pendente"); }

  const expected = {
    id: payment.provider_order_id, paymentId: payment.id, sellerId: connection.provider_user_id,
    totalCents: Number(payment.total_cents), marketplaceFeeCents: Number(payment.marketplace_fee_cents),
  };
  let orderResponse: Response;
  try {
    orderResponse = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(payment.provider_order_id)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
    });
  } catch { redirect("/orcamentos?resultado=cancelamento-pendente"); }
  if (!orderResponse.ok) redirect("/orcamentos?resultado=cancelamento-pendente");
  const order = objectValue(await orderResponse.json().catch(() => null));
  const cancellationState = getMercadoPagoOrderCancellationStatus(order, expected);
  const providerStatus = typeof order.status === "string" ? order.status : "";
  const statusDetail = typeof order.status_detail === "string" ? order.status_detail : "";
  const providerStatusText = statusDetail ? `${providerStatus}:${statusDetail}` : providerStatus;
  if (cancellationState === "mismatch") {
    await admin.rpc("complete_seller_order_payment_cancellation", {
      p_payment_id: payment.id, p_status: "failed", p_provider_status: "provider_order_mismatch",
    });
    redirect("/orcamentos?resultado=cancelamento-indisponivel");
  }
  if (cancellationState === "cancelled") {
    const { error } = await admin.rpc("complete_seller_order_payment_cancellation", {
      p_payment_id: payment.id, p_status: "processed", p_provider_status: providerStatusText, p_payment_status: "cancelled",
    });
    if (error) redirect("/orcamentos?resultado=cancelamento-pendente");
    revalidatePath("/orcamentos");
    revalidatePath("/painel/maker");
    redirect("/orcamentos?resultado=pagamento-cancelado");
  }
  if (cancellationState === "not_cancelable") {
    const currentPaymentStatus = mapMercadoPagoOrderStatus(providerStatus, statusDetail);
    const { error } = await admin.rpc("complete_seller_order_payment_cancellation", {
      p_payment_id: payment.id, p_status: "failed", p_provider_status: providerStatusText,
      ...(currentPaymentStatus ? { p_payment_status: currentPaymentStatus } : {}),
    });
    if (error) redirect("/orcamentos?resultado=cancelamento-pendente");
    revalidatePath("/orcamentos");
    redirect("/orcamentos?resultado=cancelamento-indisponivel");
  }

  let cancelResponse: Response;
  try {
    cancelResponse = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(payment.provider_order_id)}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "X-Idempotency-Key": reservation.cancellation_idempotency_key },
      signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
    });
  } catch { redirect("/orcamentos?resultado=cancelamento-pendente"); }
  if (!cancelResponse.ok) redirect("/orcamentos?resultado=cancelamento-pendente");
  const cancelledOrder = objectValue(await cancelResponse.json().catch(() => null));
  if (getMercadoPagoOrderCancellationStatus(cancelledOrder, expected) !== "cancelled") {
    redirect("/orcamentos?resultado=cancelamento-pendente");
  }
  const cancelledProviderStatus = typeof cancelledOrder.status_detail === "string"
    ? `${String(cancelledOrder.status)}:${cancelledOrder.status_detail}` : String(cancelledOrder.status);
  const { error: completionError } = await admin.rpc("complete_seller_order_payment_cancellation", {
    p_payment_id: payment.id, p_status: "processed", p_provider_status: cancelledProviderStatus, p_payment_status: "cancelled",
  });
  if (completionError) redirect("/orcamentos?resultado=cancelamento-pendente");
  revalidatePath("/orcamentos");
  revalidatePath("/painel/maker");
  redirect("/orcamentos?resultado=pagamento-cancelado");
}
