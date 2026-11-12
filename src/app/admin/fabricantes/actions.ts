"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const returnToAdmin = (result: string) => redirect(`/admin/fabricantes?resultado=${result}`);

export async function reviewMakerApplicationAction(formData: FormData): Promise<void> {
  const applicationId = formData.get("applicationId");
  const decision = formData.get("decision");
  const noteValue = formData.get("note");
  if (typeof applicationId !== "string" || !uuidPattern.test(applicationId) || (decision !== "approved" && decision !== "rejected") || typeof noteValue !== "string" || noteValue.length > 1000) returnToAdmin("erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) return redirect("/conta");
  const note = typeof noteValue === "string" ? noteValue.trim() : "";
  const { error } = await actor.supabase.rpc("review_maker_application", { application_id: applicationId, decision, note: note || null });
  if (error) returnToAdmin("erro");
  revalidatePath("/admin/fabricantes");
  revalidatePath("/conta");
  returnToAdmin("analisada");
}

export async function publishStoreAction(formData: FormData): Promise<void> {
  const storeId = formData.get("storeId");
  if (typeof storeId !== "string" || !uuidPattern.test(storeId)) returnToAdmin("erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) return redirect("/conta");
  const { error } = await actor.supabase.from("stores").update({ status: "published", updated_at: new Date().toISOString() }).eq("id", storeId).eq("status", "pending");
  if (error) returnToAdmin("erro");
  revalidatePath("/admin/fabricantes");
  revalidatePath("/painel/maker");
  revalidatePath("/");
  returnToAdmin("loja-aprovada");
}

export async function publishProductAction(formData: FormData): Promise<void> {
  const productId = formData.get("productId");
  if (typeof productId !== "string" || !uuidPattern.test(productId)) returnToAdmin("erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) return redirect("/conta");
  const { error } = await actor.supabase.from("marketplace_products").update({ catalog_status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", productId).eq("catalog_status", "draft");
  if (error) returnToAdmin("erro");
  revalidatePath("/admin/fabricantes");
  revalidatePath("/");
  returnToAdmin("produto-publicado");
}

export async function reviewPrintProfileAction(formData: FormData): Promise<void> {
  const profileId = formData.get("profileId");
  const decision = formData.get("decision");
  const noteValue = formData.get("note");
  if (typeof profileId !== "string" || !uuidPattern.test(profileId)
    || (decision !== "community" && decision !== "official" && decision !== "rejected")
    || (noteValue != null && (typeof noteValue !== "string" || noteValue.length > 1000))) returnToAdmin("erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) return redirect("/conta");
  const note = typeof noteValue === "string" ? noteValue.trim() : "";
  const published = decision !== "rejected";
  const { data, error } = await actor.supabase.from("maker_print_profiles").update({
    sharing_scope: decision === "official" ? "official" : "community",
    review_status: published ? "published" : "rejected",
    reviewed_by: actor.user.id,
    reviewed_at: new Date().toISOString(),
    review_note: note || null,
    updated_at: new Date().toISOString(),
  }).eq("id", profileId).eq("sharing_scope", "community").eq("review_status", "pending").select("id").maybeSingle();
  if (error || !data) returnToAdmin("erro");
  revalidatePath("/admin/fabricantes");
  revalidatePath("/painel/maker");
  revalidatePath("/");
  returnToAdmin(decision === "rejected" ? "perfil-recusado" : decision === "official" ? "perfil-oficial" : "perfil-comunitario");
}
