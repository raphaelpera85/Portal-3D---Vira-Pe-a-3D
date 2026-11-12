"use server";

import { revalidatePath } from "next/cache";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateCalculationToSave } from "@/lib/saved-calculation";

export type SaveCalculationState = { message: string; success: boolean };

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
    input_snapshot: { input: validated.calculation.input, channels: validated.calculation.channels, slicer: validated.calculation.slicer },
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
