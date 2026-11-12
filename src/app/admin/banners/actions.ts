"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateHomepageBanner } from "@/lib/homepage-banners";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finish = (result: string): never => redirect(`/admin/banners?resultado=${result}`);

export async function saveHomepageBannerAction(formData: FormData): Promise<void> {
  const rawId = formData.get("bannerId");
  const id = typeof rawId === "string" && rawId ? rawId : null;
  const banner = validateHomepageBanner(Object.fromEntries(formData.entries()));
  if (banner === null) redirect("/admin/banners?resultado=erro");
  if (id && !uuidPattern.test(id)) finish("erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");

  const result = id
    ? await actor.supabase.from("homepage_banners").update({ ...banner, updated_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle()
    : await actor.supabase.from("homepage_banners").insert(banner).select("id").single();
  if (result.error || !result.data) finish("erro");
  revalidatePath("/");
  revalidatePath("/admin/banners");
  finish("salvo");
}

export async function setHomepageBannerActiveAction(formData: FormData): Promise<void> {
  const bannerId = formData.get("bannerId");
  const activeValue = formData.get("isActive");
  if (typeof bannerId !== "string" || !uuidPattern.test(bannerId) || (activeValue !== "true" && activeValue !== "false")) finish("erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { data, error } = await actor.supabase.from("homepage_banners").update({ is_active: activeValue === "true", updated_at: new Date().toISOString() }).eq("id", bannerId).select("id").maybeSingle();
  if (error || !data) finish("erro");
  revalidatePath("/");
  revalidatePath("/admin/banners");
  finish("publicacao-atualizada");
}
