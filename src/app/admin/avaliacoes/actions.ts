"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function reviewMarketplaceReviewAction(formData: FormData): Promise<void> {
  const reviewId = formData.get("reviewId");
  const decision = formData.get("decision");
  if (typeof reviewId !== "string" || !uuidPattern.test(reviewId)
    || (decision !== "published" && decision !== "rejected")) redirect("/admin/avaliacoes?resultado=erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("review_marketplace_review", {
    p_review_id: reviewId, p_decision: decision,
  });
  if (error) redirect("/admin/avaliacoes?resultado=erro");
  revalidatePath("/admin/avaliacoes");
  revalidatePath("/produtos/[slug]", "page");
  revalidatePath("/");
  redirect(`/admin/avaliacoes?resultado=${decision === "published" ? "publicada" : "rejeitada"}`);
}
