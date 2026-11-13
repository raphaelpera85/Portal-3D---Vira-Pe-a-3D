"use server";

import { after } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { dispatchNotificationQueue } from "@/lib/notification-dispatch.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeProductVariantOptions, validateProductDraft, validateProductInventory, validateProductShippingPackage, validateProductVariantPricing, validateStoreNotificationContacts } from "@/lib/marketplace-validation";
import { validateMaintenanceEntry, validateMakerPrinter } from "@/lib/printer-equipment";
import { validateConsignmentInput, validateConsignmentMovement } from "@/lib/consignment";
import { validatePrintProfile } from "@/lib/print-profiles";
import { validatePrinterModelSuggestion } from "@/lib/printer-model-suggestion";
import { validateShipmentTracking, validateShippingOriginPostalCode, validateShippingQuote } from "@/lib/shipping-quote";
import { melhorEnvioLabelScopes, validateMelhorEnvioPackage, validateMelhorEnvioSender, validateMelhorEnvioShipment } from "@/lib/melhor-envio";
import { validateDigitalAsset } from "@/lib/digital-assets";
import { calculateMelhorEnvioRates, requestMelhorEnvio } from "@/lib/melhor-envio.server";
import { getSiteUrl } from "@/lib/site-url";

export type MakerProductState = { message: string; success: boolean; productId?: string; personalPriceBrl?: number };
export type StoreNotificationContactState = { message: string; success: boolean };
export type CustomPrintFileLinksState = { message: string; links: { name: string; url: string }[] };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const melhorEnvioCallbackPath = "/api/shipping/melhor-envio/callback";

async function getCustomPrintShippingLabelContext(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, storeId: string, requestId: string) {
  const [{ data: request }, { data: delivery }, { data: offer }, { data: origin }, { data: paid }, { data: chargeback }] = await Promise.all([
    admin.from("custom_print_requests").select("id, buyer_id, model_name, quantity, status, winning_store_id").eq("id", requestId).maybeSingle(),
    admin.from("custom_print_deliveries").select("*").eq("request_id", requestId).maybeSingle(),
    admin.from("custom_print_offers").select("total_brl").eq("request_id", requestId).eq("store_id", storeId).eq("status", "accepted").maybeSingle(),
    admin.from("store_shipping_origins").select("*").eq("store_id", storeId).maybeSingle(),
    admin.from("seller_order_payments").select("id").eq("custom_print_request_id", requestId).eq("status", "paid").limit(1),
    admin.from("seller_order_payments").select("id").eq("custom_print_request_id", requestId).eq("status", "charged_back").limit(1),
  ]);
  const sender = origin ? validateMelhorEnvioSender({
    senderName: origin.sender_name, senderEmail: origin.sender_email, senderPhone: origin.sender_phone,
    senderDocument: origin.sender_document, senderStateRegister: origin.sender_state_register,
    senderStreet: origin.sender_street, senderNumber: origin.sender_number, senderComplement: origin.sender_complement,
    senderDistrict: origin.sender_district, senderCity: origin.sender_city, senderStateCode: origin.sender_state_code,
  }) : null;
  const { data: buyer } = request?.buyer_id ? await admin.auth.admin.getUserById(request.buyer_id) : { data: null };
  if (!request || request.status !== "completed" || request.winning_store_id !== storeId || !delivery || !offer || !sender || !origin
    || !validateShippingOriginPostalCode(origin.postal_code) || !paid?.length || chargeback?.length || !buyer?.user?.email
    || delivery.shipping_quote_status !== "accepted" || delivery.shipping_carrier !== "melhor_envio"
    || !delivery.shipping_provider_service_id || delivery.shipment_status !== "awaiting_shipment") return null;
  return { request, delivery, offer, origin, sender, buyer: buyer.user };
}

export async function startMelhorEnvioConnect(): Promise<void> {
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  const clientId = process.env.ME_CLIENT_ID;
  const siteUrl = getSiteUrl();
  if (!store || !clientId || !process.env.ME_CLIENT_SECRET || !process.env.ME_TOKEN_ENCRYPTION_KEY || !siteUrl || !createSupabaseAdminClient()) {
    redirect("/painel/maker?resultado=melhor-envio-configurar#frete");
  }
  const state = randomBytes(32).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set("me_oauth_state", `${actor.user.id}.${state}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: melhorEnvioCallbackPath, maxAge: 600,
  });
  const authorizationUrl = new URL(`${process.env.MELHOR_ENVIO_SANDBOX === "true" ? "https://sandbox.melhorenvio.com.br" : "https://melhorenvio.com.br"}/oauth/authorize`);
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", new URL(melhorEnvioCallbackPath, siteUrl).toString());
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("scope", ["shipping-calculate", ...melhorEnvioLabelScopes].join(" "));
  redirect(authorizationUrl.toString());
}

export async function calculateAndOfferSellerOrderShippingQuote(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  if (typeof orderId !== "string" || !uuidPattern.test(orderId)) redirect("/painel/maker?resultado=frete-erro#pedidos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/painel/maker?resultado=melhor-envio-configurar#frete");
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  const { data: order } = store ? await admin.from("seller_purchase_orders")
    .select("id, store_id, status, shipping_quote_status, delivery_postal_code")
    .eq("id", orderId).eq("store_id", store.id).maybeSingle() : { data: null };
  if (!store || !order || order.status !== "accepted" || !["awaiting_quote", "declined"].includes(order.shipping_quote_status)) {
    redirect("/painel/maker?resultado=frete-erro#pedidos");
  }
  const [{ data: origin }, { data: items, error: itemError }] = await Promise.all([
    admin.from("store_shipping_origins").select("postal_code").eq("store_id", store.id).maybeSingle(),
    admin.from("seller_purchase_order_items").select("product_id, unit_price_brl, quantity").eq("order_id", orderId),
  ]);
  if (!origin || !/^\d{8}$/.test(order.delivery_postal_code ?? "") || itemError || !items?.length) {
    redirect("/painel/maker?resultado=frete-pacote-erro#pedidos");
  }
  const { data: products, error: productError } = await admin.from("marketplace_products")
    .select("id, package_weight_g, package_length_cm, package_width_cm, package_height_cm")
    .eq("store_id", store.id).in("id", items.map((item) => item.product_id));
  if (productError || products?.length !== items.length || products.some((product) =>
    !product.package_weight_g || !product.package_length_cm || !product.package_width_cm || !product.package_height_cm)) {
    redirect("/painel/maker?resultado=frete-pacote-erro#pedidos");
  }
  const byId = new Map(products.map((product) => [product.id, product]));
  let rates;
  try {
    rates = await calculateMelhorEnvioRates(store.id, origin.postal_code, order.delivery_postal_code, items.map((item) => {
      const product = byId.get(item.product_id)!;
      return {
        id: item.product_id, width: Number(product.package_width_cm), height: Number(product.package_height_cm),
        length: Number(product.package_length_cm), weight: Number(product.package_weight_g) / 1000,
        insurance_value: Number(item.unit_price_brl), quantity: item.quantity,
      };
    }));
  } catch {
    redirect("/painel/maker?resultado=melhor-envio-erro#frete");
  }
  if (!rates.length) redirect("/painel/maker?resultado=frete-sem-opcoes#pedidos");
  const purchasableRates = rates.filter((rate) => !/azul\s*cargo/i.test(rate.company));
  if (!purchasableRates.length) redirect("/painel/maker?resultado=frete-sem-opcoes#pedidos");
  const cheapest = purchasableRates[0];
  const { error } = await actor.supabase.rpc("set_seller_order_shipping_quote", {
    p_order_id: orderId, p_carrier: "melhor_envio", p_service: cheapest.name,
    p_shipping_cents: Math.round(cheapest.price * 100), p_delivery_days: cheapest.deliveryDays,
    p_provider_service_id: cheapest.id,
  });
  if (error) redirect("/painel/maker?resultado=frete-erro#pedidos");
  revalidatePath("/painel/maker");
  revalidatePath("/orcamentos");
  redirect("/painel/maker?resultado=frete-ofertado#pedidos");
}

export async function createProductDraft(_previous: MakerProductState, formData: FormData): Promise<MakerProductState> {
  const product = validateProductDraft({
    name: formData.get("name"), description: formData.get("description"), categoryId: formData.get("categoryId"), listingType: formData.get("listingType"),
    priceMode: formData.get("priceMode"), priceBrl: formData.get("priceBrl"), imageUrl: formData.get("imageUrl"), tags: formData.get("tags"),
    fulfillmentMode: formData.get("fulfillmentMode"), stockQuantity: formData.get("stockQuantity"), preparationDays: formData.get("preparationDays"),
    variantOptions: formData.get("variantOptions"), variantPricing: formData.get("variantPricing"),
    packageWeightG: formData.get("packageWeightG"), packageLengthCm: formData.get("packageLengthCm"),
    packageWidthCm: formData.get("packageWidthCm"), packageHeightCm: formData.get("packageHeightCm"),
    videoUrl: formData.get("videoUrl"),
  });
  const storeId = formData.get("storeId");
  if (!product || typeof storeId !== "string" || !uuidPattern.test(storeId)) return { message: "Confira nome, categoria e preço do anúncio.", success: false };

  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user) return { message: "Entre na conta para continuar.", success: false };
  if (!actor.authorized) return { message: "Esta conta não tem acesso ao painel de fabricantes.", success: false };
  const { data: store } = await actor.supabase.from("stores").select("id").eq("id", storeId).eq("owner_user_id", actor.user.id).eq("status", "published").maybeSingle();
  if (!store) return { message: "A loja ainda não foi aprovada para publicar rascunhos.", success: false };

  const baseSlug = product.name.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "produto";
  const { data: createdProduct, error } = await actor.supabase.from("marketplace_products").insert({
    store_id: storeId, category_id: product.categoryId, name: product.name, slug: `${baseSlug}-${randomUUID().slice(0, 8)}`,
    description: product.description, listing_type: product.listingType, fulfillment_mode: product.fulfillmentMode,
    price_mode: product.priceMode, price_brl: product.priceBrl, media: product.media, video_url: product.videoUrl, tags: product.tags,
    stock_quantity: product.stockQuantity, preparation_days: product.preparationDays,
    package_weight_g: product.shippingPackage?.weightG ?? null, package_length_cm: product.shippingPackage?.lengthCm ?? null,
    package_width_cm: product.shippingPackage?.widthCm ?? null, package_height_cm: product.shippingPackage?.heightCm ?? null,
    product_properties: { variant_options: product.variantOptions },
    catalog_status: "draft", created_by: actor.user.id,
  }).select("id").single();
  if (error) return { message: "Não foi possível salvar o rascunho. Confira a categoria e tente novamente.", success: false };
  if (product.variantPricing.length) {
    const { error: variantError } = await actor.supabase.rpc("save_maker_product_variants", {
      p_product_id: createdProduct.id,
      p_variants: product.variantPricing.map((variant) => ({
        options: variant.options, priceBrl: variant.priceBrl, stockQuantity: variant.stockQuantity,
      })),
    });
    if (variantError) {
      await actor.supabase.from("marketplace_products").delete().eq("id", createdProduct.id).eq("created_by", actor.user.id);
      return { message: "Não foi possível salvar as variações. Confira se a migração de SKUs está aplicada.", success: false };
    }
  }
  revalidatePath("/painel/maker");
  revalidatePath("/");
  return { message: product.listingType === "digital" ? "Rascunho digital criado. Envie o arquivo STL ou 3MF na lista de anúncios para concluir o cadastro." : "Rascunho salvo. A equipe revisará o anúncio antes da publicação.", success: true, productId: createdProduct.id, personalPriceBrl: product.priceBrl ?? undefined };
}

export async function registerDigitalAssetAction(productId: string, objectPath: string, fileName: string, fileBytes: number,
  commercialPriceBrl: string, rightsAccepted: boolean, previewPath: string | null): Promise<{ message: string; success: boolean }> {
  if (!uuidPattern.test(productId)) return { message: "Anúncio inválido.", success: false };
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) return { message: "Entre na conta de fabricante para continuar.", success: false };
  const { data: product } = await actor.supabase.from("marketplace_products").select("id, price_brl")
    .eq("id", productId).eq("created_by", actor.user.id).eq("listing_type", "digital").eq("catalog_status", "draft").maybeSingle();
  if (!product) return { message: "O anúncio digital não está disponível para edição.", success: false };
  const asset = validateDigitalAsset({ filename: fileName, size: fileBytes, personalPriceBrl: String(product.price_brl), commercialPriceBrl, rightsAccepted });
  if (!asset) return { message: "Confira o arquivo, os preços e a declaração de direitos autorais.", success: false };
  const admin = createSupabaseAdminClient();
  const previous = admin ? await admin.from("digital_assets").select("object_path, preview_path").eq("product_id", productId).maybeSingle() : null;
  const { error } = await actor.supabase.rpc("register_digital_asset", {
    p_product_id: productId, p_object_path: objectPath, p_file_name: asset.filename,
    p_file_bytes: asset.sizeBytes, p_commercial_price_brl: asset.commercialPriceBrl, p_preview_path: previewPath,
  });
  if (error) return { message: "Não foi possível registrar os arquivos. Confira se o upload terminou e se as migrações 030 e 032 estão aplicadas.", success: false };
  if (admin && previous?.data?.object_path && previous.data.object_path !== objectPath) {
    await admin.storage.from("digital-assets").remove([previous.data.object_path]);
  }
  if (admin && previewPath && previous?.data?.preview_path && previous.data.preview_path !== previewPath) {
    await admin.storage.from("digital-assets").remove([previous.data.preview_path]);
  }
  revalidatePath("/painel/maker");
  revalidatePath("/admin/fabricantes");
  return { message: "Arquivo original privado, prévia GLB e licenças registrados. O anúncio pode seguir para análise.", success: true };
}

export async function updateProductInventory(formData: FormData): Promise<void> {
  const productId = formData.get("productId");
  if (typeof productId !== "string" || !uuidPattern.test(productId)) redirect("/painel/maker?resultado=estoque-erro#produtos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: product } = await actor.supabase.from("marketplace_products").select("id, price_mode").eq("id", productId).maybeSingle();
  const inventory = product ? validateProductInventory(Object.fromEntries(formData.entries()), product.price_mode) : null;
  if (!product || !inventory) redirect("/painel/maker?resultado=estoque-erro#produtos");
  const { error } = await actor.supabase.rpc("update_maker_product_inventory", {
    p_product_id: product.id, p_fulfillment_mode: inventory.fulfillmentMode,
    p_stock_quantity: inventory.stockQuantity, p_preparation_days: inventory.preparationDays,
  });
  if (error) redirect("/painel/maker?resultado=estoque-erro#produtos");
  revalidatePath("/painel/maker");
  revalidatePath("/");
  redirect("/painel/maker?resultado=estoque-salvo#produtos");
}

export async function updateProductShippingPackage(formData: FormData): Promise<void> {
  const productId = formData.get("productId");
  if (typeof productId !== "string" || !uuidPattern.test(productId)) redirect("/painel/maker?resultado=embalagem-erro#produtos");
  const shippingPackage = validateProductShippingPackage({
    packageWeightG: formData.get("packageWeightG"), packageLengthCm: formData.get("packageLengthCm"),
    packageWidthCm: formData.get("packageWidthCm"), packageHeightCm: formData.get("packageHeightCm"),
  });
  if (shippingPackage === null) redirect("/painel/maker?resultado=embalagem-erro#produtos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("save_maker_product_shipping_package", {
    p_product_id: productId, p_weight_g: shippingPackage?.weightG ?? null,
    p_length_cm: shippingPackage?.lengthCm ?? null, p_width_cm: shippingPackage?.widthCm ?? null,
    p_height_cm: shippingPackage?.heightCm ?? null,
  });
  if (error) redirect("/painel/maker?resultado=embalagem-erro#produtos");
  revalidatePath("/painel/maker");
  revalidatePath("/");
  redirect("/painel/maker?resultado=embalagem-salva#produtos");
}

export async function updateProductVariants(formData: FormData): Promise<void> {
  const productId = formData.get("productId");
  if (typeof productId !== "string" || !uuidPattern.test(productId)) redirect("/painel/maker?resultado=variacao-erro#produtos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: product } = await actor.supabase.from("marketplace_products")
    .select("id, fulfillment_mode, product_properties").eq("id", productId).eq("listing_type", "physical").eq("price_mode", "fixed").maybeSingle();
  const properties = product?.product_properties && typeof product.product_properties === "object" && !Array.isArray(product.product_properties)
    ? product.product_properties as Record<string, unknown> : {};
  const options = normalizeProductVariantOptions(properties.variant_options);
  const fulfillmentMode = product?.fulfillment_mode === "ready_to_ship" ? "ready_to_ship"
    : product?.fulfillment_mode === "made_to_order" ? "made_to_order" : null;
  const variants = options && fulfillmentMode ? validateProductVariantPricing(formData.get("variantPricing"), options, fulfillmentMode) : null;
  if (!product || !variants?.length) redirect("/painel/maker?resultado=variacao-erro#produtos");
  const { error } = await actor.supabase.rpc("save_maker_product_variants", {
    p_product_id: product.id, p_variants: variants.map((variant) => ({
      options: variant.options, priceBrl: variant.priceBrl, stockQuantity: variant.stockQuantity,
    })),
  });
  if (error) redirect("/painel/maker?resultado=variacao-erro#produtos");
  revalidatePath("/painel/maker");
  revalidatePath("/");
  redirect("/painel/maker?resultado=variacao-salva#produtos");
}

export async function saveStoreNotificationContacts(_previous: StoreNotificationContactState, formData: FormData): Promise<StoreNotificationContactState> {
  const contacts = validateStoreNotificationContacts({ email: formData.get("email"), whatsapp: formData.get("whatsapp"), whatsappOptIn: formData.get("whatsappOptIn") });
  if (!contacts) return { message: "Informe um e-mail válido. Para WhatsApp, use um número brasileiro e confirme o consentimento.", success: false };
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user) return { message: "Entre na conta para continuar.", success: false };
  if (!actor.authorized) return { message: "Esta conta não tem acesso ao painel de fabricantes.", success: false };
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) return { message: "Não foi possível localizar sua loja.", success: false };
  const { error } = await actor.supabase.from("store_notification_contacts").upsert({
    store_id: store.id, email: contacts.email, whatsapp: contacts.whatsapp, whatsapp_opt_in: contacts.whatsappOptIn,
    whatsapp_opt_in_at: contacts.whatsappOptIn ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  }, { onConflict: "store_id" });
  if (error) return { message: "Não foi possível salvar os contatos. Confira se a migração de notificações foi aplicada.", success: false };
  revalidatePath("/painel/maker");
  return { message: "Contatos de notificação salvos.", success: true };
}

export async function saveMakerStoreProfile(formData: FormData): Promise<void> {
  const description = formData.get("description");
  const logoUrl = formData.get("logoUrl");
  const bannerUrl = formData.get("bannerUrl");
  const city = formData.get("city");
  const stateCode = formData.get("stateCode");
  const policies = formData.get("commercialPolicies");
  const imageUrl = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string" || !value.trim()) return value === "" ? null : undefined;
    try {
      const url = new URL(value.trim());
      return url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password && value.length <= 2048 ? url.toString() : undefined;
    } catch { return undefined; }
  };
  const logo = imageUrl(logoUrl);
  const banner = imageUrl(bannerUrl);
  if (typeof description !== "string" || description.length > 1000
    || typeof city !== "string" || city.length > 80
    || typeof stateCode !== "string" || (stateCode.trim() && !/^[a-z]{2}$/i.test(stateCode.trim()))
    || typeof policies !== "string" || policies.length > 2000 || logo === undefined || banner === undefined) {
    redirect("/painel/maker?resultado=loja-perfil-erro");
  }
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: slug, error } = await actor.supabase.rpc("save_maker_store_profile", {
    p_description: description, p_logo_url: logo, p_banner_url: banner,
    p_city: city, p_state_code: stateCode.trim().toUpperCase() || null, p_commercial_policies: policies,
  });
  if (error || typeof slug !== "string") redirect("/painel/maker?resultado=loja-perfil-erro");
  revalidatePath("/painel/maker");
  revalidatePath(`/lojas/${slug}`);
  revalidatePath("/lojas");
  revalidatePath("/");
  redirect("/painel/maker?resultado=loja-perfil-salvo");
}

export async function saveMakerShippingOrigin(formData: FormData): Promise<void> {
  const postalCode = validateShippingOriginPostalCode(formData.get("postalCode"));
  const sender = validateMelhorEnvioSender(Object.fromEntries(formData));
  if (!postalCode || !sender) redirect("/painel/maker?resultado=frete-origem-erro#loja");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) redirect("/painel/maker?resultado=frete-origem-erro#loja");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/painel/maker?resultado=frete-origem-erro#loja");
  const { error } = await admin.from("store_shipping_origins").upsert({
    store_id: store.id, postal_code: postalCode, ...sender, updated_at: new Date().toISOString(),
  }, { onConflict: "store_id" });
  if (error) redirect("/painel/maker?resultado=frete-origem-erro#loja");
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=frete-origem-salvo#loja");
}

export async function addSellerOrderShippingLabelToCart(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  const shipment = validateMelhorEnvioShipment(Object.fromEntries(formData));
  if (typeof orderId !== "string" || !uuidPattern.test(orderId) || !shipment) redirect("/painel/maker?resultado=etiqueta-dados-erro#pedidos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/painel/maker?resultado=etiqueta-configurar#frete");
  const { data: store } = await actor.supabase.from("stores").select("id, name").eq("owner_user_id", actor.user.id).maybeSingle();
  const [{ data: order }, { data: origin }, { data: items }] = await Promise.all([
    store ? admin.from("seller_purchase_orders").select("*").eq("id", orderId).eq("store_id", store.id).maybeSingle() : Promise.resolve({ data: null }),
    store ? admin.from("store_shipping_origins").select("*").eq("store_id", store.id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("seller_purchase_order_items").select("product_name, unit_price_brl, quantity").eq("order_id", orderId),
  ]);
  const sender = origin ? validateMelhorEnvioSender({
    senderName: origin.sender_name, senderEmail: origin.sender_email, senderPhone: origin.sender_phone,
    senderDocument: origin.sender_document, senderStateRegister: origin.sender_state_register,
    senderStreet: origin.sender_street, senderNumber: origin.sender_number, senderComplement: origin.sender_complement,
    senderDistrict: origin.sender_district, senderCity: origin.sender_city, senderStateCode: origin.sender_state_code,
  }) : null;
  const [{ data: paidPayments }, { data: chargebacks }] = await Promise.all([
    admin.from("seller_order_payments").select("id").eq("order_id", orderId).eq("status", "paid").limit(1),
    admin.from("seller_order_payments").select("id").eq("order_id", orderId).eq("status", "charged_back").limit(1),
  ]);
  if (!store || !order || order.status !== "accepted" || order.shipping_quote_status !== "accepted"
    || order.shipping_carrier !== "melhor_envio" || !order.shipping_provider_service_id
    || order.shipment_status !== "awaiting_shipment" || !sender || !origin || !validateShippingOriginPostalCode(origin.postal_code) || !items?.length
    || !order.delivery_postal_code || !order.buyer_id || !paidPayments?.length || chargebacks?.length) {
    redirect("/painel/maker?resultado=etiqueta-pedido-erro#pedidos");
  }
  const { data: buyerAuth } = await admin.auth.admin.getUserById(order.buyer_id);
  if (!buyerAuth.user?.email) redirect("/painel/maker?resultado=etiqueta-pedido-erro#pedidos");
  const { data: label, error: createError } = await admin.from("seller_order_shipping_labels")
    .insert({ order_id: orderId, store_id: store.id, status: "creating" }).select("id").maybeSingle();
  if (createError || !label) redirect("/painel/maker?resultado=etiqueta-ja-criada#pedidos");
  const insuredValue = items.reduce((total, item) => total + Number(item.unit_price_brl) * item.quantity, 0);
  try {
    const response = await requestMelhorEnvio(store.id, ["cart-write"], "/api/v2/me/cart", {
      service: Number(order.shipping_provider_service_id),
      from: {
        name: sender.sender_name, email: sender.sender_email, phone: sender.sender_phone,
        ...(sender.sender_document.length === 14 ? { company_document: sender.sender_document } : { document: sender.sender_document }),
        state_register: sender.sender_state_register, address: sender.sender_street, number: sender.sender_number,
        complement: sender.sender_complement, district: sender.sender_district, city: sender.sender_city,
        postal_code: origin.postal_code, state_abbr: sender.sender_state_code,
      },
      to: {
        name: order.delivery_recipient_name, email: buyerAuth.user.email, phone: shipment.recipientPhone,
        document: shipment.recipientDocument, state_register: "ISENTO", address: order.delivery_street,
        number: order.delivery_number, complement: order.delivery_complement || "", district: order.delivery_district,
        city: order.delivery_city, postal_code: order.delivery_postal_code, country_id: "BR", state_abbr: order.delivery_state_code,
      },
      products: items.map((item) => ({ name: item.product_name, quantity: String(item.quantity), unitary_value: Number(item.unit_price_brl) })),
      // shortcut: use one seller-confirmed parcel per order; add per-package quotes and label rows when multi-volume checkout is needed.
      volumes: [{ height: shipment.heightCm, width: shipment.widthCm, length: shipment.lengthCm, weight: shipment.weightKg }],
      options: {
        platform: "ViraPeca 3D", reminder: `Pedido ${orderId.slice(0, 8)}`, insurance_value: insuredValue,
        receipt: false, own_hand: false, reverse: false, invoice: { key: shipment.invoiceKey },
        tags: [{ tag: orderId, url: null }],
      },
    });
    const result = Array.isArray(response) ? response[0] : response;
    const data = result && typeof result === "object" && "data" in result && result.data && typeof result.data === "object"
      ? result.data as Record<string, unknown> : result as Record<string, unknown>;
    const providerOrderId = typeof data?.id === "string" ? data.id : "";
    const price = Number(data?.price ?? data?.custom_price ?? data?.total);
    if (!providerOrderId || providerOrderId.length > 120 || !Number.isFinite(price) || price < 0 || price > 1000000) throw new Error("Resposta de frete inválida");
    const { error } = await admin.from("seller_order_shipping_labels").update({
      provider_order_id: providerOrderId, shipping_cost_cents: Math.round(price * 100), status: "carted", updated_at: new Date().toISOString(),
    }).eq("id", label.id).eq("status", "creating");
    if (error) throw new Error("Não foi possível salvar a etiqueta");
  } catch {
    await admin.from("seller_order_shipping_labels").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", label.id).eq("status", "creating");
    redirect("/painel/maker?resultado=etiqueta-erro#pedidos");
  }
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=etiqueta-no-carrinho#pedidos");
}

export async function buySellerOrderShippingLabel(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  if (typeof orderId !== "string" || !uuidPattern.test(orderId) || formData.get("confirmPurchase") !== "yes") redirect("/painel/maker?resultado=etiqueta-compra-erro#pedidos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const admin = createSupabaseAdminClient();
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  const { data: label } = admin && store ? await admin.from("seller_order_shipping_labels").select("id, provider_order_id, status, shipping_cost_cents").eq("order_id", orderId).eq("store_id", store.id).maybeSingle() : { data: null };
  const [{ data: order }, { data: paid }, { data: chargeback }] = admin ? await Promise.all([
    admin.from("seller_purchase_orders").select("status, shipping_quote_status, shipment_status").eq("id", orderId).eq("store_id", store?.id ?? "").maybeSingle(),
    admin.from("seller_order_payments").select("id").eq("order_id", orderId).eq("status", "paid").limit(1),
    admin.from("seller_order_payments").select("id").eq("order_id", orderId).eq("status", "charged_back").limit(1),
  ]) : [{ data: null }, { data: null }, { data: null }];
  if (!admin || !store || !label || !label.provider_order_id || label.status !== "carted" || label.shipping_cost_cents === null
    || order?.status !== "accepted" || order.shipping_quote_status !== "accepted" || order.shipment_status !== "awaiting_shipment"
    || !paid?.length || chargeback?.length) redirect("/painel/maker?resultado=etiqueta-compra-erro#pedidos");
  const { data: claimed } = await admin.from("seller_order_shipping_labels").update({ status: "checkout_started", updated_at: new Date().toISOString() })
    .eq("id", label.id).eq("status", "carted").select("id").maybeSingle();
  if (!claimed) redirect("/painel/maker?resultado=etiqueta-ja-comprada#pedidos");
  try {
    await requestMelhorEnvio(store.id, ["shipping-checkout", "cart-read"], "/api/v2/me/shipment/checkout", { orders: [label.provider_order_id] });
  } catch {
    await admin.from("seller_order_shipping_labels").update({ status: "checkout_uncertain", updated_at: new Date().toISOString() }).eq("id", label.id).eq("status", "checkout_started");
    redirect("/painel/maker?resultado=etiqueta-compra-incerta#pedidos");
  }
  await admin.from("seller_order_shipping_labels").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", label.id).eq("status", "checkout_started");
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=etiqueta-paga#pedidos");
}

export async function generateSellerOrderShippingLabel(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  if (typeof orderId !== "string" || !uuidPattern.test(orderId)) redirect("/painel/maker?resultado=etiqueta-geracao-erro#pedidos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const admin = createSupabaseAdminClient();
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  const { data: label } = admin && store ? await admin.from("seller_order_shipping_labels").select("id, provider_order_id, status").eq("order_id", orderId).eq("store_id", store.id).maybeSingle() : { data: null };
  const [{ data: order }, { data: paid }, { data: chargeback }] = admin ? await Promise.all([
    admin.from("seller_purchase_orders").select("status, shipping_quote_status, shipment_status").eq("id", orderId).eq("store_id", store?.id ?? "").maybeSingle(),
    admin.from("seller_order_payments").select("id").eq("order_id", orderId).eq("status", "paid").limit(1),
    admin.from("seller_order_payments").select("id").eq("order_id", orderId).eq("status", "charged_back").limit(1),
  ]) : [{ data: null }, { data: null }, { data: null }];
  if (!admin || !store || !label?.provider_order_id || label.status !== "paid" || order?.status !== "accepted"
    || order.shipping_quote_status !== "accepted" || !paid?.length || chargeback?.length) redirect("/painel/maker?resultado=etiqueta-geracao-erro#pedidos");
  const { data: claimed } = await admin.from("seller_order_shipping_labels").update({ status: "generating", updated_at: new Date().toISOString() })
    .eq("id", label.id).eq("status", "paid").select("id").maybeSingle();
  if (!claimed) redirect("/painel/maker?resultado=etiqueta-geracao-erro#pedidos");
  try {
    await requestMelhorEnvio(store.id, ["shipping-generate"], "/api/v2/me/shipment/generate", { orders: [label.provider_order_id] });
  } catch {
    await admin.from("seller_order_shipping_labels").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", label.id).eq("status", "generating");
    redirect("/painel/maker?resultado=etiqueta-geracao-erro#pedidos");
  }
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=etiqueta-gerando#pedidos");
}

export async function printSellerOrderShippingLabel(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  if (typeof orderId !== "string" || !uuidPattern.test(orderId)) redirect("/painel/maker?resultado=etiqueta-impressao-erro#pedidos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const admin = createSupabaseAdminClient();
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  const { data: label } = admin && store ? await admin.from("seller_order_shipping_labels").select("id, provider_order_id, status").eq("order_id", orderId).eq("store_id", store.id).maybeSingle() : { data: null };
  if (!admin || !store || !label?.provider_order_id || label.status !== "generated") redirect("/painel/maker?resultado=etiqueta-impressao-erro#pedidos");
  try {
    const result = await requestMelhorEnvio(store.id, ["shipping-print"], "/api/v2/me/shipment/print", { orders: [label.provider_order_id], mode: "private" });
    const data = result && typeof result === "object" && "data" in result ? (result as { data: unknown }).data : result;
    const printUrl = data && typeof data === "object" && "url" in data ? (data as { url: unknown }).url : null;
    if (typeof printUrl !== "string" || !printUrl.startsWith("https://") || printUrl.length > 2048) throw new Error("Link privado da etiqueta indisponível");
    await admin.from("seller_order_shipping_labels").update({ print_url: printUrl, updated_at: new Date().toISOString() }).eq("id", label.id);
  } catch { redirect("/painel/maker?resultado=etiqueta-impressao-erro#pedidos"); }
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=etiqueta-impressa#pedidos");
}

export async function addCustomPrintShippingLabelToCart(formData: FormData): Promise<void> {
  const requestId = formData.get("customPrintRequestId");
  const shipment = validateMelhorEnvioShipment(Object.fromEntries(formData));
  if (typeof requestId !== "string" || !uuidPattern.test(requestId) || !shipment) redirect("/painel/maker?resultado=etiqueta-dados-erro#pedidos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/painel/maker?resultado=etiqueta-configurar#frete");
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  const context = store ? await getCustomPrintShippingLabelContext(admin, store.id, requestId) : null;
  if (!store || !context) redirect("/painel/maker?resultado=etiqueta-pedido-erro#pedidos");
  if (shipment.widthCm !== Number(context.delivery.shipping_package_width_cm)
    || shipment.heightCm !== Number(context.delivery.shipping_package_height_cm)
    || shipment.lengthCm !== Number(context.delivery.shipping_package_length_cm)
    || shipment.weightKg !== Number(context.delivery.shipping_package_weight_kg)) {
    redirect("/painel/maker?resultado=etiqueta-pacote-diverge#pedidos");
  }
  const { data: label, error: createError } = await admin.from("seller_order_shipping_labels")
    .insert({ custom_print_request_id: requestId, store_id: store.id, status: "creating" }).select("id").maybeSingle();
  if (createError || !label) redirect("/painel/maker?resultado=etiqueta-ja-criada#pedidos");
  try {
    const response = await requestMelhorEnvio(store.id, ["cart-write"], "/api/v2/me/cart", {
      service: Number(context.delivery.shipping_provider_service_id),
      from: {
        name: context.sender.sender_name, email: context.sender.sender_email, phone: context.sender.sender_phone,
        ...(context.sender.sender_document.length === 14 ? { company_document: context.sender.sender_document } : { document: context.sender.sender_document }),
        state_register: context.sender.sender_state_register, address: context.sender.sender_street, number: context.sender.sender_number,
        complement: context.sender.sender_complement, district: context.sender.sender_district, city: context.sender.sender_city,
        postal_code: context.origin.postal_code, state_abbr: context.sender.sender_state_code,
      },
      to: {
        name: context.delivery.delivery_recipient_name, email: context.buyer.email!, phone: shipment.recipientPhone,
        document: shipment.recipientDocument, state_register: "ISENTO", address: context.delivery.delivery_street,
        number: context.delivery.delivery_number, complement: context.delivery.delivery_complement || "", district: context.delivery.delivery_district,
        city: context.delivery.delivery_city, postal_code: context.delivery.delivery_postal_code, country_id: "BR", state_abbr: context.delivery.delivery_state_code,
      },
      products: [{ name: String(context.request.model_name).slice(0, 120), quantity: String(context.request.quantity),
        unitary_value: Number(context.offer.total_brl) / Number(context.request.quantity) }],
      volumes: [{ height: shipment.heightCm, width: shipment.widthCm, length: shipment.lengthCm, weight: shipment.weightKg }],
      options: {
        platform: "ViraPeca 3D", reminder: `Impressão ${requestId.slice(0, 8)}`, insurance_value: Number(context.offer.total_brl),
        receipt: false, own_hand: false, reverse: false, invoice: { key: shipment.invoiceKey },
        tags: [{ tag: requestId, url: null }],
      },
    });
    const result = Array.isArray(response) ? response[0] : response;
    const data = result && typeof result === "object" && "data" in result && result.data && typeof result.data === "object"
      ? result.data as Record<string, unknown> : result as Record<string, unknown>;
    const providerOrderId = typeof data?.id === "string" ? data.id : "";
    const price = Number(data?.price ?? data?.custom_price ?? data?.total);
    if (!providerOrderId || providerOrderId.length > 120 || !Number.isFinite(price) || price < 0 || price > 1000000) throw new Error("Resposta de frete inválida");
    const { error } = await admin.from("seller_order_shipping_labels").update({
      provider_order_id: providerOrderId, shipping_cost_cents: Math.round(price * 100), status: "carted", updated_at: new Date().toISOString(),
    }).eq("id", label.id).eq("status", "creating");
    if (error) throw new Error("Não foi possível salvar a etiqueta");
  } catch {
    await admin.from("seller_order_shipping_labels").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", label.id).eq("status", "creating");
    redirect("/painel/maker?resultado=etiqueta-erro#pedidos");
  }
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=etiqueta-no-carrinho#pedidos");
}

export async function buyCustomPrintShippingLabel(formData: FormData): Promise<void> {
  const requestId = formData.get("customPrintRequestId");
  if (typeof requestId !== "string" || !uuidPattern.test(requestId) || formData.get("confirmPurchase") !== "yes") redirect("/painel/maker?resultado=etiqueta-compra-erro#pedidos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const admin = createSupabaseAdminClient();
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  const { data: label } = admin && store ? await admin.from("seller_order_shipping_labels").select("id, provider_order_id, status, shipping_cost_cents").eq("custom_print_request_id", requestId).eq("store_id", store.id).maybeSingle() : { data: null };
  const context = admin && store ? await getCustomPrintShippingLabelContext(admin, store.id, requestId) : null;
  if (!admin || !store || !context || !label?.provider_order_id || label.status !== "carted" || label.shipping_cost_cents === null) redirect("/painel/maker?resultado=etiqueta-compra-erro#pedidos");
  const { data: claimed } = await admin.from("seller_order_shipping_labels").update({ status: "checkout_started", updated_at: new Date().toISOString() })
    .eq("id", label.id).eq("status", "carted").select("id").maybeSingle();
  if (!claimed) redirect("/painel/maker?resultado=etiqueta-ja-comprada#pedidos");
  try {
    await requestMelhorEnvio(store.id, ["shipping-checkout", "cart-read"], "/api/v2/me/shipment/checkout", { orders: [label.provider_order_id] });
  } catch {
    await admin.from("seller_order_shipping_labels").update({ status: "checkout_uncertain", updated_at: new Date().toISOString() }).eq("id", label.id).eq("status", "checkout_started");
    redirect("/painel/maker?resultado=etiqueta-compra-incerta#pedidos");
  }
  await admin.from("seller_order_shipping_labels").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", label.id).eq("status", "checkout_started");
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=etiqueta-paga#pedidos");
}

export async function generateCustomPrintShippingLabel(formData: FormData): Promise<void> {
  const requestId = formData.get("customPrintRequestId");
  if (typeof requestId !== "string" || !uuidPattern.test(requestId)) redirect("/painel/maker?resultado=etiqueta-geracao-erro#pedidos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const admin = createSupabaseAdminClient();
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  const { data: label } = admin && store ? await admin.from("seller_order_shipping_labels").select("id, provider_order_id, status").eq("custom_print_request_id", requestId).eq("store_id", store.id).maybeSingle() : { data: null };
  const context = admin && store ? await getCustomPrintShippingLabelContext(admin, store.id, requestId) : null;
  if (!admin || !store || !context || !label?.provider_order_id || label.status !== "paid") redirect("/painel/maker?resultado=etiqueta-geracao-erro#pedidos");
  const { data: claimed } = await admin.from("seller_order_shipping_labels").update({ status: "generating", updated_at: new Date().toISOString() })
    .eq("id", label.id).eq("status", "paid").select("id").maybeSingle();
  if (!claimed) redirect("/painel/maker?resultado=etiqueta-geracao-erro#pedidos");
  try {
    await requestMelhorEnvio(store.id, ["shipping-generate"], "/api/v2/me/shipment/generate", { orders: [label.provider_order_id] });
  } catch {
    await admin.from("seller_order_shipping_labels").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", label.id).eq("status", "generating");
    redirect("/painel/maker?resultado=etiqueta-geracao-erro#pedidos");
  }
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=etiqueta-gerando#pedidos");
}

export async function printCustomPrintShippingLabel(formData: FormData): Promise<void> {
  const requestId = formData.get("customPrintRequestId");
  if (typeof requestId !== "string" || !uuidPattern.test(requestId)) redirect("/painel/maker?resultado=etiqueta-impressao-erro#pedidos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const admin = createSupabaseAdminClient();
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  const { data: label } = admin && store ? await admin.from("seller_order_shipping_labels").select("id, provider_order_id, status").eq("custom_print_request_id", requestId).eq("store_id", store.id).maybeSingle() : { data: null };
  if (!admin || !store || !label?.provider_order_id || label.status !== "generated") redirect("/painel/maker?resultado=etiqueta-impressao-erro#pedidos");
  try {
    const result = await requestMelhorEnvio(store.id, ["shipping-print"], "/api/v2/me/shipment/print", { orders: [label.provider_order_id], mode: "private" });
    const data = result && typeof result === "object" && "data" in result ? (result as { data: unknown }).data : result;
    const printUrl = data && typeof data === "object" && "url" in data ? (data as { url: unknown }).url : null;
    if (typeof printUrl !== "string" || !printUrl.startsWith("https://") || printUrl.length > 2048) throw new Error("Link privado da etiqueta indisponível");
    await admin.from("seller_order_shipping_labels").update({ print_url: printUrl, updated_at: new Date().toISOString() }).eq("id", label.id);
  } catch { redirect("/painel/maker?resultado=etiqueta-impressao-erro#pedidos"); }
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=etiqueta-impressa#pedidos");
}

export async function markQuoteRequestNotificationRead(formData: FormData): Promise<void> {
  const requestId = formData.get("requestId");
  if (typeof requestId !== "string" || !uuidPattern.test(requestId)) return;
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) return;
  await actor.supabase.from("product_quote_requests").update({ maker_read_at: new Date().toISOString() }).eq("id", requestId).is("maker_read_at", null);
  revalidatePath("/painel/maker");
}

export async function markCustomPrintTargetRead(formData: FormData): Promise<void> {
  const targetId = formData.get("targetId");
  if (typeof targetId !== "string" || !uuidPattern.test(targetId)) return;
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) return;
  await actor.supabase.rpc("mark_custom_print_target_read", { p_target_id: targetId });
  revalidatePath("/painel/maker");
}

export async function advanceCustomPrintProduction(formData: FormData): Promise<void> {
  const requestId = formData.get("requestId");
  const nextStatus = formData.get("nextStatus");
  if (typeof requestId !== "string" || !uuidPattern.test(requestId) || (nextStatus !== "in_production" && nextStatus !== "completed")) redirect("/painel/maker?resultado=erro");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("advance_custom_print_production", { p_request_id: requestId, p_next_status: nextStatus });
  if (error) redirect("/painel/maker?resultado=erro");
  revalidatePath("/painel/maker");
  revalidatePath("/orcamentos");
  redirect(`/painel/maker?resultado=impressao-${nextStatus === "in_production" ? "iniciada" : "concluida"}`);
}

export async function submitCustomPrintShippingQuote(formData: FormData): Promise<void> {
  const requestId = formData.get("requestId");
  const quote = validateShippingQuote({ carrier: formData.get("carrier"), service: formData.get("service"), price: formData.get("price"), deliveryDays: formData.get("deliveryDays") });
  if (typeof requestId !== "string" || !uuidPattern.test(requestId) || !quote) redirect("/painel/maker?resultado=frete-erro");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("set_custom_print_shipping_quote", {
    p_request_id: requestId, p_carrier: quote.carrier, p_service: quote.service,
    p_shipping_cents: quote.shippingCents, p_delivery_days: quote.deliveryDays,
  });
  if (error) redirect("/painel/maker?resultado=frete-erro");
  revalidatePath("/painel/maker");
  revalidatePath("/orcamentos");
  redirect("/painel/maker?resultado=frete-ofertado");
}

export async function calculateAndOfferCustomPrintShippingQuote(formData: FormData): Promise<void> {
  const requestId = formData.get("requestId");
  const parcel = validateMelhorEnvioPackage({
    packageWidthCm: formData.get("packageWidthCm"), packageHeightCm: formData.get("packageHeightCm"),
    packageLengthCm: formData.get("packageLengthCm"), packageWeightKg: formData.get("packageWeightKg"),
  });
  if (typeof requestId !== "string" || !uuidPattern.test(requestId) || !parcel) redirect("/painel/maker?resultado=frete-pacote-personalizado-erro#pedidos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/painel/maker?resultado=melhor-envio-configurar#frete");
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  const [{ data: request }, { data: delivery }, { data: offer }, { data: origin }] = await Promise.all([
    admin.from("custom_print_requests").select("id, status, winning_store_id").eq("id", requestId).maybeSingle(),
    admin.from("custom_print_deliveries").select("delivery_postal_code, shipping_quote_status").eq("request_id", requestId).maybeSingle(),
    admin.from("custom_print_offers").select("total_brl").eq("request_id", requestId).eq("store_id", store?.id ?? "").eq("status", "accepted").maybeSingle(),
    store ? admin.from("store_shipping_origins").select("postal_code").eq("store_id", store.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!store || !request || request.status !== "accepted" || request.winning_store_id !== store.id || !delivery
    || !["awaiting_quote", "declined"].includes(delivery.shipping_quote_status) || !offer || !origin
    || !/^\d{8}$/.test(delivery.delivery_postal_code ?? "")) redirect("/painel/maker?resultado=frete-erro#pedidos");
  let rates;
  try {
    rates = await calculateMelhorEnvioRates(store.id, origin.postal_code, delivery.delivery_postal_code, [{
      id: request.id, width: parcel.widthCm, height: parcel.heightCm, length: parcel.lengthCm, weight: parcel.weightKg,
      insurance_value: Number(offer.total_brl), quantity: 1,
    }]);
  } catch {
    redirect("/painel/maker?resultado=melhor-envio-erro#frete");
  }
  const cheapest = rates.find((rate) => !/azul\s*cargo/i.test(rate.company));
  if (!cheapest) redirect("/painel/maker?resultado=frete-sem-opcoes#pedidos");
  const { error } = await actor.supabase.rpc("set_custom_print_shipping_quote", {
    p_request_id: requestId, p_carrier: "melhor_envio", p_service: cheapest.name,
    p_shipping_cents: Math.round(cheapest.price * 100), p_delivery_days: cheapest.deliveryDays,
    p_provider_service_id: cheapest.id,
    p_package_width_cm: parcel.widthCm, p_package_height_cm: parcel.heightCm,
    p_package_length_cm: parcel.lengthCm, p_package_weight_kg: parcel.weightKg,
  });
  if (error) redirect("/painel/maker?resultado=frete-erro#pedidos");
  revalidatePath("/painel/maker");
  revalidatePath("/orcamentos");
  redirect("/painel/maker?resultado=frete-ofertado#pedidos");
}

export async function markCustomPrintShipped(formData: FormData): Promise<void> {
  const requestId = formData.get("requestId");
  const shipment = validateShipmentTracking({
    trackingCode: formData.get("trackingCode"), trackingUrl: formData.get("trackingUrl"), expectedDate: formData.get("expectedDate"),
  });
  if (typeof requestId !== "string" || !uuidPattern.test(requestId) || !shipment) redirect("/painel/maker?resultado=envio-erro");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("mark_custom_print_shipped", {
    p_request_id: requestId, p_tracking_code: shipment.trackingCode,
    p_tracking_url: shipment.trackingUrl, p_expected_date: shipment.expectedDate,
  });
  if (error) redirect("/painel/maker?resultado=envio-erro");
  revalidatePath("/painel/maker");
  revalidatePath("/orcamentos");
  redirect("/painel/maker?resultado=pedido-enviado");
}

export async function submitSellerOrderShippingQuote(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  const quote = validateShippingQuote({ carrier: formData.get("carrier"), service: formData.get("service"), price: formData.get("price"), deliveryDays: formData.get("deliveryDays") });
  if (typeof orderId !== "string" || !uuidPattern.test(orderId) || !quote) redirect("/painel/maker?resultado=frete-erro");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("set_seller_order_shipping_quote", {
    p_order_id: orderId, p_carrier: quote.carrier, p_service: quote.service,
    p_shipping_cents: quote.shippingCents, p_delivery_days: quote.deliveryDays,
  });
  if (error) redirect("/painel/maker?resultado=frete-erro");
  revalidatePath("/painel/maker");
  revalidatePath("/orcamentos");
  redirect("/painel/maker?resultado=frete-ofertado");
}

export async function markSellerPurchaseOrderShipped(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  const shipment = validateShipmentTracking({
    trackingCode: formData.get("trackingCode"), trackingUrl: formData.get("trackingUrl"), expectedDate: formData.get("expectedDate"),
  });
  if (typeof orderId !== "string" || !uuidPattern.test(orderId) || !shipment) redirect("/painel/maker?resultado=envio-erro");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("mark_seller_purchase_order_shipped", {
    p_order_id: orderId, p_tracking_code: shipment.trackingCode, p_tracking_url: shipment.trackingUrl, p_expected_date: shipment.expectedDate,
  });
  if (error) redirect("/painel/maker?resultado=envio-erro");
  revalidatePath("/painel/maker");
  revalidatePath("/orcamentos");
  redirect("/painel/maker?resultado=pedido-enviado");
}

export async function retryCustomPrintNotificationDelivery(formData: FormData): Promise<void> {
  const deliveryId = formData.get("deliveryId");
  if (typeof deliveryId !== "string" || !uuidPattern.test(deliveryId)) return;
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) return;
  const { error } = await actor.supabase.rpc("retry_custom_print_notification_delivery", { p_delivery_id: deliveryId });
  if (!error) after(dispatchNotificationQueue);
  revalidatePath("/painel/maker");
}

export async function createCustomPrintFileLinks(_previous: CustomPrintFileLinksState, formData: FormData): Promise<CustomPrintFileLinksState> {
  const targetId = formData.get("targetId");
  if (typeof targetId !== "string" || !uuidPattern.test(targetId)) return { message: "Solicitação indisponível.", links: [] };
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user) return { message: "Entre na conta para continuar.", links: [] };
  if (!actor.authorized) return { message: "Esta conta não tem acesso ao painel de fabricantes.", links: [] };
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) return { message: "Loja não encontrada.", links: [] };
  const { data: target } = await actor.supabase.from("custom_print_request_targets")
    .select("id, status, request:custom_print_requests!inner(id, upload_id, status)")
    .eq("id", targetId).eq("store_id", store.id).maybeSingle();
  const request = Array.isArray(target?.request) ? target.request[0] : target?.request;
  const hasFileAccess = target && request && ((["pending", "offered"].includes(request.status) && ["invited", "offered"].includes(target.status))
    || (["accepted", "in_production"].includes(request.status) && target.status === "accepted"));
  if (!hasFileAccess || !request.upload_id) return { message: "O acesso aos arquivos desta solicitação foi encerrado.", links: [] };
  const admin = createSupabaseAdminClient();
  if (!admin) return { message: "Download temporário indisponível até configurar o acesso seguro ao armazenamento.", links: [] };
  const { data: upload } = await admin.from("buyer_model_uploads").select("buyer_id, bundle_id, files").eq("id", request.upload_id).maybeSingle();
  if (!upload || !Array.isArray(upload.files) || upload.files.length < 1 || upload.files.length > 10) return { message: "Os arquivos originais não estão disponíveis.", links: [] };
  const files = upload.files as Array<{ name?: unknown; storage_name?: unknown }>;
  if (files.some((file) => typeof file.name !== "string" || typeof file.storage_name !== "string" || !/^[A-Za-z0-9_. -]{1,200}$/.test(file.storage_name))) return { message: "Manifesto de arquivos inválido.", links: [] };
  const links = await Promise.all(files.map(async (file) => {
    const path = `${upload.buyer_id}/${upload.bundle_id}/${file.storage_name}`;
    const { data, error } = await admin.storage.from("buyer-models").createSignedUrl(path, 120, { download: file.name as string });
    return error || !data ? null : { name: file.name as string, url: data.signedUrl };
  }));
  if (links.some((link) => link == null)) return { message: "Não foi possível preparar todos os arquivos. Tente novamente.", links: [] };
  return { message: "Links seguros expiram em 2 minutos.", links: links as { name: string; url: string }[] };
}

export async function markSellerOrderNotificationRead(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  if (typeof orderId !== "string" || !uuidPattern.test(orderId)) return;
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) return;
  await actor.supabase.rpc("mark_seller_order_read", { p_order_id: orderId });
  revalidatePath("/painel/maker");
}

export async function retryStoreNotificationDelivery(formData: FormData): Promise<void> {
  const deliveryId = formData.get("deliveryId");
  if (typeof deliveryId !== "string" || !uuidPattern.test(deliveryId)) return;
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) return;
  const { error } = await actor.supabase.rpc("retry_store_notification_delivery", { delivery_id: deliveryId });
  if (!error) after(dispatchNotificationQueue);
  revalidatePath("/painel/maker");
}

export async function deleteProductDraft(formData: FormData): Promise<void> {
  const productId = formData.get("productId");
  if (typeof productId !== "string" || !uuidPattern.test(productId)) return;
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) return;
  const admin = createSupabaseAdminClient();
  const asset = admin ? await admin.from("digital_assets").select("object_path, preview_path").eq("product_id", productId).maybeSingle() : null;
  const { error } = await actor.supabase.from("marketplace_products").delete().eq("id", productId).eq("created_by", actor.user.id).eq("catalog_status", "draft");
  if (!error && admin && asset?.data) await admin.storage.from("digital-assets").remove([asset.data.object_path, ...(asset.data.preview_path ? [asset.data.preview_path] : [])]);
  revalidatePath("/painel/maker");
}

export async function saveMakerPrinter(formData: FormData): Promise<void> {
  const values = validateMakerPrinter(Object.fromEntries(formData.entries()));
  const storeId = formData.get("storeId");
  const equipmentId = formData.get("equipmentId");
  if (!values || typeof storeId !== "string" || !uuidPattern.test(storeId)
    || (equipmentId && (typeof equipmentId !== "string" || !uuidPattern.test(equipmentId)))) redirect("/painel/maker?resultado=equipamento-erro#equipamentos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: store } = await actor.supabase.from("stores").select("id").eq("id", storeId).eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) redirect("/painel/maker?resultado=equipamento-erro#equipamentos");

  let model = null;
  if (values.catalogModelId) {
    const result = await actor.supabase.from("printer_models").select("id, manufacturer, model, variant")
      .eq("id", values.catalogModelId).eq("catalog_status", "published").maybeSingle();
    model = result.data;
    if (result.error || !model) redirect("/painel/maker?resultado=modelo-indisponivel#equipamentos");
  }
  const payload = {
    store_id: store.id, catalog_model_id: values.catalogModelId,
    manufacturer_snapshot: model?.manufacturer ?? values.manufacturer!,
    model_snapshot: model?.model ?? values.model!, variant_snapshot: model?.variant ?? "próprio",
    custom_manufacturer: values.catalogModelId ? null : values.manufacturer,
    custom_model: values.catalogModelId ? null : values.model,
    nickname: values.nickname, purchased_at: values.purchasedAt, purchase_price_brl: values.purchasePriceBrl,
    residual_value_brl: values.residualValueBrl, useful_life_hours: values.usefulLifeHours,
    accumulated_hours: values.accumulatedHours, installed_nozzle: values.installedNozzle,
    modifications: values.modifications, measured_average_power_w: values.averagePowerWatts,
    power_measurement_conditions: values.powerConditions, energy_tariff_per_kwh: values.energyTariffPerKwh,
    operational_status: values.status, updated_at: new Date().toISOString(),
  };
  const result = equipmentId
    ? await actor.supabase.from("maker_printers").update(payload).eq("id", equipmentId).eq("store_id", store.id).select("id").maybeSingle()
    : await actor.supabase.from("maker_printers").insert(payload).select("id").single();
  if (result.error || !result.data) redirect("/painel/maker?resultado=equipamento-erro#equipamentos");
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=equipamento-salvo#equipamentos");
}

export async function suggestPrinterModelAction(formData: FormData): Promise<void> {
  const suggestion = validatePrinterModelSuggestion(Object.fromEntries(formData.entries()));
  if (!suggestion) redirect("/painel/maker?resultado=modelo-sugestao-erro#equipamentos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) redirect("/painel/maker?resultado=modelo-sugestao-erro#equipamentos");
  const { error } = await actor.supabase.rpc("submit_printer_model_suggestion", {
    p_manufacturer: suggestion.manufacturer, p_model: suggestion.model, p_variant: suggestion.variant,
    p_technology: suggestion.technology, p_source_url: suggestion.sourceUrl, p_notes: suggestion.notes,
  });
  if (error) redirect(`/painel/maker?resultado=${error.code === "23505" ? "modelo-sugestao-duplicada" : error.message.includes("SUGGESTION_PENDING_LIMIT") ? "modelo-sugestao-limite" : "modelo-sugestao-erro"}#equipamentos`);
  revalidatePath("/painel/maker");
  revalidatePath("/admin/catalogos/impressoras");
  redirect("/painel/maker?resultado=modelo-sugerido#equipamentos");
}

export async function logPrinterMaintenance(formData: FormData): Promise<void> {
  const printerId = formData.get("printerId");
  const values = Object.fromEntries(formData.entries());
  const entry = validateMaintenanceEntry(values);
  if (typeof printerId !== "string" || !uuidPattern.test(printerId) || !entry) redirect("/painel/maker?resultado=manutencao-erro#equipamentos");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) redirect("/painel/maker?resultado=manutencao-erro#equipamentos");
  const { data: printer } = await actor.supabase.from("maker_printers").select("id, accumulated_hours").eq("id", printerId).eq("store_id", store.id).maybeSingle();
  if (!printer) redirect("/painel/maker?resultado=manutencao-erro#equipamentos");
  const verifiedEntry = validateMaintenanceEntry(values, undefined, Number(printer.accumulated_hours));
  if (!verifiedEntry) redirect("/painel/maker?resultado=manutencao-erro#equipamentos");
  const { error } = await actor.supabase.from("printer_maintenance_events").insert({
    printer_id: printerId, performed_at: verifiedEntry.performedAt, maintenance_type: verifiedEntry.maintenanceType,
    component: verifiedEntry.component, cost_brl: verifiedEntry.costBrl, hours_at_event: verifiedEntry.hoursAtEvent,
    notes: verifiedEntry.notes, next_due_at: verifiedEntry.nextDueAt, next_due_hours: verifiedEntry.nextDueHours,
  });
  if (error) redirect("/painel/maker?resultado=manutencao-erro#equipamentos");
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=manutencao-salva#equipamentos");
}

export async function createMakerConsignmentItem(formData: FormData): Promise<void> {
  const item = validateConsignmentInput(Object.fromEntries(formData.entries()));
  if (!item) redirect("/painel/maker?resultado=consignacao-erro#consignacoes");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  let productName = item.productName;
  if (item.productId) {
    const { data: product } = await actor.supabase.from("marketplace_products").select("name")
      .eq("id", item.productId).eq("catalog_status", "published").maybeSingle();
    if (!product) redirect("/painel/maker?resultado=consignacao-erro#consignacoes");
    productName = product.name;
  }
  const { error } = await actor.supabase.rpc("create_maker_consignment_item_with_fees", {
    p_establishment: item.establishment, p_product_name: productName, p_quantity: item.quantity,
    p_unit_cost_brl: item.unitCostBrl, p_sale_price_brl: item.salePriceBrl,
    p_commission_percent: item.commissionPercent, p_commission_fixed_fee_brl: item.commissionFixedFeeBrl,
    p_product_id: item.productId,
  });
  if (error) redirect("/painel/maker?resultado=consignacao-erro#consignacoes");
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=consignacao-salva#consignacoes");
}

export async function recordMakerConsignmentMovement(formData: FormData): Promise<void> {
  const itemId = formData.get("itemId");
  const movement = validateConsignmentMovement(Object.fromEntries(formData.entries()));
  if (typeof itemId !== "string" || !uuidPattern.test(itemId) || !movement) redirect("/painel/maker?resultado=consignacao-movimento-erro#consignacoes");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("record_maker_consignment_movement", {
    p_item_id: itemId, p_movement_type: movement.movementType, p_quantity: movement.quantity, p_notes: movement.notes,
  });
  if (error) redirect("/painel/maker?resultado=consignacao-movimento-erro#consignacoes");
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=consignacao-movimento-salvo#consignacoes");
}

export async function saveMakerPrintProfile(formData: FormData): Promise<void> {
  const profile = validatePrintProfile(Object.fromEntries(formData.entries()));
  const storeId = formData.get("storeId");
  const profileId = formData.get("profileId");
  if (!profile || typeof storeId !== "string" || !uuidPattern.test(storeId)
    || (profileId && (typeof profileId !== "string" || !uuidPattern.test(profileId)))) redirect("/painel/maker?resultado=perfil-erro#perfis");

  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: store } = await actor.supabase.from("stores").select("id").eq("id", storeId).eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) redirect("/painel/maker?resultado=perfil-erro#perfis");
  const { data: product } = await actor.supabase.from("marketplace_products").select("id").eq("id", profile.productId).eq("store_id", store.id).maybeSingle();
  if (!product) redirect("/painel/maker?resultado=perfil-erro#perfis");

  let printerSnapshot = profile.printerName;
  let printerModelId: string | null = null;
  if (profile.printerId) {
    const { data: printer } = await actor.supabase.from("maker_printers").select("id, nickname, manufacturer_snapshot, model_snapshot, variant_snapshot, catalog_model_id")
      .eq("id", profile.printerId).eq("store_id", store.id).maybeSingle();
    if (!printer) redirect("/painel/maker?resultado=perfil-erro#perfis");
    printerSnapshot = `${printer.nickname} · ${printer.manufacturer_snapshot} ${printer.model_snapshot}`.slice(0, 120);
    if (printer.catalog_model_id) {
      const { data: catalogModel } = await actor.supabase.from("printer_models").select("id").eq("id", printer.catalog_model_id).eq("catalog_status", "published").maybeSingle();
      printerModelId = catalogModel?.id ?? null;
    }
  }

  let materialSnapshot = profile.materialName;
  if (profile.materialId) {
    const { data: material } = await actor.supabase.from("material_catalog").select("id, manufacturer, product, family")
      .eq("id", profile.materialId).eq("catalog_status", "published").maybeSingle();
    if (!material) redirect("/painel/maker?resultado=perfil-erro#perfis");
    materialSnapshot = `${material.manufacturer} ${material.product} · ${material.family}`.slice(0, 120);
  }

  let nozzleSnapshot = profile.nozzleName;
  if (profile.nozzleId) {
    const { data: nozzle } = await actor.supabase.from("nozzle_catalog").select("id, manufacturer, model, diameter_mm, interface")
      .eq("id", profile.nozzleId).eq("catalog_status", "published").maybeSingle();
    if (!nozzle) redirect("/painel/maker?resultado=perfil-erro#perfis");
    nozzleSnapshot = `${nozzle.manufacturer} ${nozzle.model} · ${Number(nozzle.diameter_mm).toLocaleString("pt-BR")} mm${nozzle.interface ? ` · ${nozzle.interface}` : ""}`.slice(0, 120);
  }

  const payload = {
    store_id: store.id, product_id: product.id, profile_name: profile.name, profile_type: profile.profileType,
    sharing_scope: profile.sharingScope, review_status: profile.sharingScope === "community" ? "pending" : "draft",
    reviewed_by: null, reviewed_at: null, review_note: null,
    maker_printer_id: profile.printerId, printer_model_id: printerModelId,
    printer_snapshot: printerSnapshot, material_id: profile.materialId, material_snapshot: materialSnapshot,
    nozzle_id: profile.nozzleId, nozzle_snapshot: nozzleSnapshot, layer_height_mm: profile.layerHeightMm,
    infill_percent: profile.infillPercent, wall_count: profile.wallCount, supports: profile.supports,
    orientation: profile.orientation, scale_percent: profile.scalePercent, quantity: profile.quantity,
    print_hours: profile.printHours, material_grams: profile.materialGrams, material_by_color: profile.materialByColor,
    updated_at: new Date().toISOString(),
  };
  const result = profileId
    ? await actor.supabase.from("maker_print_profiles").update(payload).eq("id", profileId).eq("store_id", store.id).select("id").maybeSingle()
    : await actor.supabase.from("maker_print_profiles").insert(payload).select("id").single();
  if (result.error || !result.data) redirect("/painel/maker?resultado=perfil-erro#perfis");
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=perfil-salvo#perfis");
}

export async function deleteMakerPrintProfile(formData: FormData): Promise<void> {
  const profileId = formData.get("profileId");
  if (typeof profileId !== "string" || !uuidPattern.test(profileId)) redirect("/painel/maker?resultado=perfil-erro#perfis");
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) redirect("/painel/maker?resultado=perfil-erro#perfis");
  const { error } = await actor.supabase.from("maker_print_profiles").delete().eq("id", profileId).eq("store_id", store.id).in("sharing_scope", ["private", "community"]);
  if (error) redirect("/painel/maker?resultado=perfil-erro#perfis");
  revalidatePath("/painel/maker");
  redirect("/painel/maker?resultado=perfil-excluido#perfis");
}
