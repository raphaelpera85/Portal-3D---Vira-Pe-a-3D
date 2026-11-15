"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";

export async function reviewCreatorModel(formData: FormData): Promise<never> {
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("reviewNote") ?? "").trim();
  const submittedPage = Number(formData.get("pagina"));
  const page = Number.isSafeInteger(submittedPage) && submittedPage > 0 ? submittedPage : 1;
  if (!/^[a-f0-9]{12}$/.test(id) || !["published", "rejected"].includes(decision) || note.length > 1000) {
    redirect(`/admin/modelos?resultado=erro&pagina=${page}`);
  }
  const { data, error } = await actor.supabase.from("creator_model_submissions").update({
    review_status: decision, review_note: note || null, reviewed_by: actor.user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", id).eq("review_status", "pending").select("id").maybeSingle();
  if (error || !data) redirect(`/admin/modelos?resultado=erro&pagina=${page}`);
  revalidatePath("/admin");
  revalidatePath("/modelos");
  revalidatePath(`/modelos/${id}`);
  revalidatePath("/sitemap.xml");
  redirect(`/admin/modelos?resultado=${decision === "published" ? "publicado" : "rejeitado"}&pagina=${page}`);
}
