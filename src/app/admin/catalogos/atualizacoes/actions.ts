"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { parsePageNumber } from "@/lib/pagination";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finishReview = (result: string, formData: FormData): never => {
  const params = new URLSearchParams({ resultado: result });
  const pages = [
    ["pagina", parsePageNumber(formData.get("pagina"))],
    ["alertaPagina", parsePageNumber(formData.get("alertaPagina"))],
    ["fontePagina", parsePageNumber(formData.get("fontePagina"))],
    ["versaoPagina", parsePageNumber(formData.get("versaoPagina"))],
  ] as const;
  for (const [name, page] of pages) if (page !== null) params.set(name, String(page));
  return redirect(`/admin/catalogos/atualizacoes?${params.toString()}`);
};

export async function reviewCatalogSourceUpdateAction(formData: FormData): Promise<void> {
  const id = formData.get("updateId");
  const decision = formData.get("decision");
  const note = formData.get("note");
  if (typeof id !== "string" || !uuidPattern.test(id)
    || (decision !== "confirmed" && decision !== "dismissed")
    || (note != null && (typeof note !== "string" || note.length > 1000))) finishReview("erro", formData);
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data, error } = await actor.supabase.from("catalog_update_history").update({
    status: decision, reviewed_by: actor.user.id, reviewed_at: new Date().toISOString(), review_note: typeof note === "string" ? note.trim() || null : null,
  }).eq("id", id).eq("status", "pending").select("id").maybeSingle();
  if (error) finishReview("erro", formData);
  if (!data) finishReview("analisada", formData);
  revalidatePath("/admin/catalogos/atualizacoes");
  finishReview("salvo", formData);
}

export async function reviewCatalogDiscoveryCandidateAction(formData: FormData): Promise<void> {
  const candidateId = formData.get("candidateId");
  const decision = formData.get("decision");
  const model = formData.get("model");
  const variant = formData.get("variant");
  const technology = formData.get("technology");
  if (typeof candidateId !== "string" || !uuidPattern.test(candidateId)
    || (decision !== "import" && decision !== "dismiss")
    || (decision === "import" && (typeof model !== "string" || !model.trim() || model.length > 120
      || typeof variant !== "string" || !variant.trim() || variant.length > 80
      || (technology !== "FDM" && technology !== "SLA" && technology !== "MSLA" && technology !== "DLP")))) finishReview("candidato-erro", formData);
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data, error } = await actor.supabase.rpc("review_catalog_discovery_candidate", {
    p_candidate_id: candidateId, p_decision: decision,
    p_model: typeof model === "string" ? model.trim() : "",
    p_variant: typeof variant === "string" ? variant.trim() : "standard",
    p_technology: typeof technology === "string" ? technology : "",
  });
  if (error || (decision === "import" && typeof data !== "string")) finishReview("candidato-erro", formData);
  revalidatePath("/admin/catalogos/atualizacoes");
  revalidatePath("/admin/catalogos/impressoras");
  finishReview(decision === "import" ? "candidato-importado" : "candidato-dispensado", formData);
}
