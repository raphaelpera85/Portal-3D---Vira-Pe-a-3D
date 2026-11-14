"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { isBuyerAddressId } from "@/lib/buyer-address";
import { validateProductQuoteRequest, validateProductVariantSelection } from "@/lib/marketplace-validation";
import { dispatchNotificationQueue } from "@/lib/notification-dispatch.server";
import { normalizeCouponCode } from "@/lib/coupon";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validSlug = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
function cartResultUrl(result: string, couponCode: string | null) {
  const params = new URLSearchParams({ resultado: result });
  if (couponCode) params.set("cupom", couponCode);
  return `/carrinho?${params.toString()}`;
}

export async function addProductToCart(formData: FormData): Promise<void> {
  const slug = formData.get("slug");
  const quantity = validateProductQuoteRequest({ quantity: formData.get("quantity") });
  if (!validSlug(slug) || !quantity) redirect("/carrinho?resultado=erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: product } = await actor.supabase.from("marketplace_products").select("id, product_properties")
    .eq("slug", slug).eq("catalog_status", "published").eq("price_mode", "fixed").maybeSingle();
  if (!product) redirect(`/produtos/${encodeURIComponent(slug)}?carrinho=indisponivel`);
  const variantOptions = validateProductVariantSelection(formData.get("variantOptions"), product.product_properties);
  if (!variantOptions) redirect(`/produtos/${encodeURIComponent(slug)}?carrinho=erro`);
  const rawVariantId = formData.get("variantId");
  if (typeof rawVariantId !== "string" || (rawVariantId !== "" && !uuidPattern.test(rawVariantId))) redirect(`/produtos/${encodeURIComponent(slug)}?carrinho=erro`);
  const { error } = await actor.supabase.rpc("add_product_to_cart", {
    p_product_id: product.id, p_quantity: quantity.quantity, p_variant_options: variantOptions,
    p_variant_id: rawVariantId || null,
  });
  if (error) redirect(`/produtos/${encodeURIComponent(slug)}?carrinho=erro`);
  revalidatePath("/carrinho");
  redirect("/carrinho?resultado=adicionado");
}

export async function setCartItemQuantity(formData: FormData): Promise<void> {
  const itemId = formData.get("itemId");
  const quantity = validateProductQuoteRequest({ quantity: formData.get("quantity") });
  const rawCouponCode = formData.get("couponCode");
  const couponCode = normalizeCouponCode(rawCouponCode);
  if (typeof itemId !== "string" || !uuidPattern.test(itemId) || !quantity) redirect("/carrinho?resultado=erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("set_cart_item_quantity", { p_item_id: itemId, p_quantity: quantity.quantity });
  revalidatePath("/carrinho");
  if (error) redirect(cartResultUrl("erro", couponCode));
  if (rawCouponCode && !couponCode) redirect(cartResultUrl("cupom-invalido", null));
  if (couponCode) {
    const { error: couponError } = await actor.supabase.rpc("preview_marketplace_coupon", { p_code: couponCode });
    if (couponError) redirect(cartResultUrl(couponError.code === "22023" ? "cupom-invalido" : "erro", couponCode));
  }
  redirect(cartResultUrl("atualizado", couponCode));
}

export async function removeCartItem(formData: FormData): Promise<void> {
  const itemId = formData.get("itemId");
  const rawCouponCode = formData.get("couponCode");
  const couponCode = normalizeCouponCode(rawCouponCode);
  if (typeof itemId !== "string" || !uuidPattern.test(itemId)) redirect("/carrinho?resultado=erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("remove_cart_item", { p_item_id: itemId });
  revalidatePath("/carrinho");
  if (error) redirect(cartResultUrl("erro", couponCode));
  if (rawCouponCode && !couponCode) redirect(cartResultUrl("cupom-invalido", null));
  if (couponCode) {
    const { error: couponError } = await actor.supabase.rpc("preview_marketplace_coupon", { p_code: couponCode });
    if (couponError) redirect(cartResultUrl(couponError.code === "22023" ? "cupom-invalido" : "erro", couponCode));
  }
  redirect(cartResultUrl("atualizado", couponCode));
}

export async function applyCartCoupon(formData: FormData): Promise<void> {
  const code = normalizeCouponCode(formData.get("code"));
  if (!code) redirect("/carrinho?resultado=cupom-invalido");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("preview_marketplace_coupon", { p_code: code });
  if (error) redirect(`/carrinho?cupom=${encodeURIComponent(code)}&resultado=cupom-invalido`);
  redirect(`/carrinho?cupom=${encodeURIComponent(code)}&resultado=cupom-aplicado`);
}

export async function removeCartCoupon(): Promise<void> {
  redirect("/carrinho?resultado=cupom-removido");
}

export async function checkoutCart(formData: FormData): Promise<void> {
  const addressId = formData.get("addressId");
  const rawCouponCode = formData.get("couponCode");
  const couponCode = rawCouponCode === null || rawCouponCode === "" ? null : normalizeCouponCode(rawCouponCode);
  if (rawCouponCode !== null && rawCouponCode !== "" && !couponCode) redirect("/carrinho?resultado=cupom-invalido");
  if (!isBuyerAddressId(addressId)) redirect("/carrinho?resultado=endereco-invalido");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: address } = await actor.supabase.from("buyer_addresses").select("id")
    .eq("id", addressId).eq("buyer_id", actor.user.id).maybeSingle();
  if (!address) redirect("/carrinho?resultado=endereco-invalido");
  const { error } = await actor.supabase.rpc("create_orders_from_cart", { p_buyer_address_id: address.id, p_coupon_code: couponCode });
  revalidatePath("/carrinho");
  revalidatePath("/orcamentos");
  revalidatePath("/painel/maker");
  if (error?.message.includes("Coupon")) redirect("/carrinho?resultado=cupom-invalido");
  if (error) redirect("/carrinho?resultado=indisponivel");
  after(dispatchNotificationQueue);
  redirect("/orcamentos?resultado=pedido-enviado");
}
