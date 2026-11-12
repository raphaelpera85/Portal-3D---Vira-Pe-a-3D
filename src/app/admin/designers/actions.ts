"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finish = (result: string): never => redirect(`/admin/designers?resultado=${result}`);

export async function reviewDesignerProfileAction(formData: FormData): Promise<void> {
  const profileId = formData.get("profileId");
  const decision = formData.get("decision");
  const note = formData.get("note");
  if (typeof profileId !== "string" || !uuidPattern.test(profileId)
    || typeof decision !== "string" || !["approved", "rejected", "suspended", "reinstated"].includes(decision)
    || (note != null && (typeof note !== "string" || note.length > 1000))) finish("erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("review_designer_profile", {
    p_profile_id: profileId,
    p_decision: decision,
    p_note: typeof note === "string" && note.trim() ? note.trim() : null,
  });
  if (error) finish("erro");
  revalidatePath("/admin/designers");
  revalidatePath("/designers", "page");
  revalidatePath("/painel/designer");
  revalidatePath("/conta");
  finish("analisado");
}
