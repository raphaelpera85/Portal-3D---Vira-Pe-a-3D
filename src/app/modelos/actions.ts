"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getShowcaseModel } from "@/lib/model-showcase";
import { validateModelPrintProfile } from "@/lib/model-print-profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveModelPrintProfile(formData: FormData) {
  const input = validateModelPrintProfile(Object.fromEntries(formData));
  const model = input && getShowcaseModel(input.modelSlug);
  if (!input || !model) redirect("/modelos?perfil=erro");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !auth.user) redirect("/conta");

  const payload = {
    user_id: auth.user.id, model_slug: input.modelSlug, profile_name: input.name,
    profile_type: input.profileType, slicer: input.slicer, printer_snapshot: input.printerName,
    material_snapshot: input.materialName, nozzle_snapshot: input.nozzleName,
    layer_height_mm: input.layerHeightMm, infill_percent: input.infillPercent, wall_count: input.wallCount,
    supports: input.supports, orientation: input.orientation, scale_percent: input.scalePercent,
    quantity: input.quantity, slicer_metrics: input.metrics,
  };
  const result = input.id
    ? await supabase.from("model_print_profiles").update(payload).eq("id", input.id).eq("model_slug", input.modelSlug).eq("user_id", auth.user.id).select("id").maybeSingle()
    : await supabase.from("model_print_profiles").insert(payload).select("id").single();
  if (result.error || !result.data) redirect(`/modelos/${model.id}?perfil=erro`);
  revalidatePath(`/modelos/${model.id}`);
  revalidatePath("/calculadora");
  redirect(`/modelos/${model.id}?perfil=salvo`);
}

export async function deleteModelPrintProfile(formData: FormData) {
  const modelSlug = String(formData.get("modelSlug") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  const model = getShowcaseModel(modelSlug);
  if (!model || !uuidPattern.test(profileId)) redirect("/modelos?perfil=erro");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !auth.user) redirect("/conta");
  const { error } = await supabase.from("model_print_profiles").delete().eq("id", profileId).eq("model_slug", model.id).eq("user_id", auth.user.id);
  if (error) redirect(`/modelos/${model.id}?perfil=erro`);
  revalidatePath(`/modelos/${model.id}`);
  revalidatePath("/calculadora");
  redirect(`/modelos/${model.id}?perfil=excluido`);
}
