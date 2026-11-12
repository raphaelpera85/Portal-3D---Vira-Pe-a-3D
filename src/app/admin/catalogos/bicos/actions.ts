"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateNozzleCatalogInput, validateNozzleCompatibilityInput, validateMaterialCompatibilityInput } from "@/lib/technical-catalog-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finish = (result: string): never => redirect(`/admin/catalogos/bicos?resultado=${result}`);
async function adminClient() {
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  return actor;
}
function revalidateCatalogs() {
  revalidatePath("/catalogos");
  revalidatePath("/admin/catalogos/bicos");
  revalidatePath("/admin/catalogos/materiais");
  revalidatePath("/painel/maker");
}

export async function saveNozzleAction(formData: FormData): Promise<void> {
  const rawId = formData.get("nozzleId");
  const id = typeof rawId === "string" && rawId ? rawId : null;
  const nozzle = validateNozzleCatalogInput(Object.fromEntries(formData.entries()));
  if (nozzle === null) redirect("/admin/catalogos/bicos?resultado=erro");
  if (id && !uuidPattern.test(id)) finish("erro");
  const actor = await adminClient();
  const result = id
    ? await actor.supabase.from("nozzle_catalog").update(nozzle).eq("id", id).select("id").maybeSingle()
    : await actor.supabase.from("nozzle_catalog").insert({ ...nozzle, created_by: actor.user.id }).select("id").single();
  if (result.error || !result.data) finish("erro");
  revalidateCatalogs();
  finish("bico-salvo");
}

export async function saveMaterialCompatibilityAction(formData: FormData): Promise<void> {
  const oldPrinterId = formData.get("oldPrinterId");
  const oldEntityId = formData.get("oldEntityId");
  const hasOldKey = typeof oldPrinterId === "string" && oldPrinterId !== "" || typeof oldEntityId === "string" && oldEntityId !== "";
  if (hasOldKey && (typeof oldPrinterId !== "string" || !uuidPattern.test(oldPrinterId) || typeof oldEntityId !== "string" || !uuidPattern.test(oldEntityId))) finish("erro");
  const relationship = validateMaterialCompatibilityInput(Object.fromEntries(formData.entries()));
  if (relationship === null) redirect("/admin/catalogos/bicos?resultado=erro");
  const actor = await adminClient();
  if (relationship.catalog_status === "published") {
    const [printer, material] = await Promise.all([
      actor.supabase.from("printer_models").select("id").eq("id", relationship.printer_id).eq("catalog_status", "published").maybeSingle(),
      actor.supabase.from("material_catalog").select("id").eq("id", relationship.material_id).eq("catalog_status", "published").maybeSingle(),
    ]);
    if (!printer.data || !material.data) finish("erro");
  }
  const result = hasOldKey
    ? await actor.supabase.from("printer_material_compatibility").update(relationship).eq("printer_id", oldPrinterId as string).eq("material_id", oldEntityId as string).select("printer_id").maybeSingle()
    : await actor.supabase.from("printer_material_compatibility").insert(relationship).select("printer_id").single();
  if (result.error || !result.data) finish("erro");
  revalidateCatalogs();
  finish("compatibilidade-salva");
}

export async function saveNozzleCompatibilityAction(formData: FormData): Promise<void> {
  const oldPrinterId = formData.get("oldPrinterId");
  const oldEntityId = formData.get("oldEntityId");
  const hasOldKey = typeof oldPrinterId === "string" && oldPrinterId !== "" || typeof oldEntityId === "string" && oldEntityId !== "";
  if (hasOldKey && (typeof oldPrinterId !== "string" || !uuidPattern.test(oldPrinterId) || typeof oldEntityId !== "string" || !uuidPattern.test(oldEntityId))) finish("erro");
  const relationship = validateNozzleCompatibilityInput(Object.fromEntries(formData.entries()));
  if (relationship === null) redirect("/admin/catalogos/bicos?resultado=erro");
  const actor = await adminClient();
  if (relationship.catalog_status === "published") {
    const [printer, nozzle] = await Promise.all([
      actor.supabase.from("printer_models").select("id").eq("id", relationship.printer_id).eq("catalog_status", "published").maybeSingle(),
      actor.supabase.from("nozzle_catalog").select("id").eq("id", relationship.nozzle_id).eq("catalog_status", "published").maybeSingle(),
    ]);
    if (!printer.data || !nozzle.data) finish("erro");
  }
  const result = hasOldKey
    ? await actor.supabase.from("printer_nozzle_compatibility").update(relationship).eq("printer_id", oldPrinterId as string).eq("nozzle_id", oldEntityId as string).select("printer_id").maybeSingle()
    : await actor.supabase.from("printer_nozzle_compatibility").insert(relationship).select("printer_id").single();
  if (result.error || !result.data) finish("erro");
  revalidateCatalogs();
  finish("compatibilidade-salva");
}
