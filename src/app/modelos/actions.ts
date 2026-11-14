"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getShowcaseModel } from "@/lib/model-showcase";
import { validateModelPrintProfile } from "@/lib/model-print-profiles";
import { parseSavedSlicerMetrics } from "@/lib/saved-calculation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function loadVisibleModelPrintProfiles(modelSlug: string) {
  if (!getShowcaseModel(modelSlug)) return { profiles: [], error: true };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { profiles: [], error: true };
  const { data, error } = await supabase.from("visible_model_print_profiles")
    .select("id, profile_name, profile_type, slicer, printer_snapshot, material_snapshot, nozzle_snapshot, layer_height_mm, infill_percent, wall_count, supports, orientation, scale_percent, quantity, slicer_metrics, sharing_scope, review_status")
    .eq("model_slug", modelSlug).order("created_at", { ascending: false }).limit(100);
  if (error) return { profiles: [], error: true };
  const profiles = (data ?? []).flatMap((profile) => {
    const metrics = parseSavedSlicerMetrics(profile.slicer_metrics);
    return uuidPattern.test(profile.id) && metrics && profile.profile_name.length >= 2 && profile.profile_name.length <= 80
      ? [{
        id: profile.id, profile_name: profile.profile_name, profile_type: profile.profile_type,
        slicer: profile.slicer, printer_snapshot: profile.printer_snapshot, material_snapshot: profile.material_snapshot,
        nozzle_snapshot: profile.nozzle_snapshot, layer_height_mm: profile.layer_height_mm,
        infill_percent: profile.infill_percent, wall_count: profile.wall_count, supports: profile.supports,
        orientation: profile.orientation, scale_percent: profile.scale_percent, quantity: profile.quantity,
        sharing_scope: profile.sharing_scope, review_status: profile.review_status, metrics,
      }]
      : [];
  });
  return { profiles, error: false };
}

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
    sharing_scope: input.sharingScope, review_status: input.sharingScope === "community" ? "pending" : "draft",
    reviewed_by: null, reviewed_at: null, review_note: null,
  };
  const result = input.id
    ? await supabase.from("model_print_profiles").update(payload).eq("id", input.id).eq("model_slug", input.modelSlug).select("id").maybeSingle()
    : await supabase.from("model_print_profiles").insert(payload).select("id").single();
  if (result.error || !result.data) redirect(`/modelos/${model.id}?perfil=erro`);
  revalidatePath(`/modelos/${model.id}`);
  revalidatePath("/calculadora");
  redirect(`/modelos/${model.id}?perfil=${input.sharingScope === "community" ? "enviado" : "salvo"}`);
}

export async function copyPublishedModelPrintProfile(formData: FormData) {
  const modelSlug = String(formData.get("modelSlug") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  const model = getShowcaseModel(modelSlug);
  if (!model || !uuidPattern.test(profileId)) redirect("/modelos?perfil=erro");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !auth.user) redirect("/conta");
  const { data: source, error: sourceError } = await supabase.from("visible_model_print_profiles")
    .select("profile_name, profile_type, slicer, printer_snapshot, material_snapshot, nozzle_snapshot, layer_height_mm, infill_percent, wall_count, supports, orientation, scale_percent, quantity, slicer_metrics, sharing_scope, review_status")
    .eq("id", profileId).eq("model_slug", model.id).maybeSingle();
  if (sourceError || !source || !["community", "official"].includes(source.sharing_scope) || source.review_status !== "published") redirect(`/modelos/${model.id}?perfil=erro`);
  const { error } = await supabase.from("model_print_profiles").insert({
    ...source, user_id: auth.user.id, model_slug: model.id, profile_name: `Cópia de ${source.profile_name}`.slice(0, 80),
    sharing_scope: "private", review_status: "draft", reviewed_by: null, reviewed_at: null, review_note: null,
  });
  if (error) redirect(`/modelos/${model.id}?perfil=erro`);
  revalidatePath(`/modelos/${model.id}`);
  revalidatePath("/calculadora");
  redirect(`/modelos/${model.id}?perfil=copiado`);
}

export async function deleteModelPrintProfile(formData: FormData) {
  const modelSlug = String(formData.get("modelSlug") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  const model = getShowcaseModel(modelSlug);
  if (!model || !uuidPattern.test(profileId)) redirect("/modelos?perfil=erro");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !auth.user) redirect("/conta");
  const { error } = await supabase.from("model_print_profiles").delete().eq("id", profileId).eq("model_slug", model.id);
  if (error) redirect(`/modelos/${model.id}?perfil=erro`);
  revalidatePath(`/modelos/${model.id}`);
  revalidatePath("/calculadora");
  redirect(`/modelos/${model.id}?perfil=excluido`);
}
