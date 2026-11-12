"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateCouponDefinition } from "@/lib/coupon";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finish = (result: string): never => redirect(`/admin/cupons?resultado=${result}`);

export async function createCouponAction(formData: FormData): Promise<void> {
  const coupon = validateCouponDefinition({ code: formData.get("code"), type: formData.get("type"), value: formData.get("value") });
  if (!coupon) finish("erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.from("marketplace_coupons").insert({
    ...coupon, created_by: actor.user.id,
  });
  if (error) finish(error.code === "23505" ? "duplicado" : "erro");
  revalidatePath("/admin/cupons");
  finish("salvo");
}

export async function setCouponActiveAction(formData: FormData): Promise<void> {
  const id = formData.get("couponId");
  const active = formData.get("active");
  if (typeof id !== "string" || !uuidPattern.test(id) || (active !== "true" && active !== "false")) finish("erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { error, data } = await actor.supabase.from("marketplace_coupons").update({ active: active === "true" }).eq("id", id).select("id").maybeSingle();
  if (error || !data) finish("erro");
  revalidatePath("/admin/cupons");
  finish("atualizado");
}
