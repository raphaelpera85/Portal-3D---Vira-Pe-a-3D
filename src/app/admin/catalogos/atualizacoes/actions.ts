"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finish = (result: string): never => redirect(`/admin/catalogos/atualizacoes?resultado=${result}`);

export async function reviewCatalogSourceUpdateAction(formData: FormData): Promise<void> {
  const id = formData.get("updateId");
  const decision = formData.get("decision");
  const note = formData.get("note");
  if (typeof id !== "string" || !uuidPattern.test(id)
    || (decision !== "confirmed" && decision !== "dismissed")
    || (note != null && (typeof note !== "string" || note.length > 1000))) finish("erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data, error } = await actor.supabase.from("catalog_update_history").update({
    status: decision, reviewed_by: actor.user.id, reviewed_at: new Date().toISOString(), review_note: typeof note === "string" ? note.trim() || null : null,
  }).eq("id", id).eq("status", "pending").select("id").maybeSingle();
  if (error) finish("erro");
  if (!data) finish("analisada");
  revalidatePath("/admin/catalogos/atualizacoes");
  finish("salvo");
}
