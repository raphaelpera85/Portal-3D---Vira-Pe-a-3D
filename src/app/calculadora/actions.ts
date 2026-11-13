"use server";

import { revalidatePath } from "next/cache";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateCalculationToSave } from "@/lib/saved-calculation";

export type SaveCalculationState = { message: string; success: boolean };
export type ApplyCalculatedPriceState = { message: string; success: boolean };

export async function applyCalculatedProductPrice(_previous: ApplyCalculatedPriceState, formData: FormData): Promise<ApplyCalculatedPriceState> {
  const productId = formData.get("productId");
  const rawVariantId = formData.get("variantId");
  const rawPrice = formData.get("priceCents");
  const rawExpectedPrice = formData.get("expectedPriceCents");
  const priceCents = typeof rawPrice === "string" && /^\d{1,12}$/.test(rawPrice) ? Number(rawPrice) : NaN;
  const expectedPriceCents = typeof rawExpectedPrice === "string" && /^\d{1,12}$/.test(rawExpectedPrice) ? Number(rawExpectedPrice) : NaN;
  if (typeof productId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)
    || (rawVariantId !== null && rawVariantId !== "" && (typeof rawVariantId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawVariantId)))
    || !Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 99_999_999_999
    || !Number.isSafeInteger(expectedPriceCents) || expectedPriceCents < 1 || expectedPriceCents > 99_999_999_999) {
    return { message: "Preço ou produto inválido. Recalcule antes de aplicar.", success: false };
  }

  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) return { message: "Entre em uma conta de fabricante aprovada para atualizar preços.", success: false };
  const { data: store } = await actor.supabase.from("stores").select("id, slug").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) return { message: "Não foi possível localizar a loja do fabricante.", success: false };
  const { data: product } = await actor.supabase.from("marketplace_products")
    .select("id, store_id, created_by, listing_type, price_mode, price_brl, catalog_status, product_properties, slug")
    .eq("id", productId).eq("store_id", store.id).maybeSingle();
  if (!product || product.created_by !== actor.user.id) return { message: "Aplique o preço somente a um produto da sua própria loja.", success: false };

  const properties = product.product_properties && typeof product.product_properties === "object" && !Array.isArray(product.product_properties)
    ? product.product_properties as Record<string, unknown> : {};
  const variantOptions = properties.variant_options;
  const hasVariants = variantOptions !== null && typeof variantOptions === "object" && !Array.isArray(variantOptions) && Object.keys(variantOptions).length > 0;
  const variantId = typeof rawVariantId === "string" && rawVariantId ? rawVariantId : null;
  const validListing = product.listing_type === "physical" && (product.catalog_status === "draft" || product.catalog_status === "published");
  if (variantId) {
    if (!validListing || product.price_mode !== "fixed" || !hasVariants) {
      return { message: "Esta variação não aceita preço automático. Confira o anúncio e tente novamente.", success: false };
    }
    if (product.catalog_status === "published" && formData.get("confirmedPublishedPrice") !== "yes") {
      return { message: "Confirme a alteração do preço publicado.", success: false };
    }
    const { data: variant, error: variantError } = await actor.supabase.from("marketplace_product_variants")
      .select("id, price_brl").eq("id", variantId).eq("product_id", product.id).maybeSingle();
    if (variantError || !variant || (typeof variant.price_brl !== "number" && typeof variant.price_brl !== "string") || !Number.isFinite(Number(variant.price_brl)) || Number(variant.price_brl) <= 0) {
      return { message: "Não foi possível localizar essa variação neste anúncio.", success: false };
    }
    const currentVariantPriceCents = Math.round(Number(variant.price_brl) * 100);
    if (currentVariantPriceCents !== expectedPriceCents) return { message: "O preço da variação mudou. Atualize a página e calcule novamente antes de aplicar.", success: false };
    const { error } = await actor.supabase.rpc("apply_calculated_product_variant_price", {
      p_product_id: product.id, p_variant_id: variant.id,
      p_expected_price_cents: expectedPriceCents, p_price_cents: priceCents,
    });
    if (error) return { message: error.message.includes("STALE_VARIANT_PRICE")
      ? "O preço da variação mudou. Atualize a página e calcule novamente antes de aplicar."
      : error.message.includes("VARIANT_RESERVED") || error.message.includes("Variant is reserved by an active checkout")
        ? "Esta variação está reservada em um pagamento pendente e não pode ser alterada agora."
        : "Não foi possível atualizar o preço. Recarregue o anúncio e tente novamente.", success: false };

    revalidatePath(`/produtos/${product.slug}`);
    revalidatePath(`/lojas/${store.slug}`);
    revalidatePath("/");
    return { message: "Preço da variação atualizado no anúncio.", success: true };
  }
  if (!validListing || (product.price_mode !== "fixed" && product.price_mode !== "from") || hasVariants
    || typeof product.price_brl !== "number" && typeof product.price_brl !== "string" || !Number.isFinite(Number(product.price_brl)) || Number(product.price_brl) <= 0) {
    return { message: "Este produto não aceita preço unitário automático. Produtos digitais, sob orçamento ou com variações precisam ser editados no painel.", success: false };
  }
  if (product.catalog_status === "published" && formData.get("confirmedPublishedPrice") !== "yes") {
    return { message: "Confirme a alteração do preço publicado.", success: false };
  }
  const currentPriceCents = Math.round(Number(product.price_brl) * 100);
  if (currentPriceCents !== expectedPriceCents) return { message: "O preço do anúncio mudou. Atualize a página e calcule novamente antes de aplicar.", success: false };
  const { data: updated, error } = await actor.supabase.from("marketplace_products").update({ price_brl: priceCents / 100, updated_at: new Date().toISOString() })
    .eq("id", product.id).eq("store_id", store.id).eq("created_by", actor.user.id).eq("price_brl", product.price_brl).select("id").maybeSingle();
  if (error || !updated) return { message: "Não foi possível atualizar o preço. Recarregue o anúncio e tente novamente.", success: false };

  revalidatePath(`/produtos/${product.slug}`);
  revalidatePath(`/lojas/${store.slug}`);
  revalidatePath("/catalogos");
  revalidatePath("/");
  return { message: "Preço atualizado no anúncio.", success: true };
}

export async function saveMakerCalculation(_previous: SaveCalculationState, formData: FormData): Promise<SaveCalculationState> {
  const validated = validateCalculationToSave(formData.get("title"), formData.get("snapshot"), formData.get("productId"), formData.get("printerId"), formData.get("profileId"));
  if (!validated.calculation) return { message: validated.error ?? "Confira os dados do cálculo.", success: false };

  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) return { message: "Entre em uma conta de fabricante aprovada para salvar cálculos.", success: false };
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) return { message: "Não foi possível localizar a loja do fabricante.", success: false };
  if (validated.calculation.productId) {
    const { data: product } = await actor.supabase.from("marketplace_products").select("id")
      .eq("id", validated.calculation.productId).eq("store_id", store.id).maybeSingle();
    if (!product) return { message: "Vincule apenas um produto da sua própria loja.", success: false };
  }
  if (validated.calculation.printerId) {
    const { data: printer } = await actor.supabase.from("maker_printers").select("id")
      .eq("id", validated.calculation.printerId).eq("store_id", store.id).maybeSingle();
    if (!printer) return { message: "Vincule apenas um equipamento cadastrado na sua própria loja.", success: false };
  }
  if (validated.calculation.profileId) {
    const { data: profile } = await actor.supabase.from("maker_print_profiles").select("id")
      .eq("id", validated.calculation.profileId).eq("store_id", store.id).maybeSingle();
    if (!profile) return { message: "Vincule apenas um perfil de impressão da sua própria loja.", success: false };
  }

  const { error } = await actor.supabase.from("maker_cost_calculations").insert({
    store_id: store.id,
    product_id: validated.calculation.productId,
    printer_id: validated.calculation.printerId,
    profile_id: validated.calculation.profileId,
    title: validated.calculation.title,
    input_snapshot: { input: validated.calculation.input, channels: validated.calculation.channels, slicer: validated.calculation.slicer, origin: validated.calculation.origin, priceTargetId: validated.calculation.priceTargetId, compatibilityNozzles: validated.calculation.compatibilityNozzles },
    result_snapshot: validated.calculation.result,
  });
  if (error) return { message: "Não foi possível salvar. Confira se as migrações do histórico, produtos, equipamentos e perfis estão aplicadas.", success: false };

  revalidatePath("/calculadora");
  return { message: "Cálculo salvo no histórico da loja.", success: true };
}

export async function deleteMakerCalculation(formData: FormData): Promise<void> {
  const id = formData.get("calculationId");
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return;
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) return;
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) return;
  const { error } = await actor.supabase.from("maker_cost_calculations").delete().eq("id", id).eq("store_id", store.id);
  if (!error) revalidatePath("/calculadora");
}
