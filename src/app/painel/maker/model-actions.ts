"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUnregisteredGitModelAssets } from "@/lib/creator-model-assets";
import { validateCreatorModelSubmission } from "@/lib/creator-model-input";
import { modelShowcase } from "@/lib/model-showcase";
import { getUserWithRole } from "@/lib/auth-role.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function submitCreatorModel(formData: FormData): Promise<never> {
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const [storeResult, existingResult] = await Promise.all([
    actor.supabase.from("stores").select("id, status").eq("owner_user_id", actor.user.id).maybeSingle(),
    actor.supabase.from("creator_model_submissions").select("asset_path").eq("submitted_by", actor.user.id),
  ]);
  const store = storeResult.data;
  if (storeResult.error || !store || store.status !== "published" || existingResult.error) redirect("/painel/maker?resultado=modelo-erro#modelos-3d");
  const staticAssets = modelShowcase.flatMap((model) => [model.filePath, ...(model.downloads ?? []).map(({ filePath }) => filePath)]);
  const availableAssets = getUnregisteredGitModelAssets([...(existingResult.data ?? []).map((row) => row.asset_path), ...staticAssets]);
  const input = validateCreatorModelSubmission(Object.fromEntries(formData), availableAssets);
  if (!input) redirect("/painel/maker?resultado=modelo-invalido#modelos-3d");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/painel/maker?resultado=modelo-erro#modelos-3d");
  const { error } = await admin.from("creator_model_submissions").insert({
    id: randomBytes(6).toString("hex"), store_id: store.id, submitted_by: actor.user.id,
    ...input, rights_confirmed_at: new Date().toISOString(), review_status: "pending",
  });
  if (error) redirect(`/painel/maker?resultado=${error.code === "23505" ? "modelo-duplicado" : "modelo-erro"}#modelos-3d`);
  revalidatePath("/admin");
  revalidatePath("/admin/modelos");
  redirect("/painel/maker?resultado=modelo-enviado#modelos-3d");
}
