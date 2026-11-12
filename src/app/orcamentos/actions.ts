"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateProductQuoteOffer, validateProductQuoteRequest, validateProductVariantSelection } from "@/lib/marketplace-validation";
import { validateCustomPrintRequest } from "@/lib/custom-print-request";
import { dispatchNotificationQueue } from "@/lib/notification-dispatch.server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validSlug = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const objectValue = (value: unknown): Record<string, unknown> => Array.isArray(value) ? objectValue(value[0]) : value && typeof value === "object" ? value as Record<string, unknown> : {};

export type QuoteOfferState = { message: string; success: boolean };

export async function requestCustomPrint(formData: FormData): Promise<void> {
  const request = validateCustomPrintRequest(Object.fromEntries(formData.entries()));
  if (!request) redirect("/visualizador?orcamento=erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user) redirect("/conta");
  if (!actor.authorized) redirect("/conta?resultado=perfil-comprador");
  const { error } = await actor.supabase.rpc("create_custom_print_request", {
    p_upload_id: request.uploadId, p_material_id: request.materialId, p_quantity: request.quantity,
    p_scale_percent: request.scalePercent, p_dimensions_x_mm: request.dimensionsMm.x,
    p_dimensions_y_mm: request.dimensionsMm.y, p_dimensions_z_mm: request.dimensionsMm.z,
    p_color: request.color, p_quality: request.quality, p_due_date: request.dueDate, p_notes: request.notes,
  });
  if (error) redirect(`/visualizador?orcamento=${error.message.includes("NO_COMPATIBLE_STORES") ? "sem-fabricantes" : "erro"}`);
  after(dispatchNotificationQueue);
  revalidatePath("/visualizador");
  revalidatePath("/orcamentos");
  revalidatePath("/painel/maker");
  redirect("/orcamentos?resultado=custom-solicitado");
}

export async function submitCustomPrintOffer(_previous: QuoteOfferState, formData: FormData): Promise<QuoteOfferState> {
  const targetId = formData.get("targetId");
  const offer = validateProductQuoteOffer({ totalBrl: formData.get("totalBrl"), leadDays: formData.get("leadDays"), terms: formData.get("terms") });
  if (typeof targetId !== "string" || !uuidPattern.test(targetId) || !offer) return { message: "Confira o valor, o prazo e as condições da proposta.", success: false };
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user) return { message: "Entre na conta para continuar.", success: false };
  if (!actor.authorized) return { message: "Esta conta não tem acesso ao painel de fabricantes.", success: false };
  const { error } = await actor.supabase.rpc("submit_custom_print_offer", {
    p_target_id: targetId, p_total_brl: offer.totalBrl, p_lead_days: offer.leadDays, p_terms: offer.terms,
  });
  if (error) return { message: "Não foi possível enviar a proposta. Atualize a página e confira se o pedido ainda está aberto.", success: false };
  revalidatePath("/painel/maker");
  revalidatePath("/orcamentos");
  return { message: "Proposta enviada ao comprador. O pagamento ainda não foi processado.", success: true };
}

export async function respondToCustomPrintOffer(formData: FormData): Promise<void> {
  const offerId = formData.get("offerId");
  const response = formData.get("response");
  if (typeof offerId !== "string" || !uuidPattern.test(offerId) || (response !== "accept" && response !== "decline")) redirect("/orcamentos?resultado=erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("respond_to_custom_print_offer", { p_offer_id: offerId, p_response: response });
  if (error) redirect("/orcamentos?resultado=erro");
  revalidatePath("/orcamentos");
  revalidatePath("/painel/maker");
  redirect(`/orcamentos?resultado=custom-${response === "accept" ? "aceita" : "recusada"}`);
}

export async function cancelCustomPrintRequest(formData: FormData): Promise<void> {
  const requestId = formData.get("requestId");
  if (typeof requestId !== "string" || !uuidPattern.test(requestId)) redirect("/orcamentos?resultado=erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("cancel_custom_print_request", { p_request_id: requestId });
  if (error) redirect("/orcamentos?resultado=erro");
  revalidatePath("/orcamentos");
  revalidatePath("/painel/maker");
  redirect("/orcamentos?resultado=custom-cancelada");
}

export async function requestProductQuote(formData: FormData): Promise<void> {
  const slug = formData.get("slug");
  if (!validSlug(slug)) redirect("/orcamentos?resultado=erro");
  const request = validateProductQuoteRequest({ quantity: formData.get("quantity"), customization: formData.get("customization"), dueDate: formData.get("dueDate") });
  if (!request) redirect(`/produtos/${encodeURIComponent(slug)}?orcamento=erro`);
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user) redirect("/conta");
  if (!actor.authorized) redirect("/conta?resultado=perfil-comprador");
  const { data: product } = await actor.supabase.from("marketplace_products").select("id, store_id, name, price_mode, store:stores!inner(name)").eq("slug", slug).eq("catalog_status", "published").in("price_mode", ["quote", "from"]).eq("store.status", "published").maybeSingle();
  const store = objectValue(product?.store);
  if (!product || typeof store.name !== "string") redirect(`/produtos/${encodeURIComponent(slug)}?orcamento=indisponivel`);
  const { error } = await actor.supabase.from("product_quote_requests").insert({
    buyer_id: actor.user.id, store_id: product.store_id, product_id: product.id,
    store_name: store.name, product_name: product.name, quantity: request.quantity,
    customization: request.customization, due_date: request.dueDate,
  });
  if (error) redirect(`/produtos/${encodeURIComponent(slug)}?orcamento=erro`);
  after(dispatchNotificationQueue);
  revalidatePath("/orcamentos");
  revalidatePath("/painel/maker");
  redirect("/orcamentos?resultado=solicitado");
}

export async function requestProductPurchase(formData: FormData): Promise<void> {
  const slug = formData.get("slug");
  if (!validSlug(slug)) redirect("/orcamentos?resultado=erro");
  const request = validateProductQuoteRequest({ quantity: formData.get("quantity"), customization: formData.get("customization"), dueDate: formData.get("dueDate") });
  if (!request) redirect(`/produtos/${encodeURIComponent(slug)}?compra=erro`);
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user) redirect("/conta");
  if (!actor.authorized) redirect("/conta?resultado=perfil-comprador");
  const { data: product } = await actor.supabase.from("marketplace_products").select("id, store_id, name, price_brl, product_properties, store:stores!inner(name)").eq("slug", slug).eq("catalog_status", "published").eq("price_mode", "fixed").eq("store.status", "published").maybeSingle();
  const store = objectValue(product?.store);
  const unitPrice = Number(product?.price_brl);
  if (!product || typeof store.name !== "string" || !Number.isFinite(unitPrice) || unitPrice <= 0) redirect(`/produtos/${encodeURIComponent(slug)}?compra=indisponivel`);
  const variantOptions = validateProductVariantSelection(formData.get("variantOptions"), product.product_properties);
  if (!variantOptions) redirect(`/produtos/${encodeURIComponent(slug)}?compra=erro`);
  const variantNote = Object.entries(variantOptions).map(([name, value]) => `${name}: ${value}`).join(" · ");
  const customization = [request.customization, variantNote ? `Variações selecionadas: ${variantNote}` : ""].filter(Boolean).join("\n");
  if (customization.length > 2000) redirect(`/produtos/${encodeURIComponent(slug)}?compra=erro`);
  const { error } = await actor.supabase.from("product_quote_requests").insert({
    buyer_id: actor.user.id, store_id: product.store_id, product_id: product.id,
    store_name: store.name, product_name: product.name, request_type: "purchase", unit_price_brl: unitPrice, variant_options: variantOptions,
    quantity: request.quantity, customization, due_date: request.dueDate,
  });
  if (error) redirect(`/produtos/${encodeURIComponent(slug)}?compra=erro`);
  after(dispatchNotificationQueue);
  revalidatePath("/orcamentos");
  revalidatePath("/painel/maker");
  redirect("/orcamentos?resultado=compra-solicitada");
}

export async function submitProductQuoteOffer(_previous: QuoteOfferState, formData: FormData): Promise<QuoteOfferState> {
  const requestId = formData.get("requestId");
  const offer = validateProductQuoteOffer({ totalBrl: formData.get("totalBrl"), leadDays: formData.get("leadDays"), terms: formData.get("terms") });
  if (typeof requestId !== "string" || !uuidPattern.test(requestId) || !offer) return { message: "Confira o valor, o prazo e as condições da proposta.", success: false };
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user) return { message: "Entre na conta para continuar.", success: false };
  if (!actor.authorized) return { message: "Esta conta não tem acesso ao painel de fabricantes.", success: false };
  const { error } = await actor.supabase.rpc("submit_product_quote_offer", {
    p_request_id: requestId, p_total_brl: offer.totalBrl, p_lead_days: offer.leadDays, p_terms: offer.terms,
  });
  if (error) return { message: "Não foi possível enviar a proposta. Atualize a página e confira se o pedido ainda está aberto.", success: false };
  revalidatePath("/painel/maker");
  revalidatePath("/orcamentos");
  return { message: "Proposta enviada ao comprador. Nenhum pagamento foi realizado.", success: true };
}

export async function respondToProductQuoteOffer(formData: FormData): Promise<void> {
  const offerId = formData.get("offerId");
  const response = formData.get("response");
  if (typeof offerId !== "string" || !uuidPattern.test(offerId) || (response !== "accept" && response !== "decline")) redirect("/orcamentos?resultado=erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("respond_to_product_quote_offer", { p_offer_id: offerId, p_response: response });
  if (error) redirect("/orcamentos?resultado=erro");
  revalidatePath("/orcamentos");
  revalidatePath("/painel/maker");
  redirect(`/orcamentos?resultado=${response === "accept" ? "aceita" : "recusada"}`);
}

export async function respondToProductPurchaseRequest(formData: FormData): Promise<void> {
  const requestId = formData.get("requestId");
  const response = formData.get("response");
  if (typeof requestId !== "string" || !uuidPattern.test(requestId) || (response !== "accept" && response !== "decline")) redirect("/painel/maker?resultado=erro");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("respond_to_product_purchase_request", { p_request_id: requestId, p_response: response });
  if (error) redirect("/painel/maker?resultado=erro");
  revalidatePath("/painel/maker");
  revalidatePath("/orcamentos");
  redirect(`/painel/maker?resultado=compra-${response === "accept" ? "aceita" : "recusada"}`);
}

export async function respondToSellerPurchaseOrder(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  const response = formData.get("response");
  if (typeof orderId !== "string" || !uuidPattern.test(orderId) || (response !== "accept" && response !== "decline")) redirect("/painel/maker?resultado=erro");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("respond_to_seller_purchase_order", { p_order_id: orderId, p_response: response });
  if (error) redirect("/painel/maker?resultado=erro");
  revalidatePath("/painel/maker");
  revalidatePath("/orcamentos");
  redirect(`/painel/maker?resultado=pedido-${response === "accept" ? "aceito" : "recusado"}`);
}

export async function respondToSellerOrderShippingQuote(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  const response = formData.get("response");
  if (typeof orderId !== "string" || !uuidPattern.test(orderId) || (response !== "accept" && response !== "decline")) redirect("/orcamentos?resultado=frete-erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("respond_to_seller_order_shipping_quote", { p_order_id: orderId, p_response: response });
  if (error) redirect("/orcamentos?resultado=frete-erro");
  revalidatePath("/orcamentos");
  revalidatePath("/painel/maker");
  redirect(`/orcamentos?resultado=frete-${response === "accept" ? "aceito" : "recusado"}`);
}

export async function confirmSellerPurchaseOrderDelivery(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  const complete = formData.get("complete") === "true";
  if (typeof orderId !== "string" || !uuidPattern.test(orderId)) redirect("/orcamentos?resultado=entrega-erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("confirm_seller_purchase_order_delivery", { p_order_id: orderId, p_complete: complete });
  if (error) redirect("/orcamentos?resultado=entrega-erro");
  revalidatePath("/orcamentos");
  revalidatePath("/painel/maker");
  redirect(`/orcamentos?resultado=${complete ? "pedido-concluido" : "pedido-entregue"}`);
}

export async function submitMarketplaceReviewAction(formData: FormData): Promise<void> {
  const sourceType = formData.get("sourceType");
  const sourceId = formData.get("sourceId");
  const itemId = formData.get("itemId");
  const reviewType = formData.get("reviewType");
  const rating = formData.get("rating");
  const body = formData.get("body");
  if (!(sourceType === "cart" || sourceType === "purchase" || sourceType === "custom_print")
    || typeof sourceId !== "string" || !uuidPattern.test(sourceId)
    || (itemId !== "" && (typeof itemId !== "string" || !uuidPattern.test(itemId)))
    || !(reviewType === "product" || reviewType === "store")
    || (sourceType === "cart" && ((reviewType === "product") !== Boolean(itemId)))
    || (sourceType === "purchase" && itemId !== "")
    || (sourceType === "custom_print" && (reviewType !== "store" || itemId !== ""))
    || typeof rating !== "string" || !["1", "2", "3", "4", "5"].includes(rating)
    || typeof body !== "string" || body.length > 1200) redirect("/orcamentos?resultado=avaliacao-erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = sourceType === "cart"
    ? await actor.supabase.rpc("submit_marketplace_review", {
      p_order_id: sourceId, p_order_item_id: itemId || null, p_rating: Number(rating), p_body: body.trim() || null,
    })
    : sourceType === "purchase"
      ? await actor.supabase.rpc("submit_product_purchase_review", {
        p_request_id: sourceId, p_review_type: reviewType, p_rating: Number(rating), p_body: body.trim() || null,
      })
      : await actor.supabase.rpc("submit_custom_print_review", {
        p_request_id: sourceId, p_rating: Number(rating), p_body: body.trim() || null,
      });
  if (error) redirect("/orcamentos?resultado=avaliacao-erro");
  revalidatePath("/orcamentos");
  redirect("/orcamentos?resultado=avaliacao-enviada");
}

export async function cancelProductQuoteRequest(formData: FormData): Promise<void> {
  const requestId = formData.get("requestId");
  if (typeof requestId !== "string" || !uuidPattern.test(requestId)) redirect("/orcamentos?resultado=erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("cancel_product_quote_request", { p_request_id: requestId });
  if (error) redirect("/orcamentos?resultado=erro");
  revalidatePath("/orcamentos");
  revalidatePath("/painel/maker");
  redirect("/orcamentos?resultado=cancelada");
}
