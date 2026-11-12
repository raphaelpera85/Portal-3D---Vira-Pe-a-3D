"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finish = (result: string): never => redirect(`/admin/denuncias-digitais?resultado=${result}`);

export async function reviewDigitalAssetReportAction(formData: FormData): Promise<void> {
  const reportId = formData.get("reportId");
  const decision = formData.get("decision");
  const note = formData.get("note");
  if (typeof reportId !== "string" || !uuidPattern.test(reportId) || typeof decision !== "string"
    || !["resolved", "dismissed", "archived"].includes(decision)
    || (note != null && (typeof note !== "string" || note.length > 1000))) finish("erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("review_digital_asset_report", {
    p_report_id: reportId, p_decision: decision, p_note: typeof note === "string" ? note.trim() || null : null,
  });
  if (error) finish("erro");
  revalidatePath("/admin/denuncias-digitais");
  revalidatePath("/produtos/[slug]", "page");
  revalidatePath("/");
  finish("analisada");
}
