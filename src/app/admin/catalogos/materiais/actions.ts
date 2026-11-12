"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateMaterialCatalogInput } from "@/lib/technical-catalog-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finish = (result: string): never => redirect(`/admin/catalogos/materiais?resultado=${result}`);

export async function saveMaterialAction(formData: FormData): Promise<void> {
  const rawId = formData.get("materialId");
  const id = typeof rawId === "string" && rawId ? rawId : null;
  const material = validateMaterialCatalogInput(Object.fromEntries(formData.entries()));
  if (material === null) redirect("/admin/catalogos/materiais?resultado=erro");
  if (id && !uuidPattern.test(id)) finish("erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const result = id
    ? await actor.supabase.from("material_catalog").update(material).eq("id", id).select("id").maybeSingle()
    : await actor.supabase.from("material_catalog").insert({ ...material, created_by: actor.user.id }).select("id").single();
  if (result.error || !result.data) finish("erro");
  revalidatePath("/catalogos");
  revalidatePath("/admin/catalogos/materiais");
  finish("salvo");
}
