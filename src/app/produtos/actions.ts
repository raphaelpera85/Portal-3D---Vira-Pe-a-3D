"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateDigitalLicense } from "@/lib/digital-assets";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function requestDigitalAssetPurchase(formData: FormData): Promise<void> {
  const productId = formData.get("productId");
  const slug = formData.get("slug");
  const licenseType = validateDigitalLicense(formData.get("licenseType"));
  if (typeof productId !== "string" || !uuidPattern.test(productId) || typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !licenseType) redirect("/produtos?compra=erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("request_digital_asset_purchase", { p_product_id: productId, p_license_type: licenseType });
  if (error) redirect(`/produtos/${slug}?compra=indisponivel`);
  revalidatePath("/orcamentos");
  revalidatePath("/painel/maker");
  redirect("/orcamentos?resultado=compra-solicitada");
}

export async function reportDigitalAsset(formData: FormData): Promise<void> {
  const productId = formData.get("productId");
  const slug = formData.get("slug");
  const reason = formData.get("reason");
  const detailsValue = formData.get("details");
  if (typeof productId !== "string" || !uuidPattern.test(productId)
    || (reason !== "copyright" && reason !== "trademark" && reason !== "other")
    || typeof detailsValue !== "string" || detailsValue.trim().length < 20 || detailsValue.trim().length > 2000) {
    redirect(typeof slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? `/produtos/${slug}?denuncia=erro` : "/");
  }
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.from("digital_asset_reports").insert({
    product_id: productId, reporter_id: actor.user.id, reason, details: detailsValue.trim(),
  });
  if (error) redirect(`/produtos/${slug}?denuncia=erro`);
  revalidatePath("/admin/denuncias-digitais");
  redirect(`/produtos/${slug}?denuncia=enviada`);
}

