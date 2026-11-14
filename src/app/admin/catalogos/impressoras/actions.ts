"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validatePrinterModelInput } from "@/lib/printer-model-input";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finish = (result: string): never => redirect(`/admin/catalogos/impressoras?resultado=${result}`);
const parsePage = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || !/^[1-9]\d{0,4}$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= 10000 ? page : null;
};
const finishSuggestionReview = (result: string, modelPage: number | null, suggestionPage: number | null): never => {
  const params = new URLSearchParams({ resultado: result });
  if (modelPage !== null) params.set("pagina", String(modelPage));
  if (suggestionPage !== null) params.set("sugestaoPagina", String(suggestionPage));
  return redirect(`/admin/catalogos/impressoras?${params.toString()}`);
};
const savePrinterModel = (supabase: NonNullable<Awaited<ReturnType<typeof getUserWithRole>>["supabase"]>, id: string | null, payload: Record<string, unknown>, userId: string) =>
  id ? supabase.from("printer_models").update(payload).eq("id", id).select("id").maybeSingle()
    : supabase.from("printer_models").insert({ ...payload, created_by: userId }).select("id").single();

export async function savePrinterModelAction(formData: FormData): Promise<void> {
  const rawId = formData.get("modelId");
  const id = typeof rawId === "string" && rawId ? rawId : null;
  const model = validatePrinterModelInput(Object.fromEntries(formData.entries()));
  if (model === null) redirect("/admin/catalogos/impressoras?resultado=erro");
  if (id && !uuidPattern.test(id)) finish("erro");
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");

  let result = await savePrinterModel(actor.supabase, id, model, actor.user.id);
  if (result.error?.code === "PGRST204" && result.error.message.includes("official_image")) {
    if (model.official_image_url || model.official_image_source_url) finish("imagem-migration");
    const { official_image_url: _imageUrl, official_image_source_url: _sourceUrl, official_image_authorized_at: _authorizedAt, ...legacyModel } = model;
    result = await savePrinterModel(actor.supabase, id, legacyModel, actor.user.id);
  }
  if (result.error || !result.data) finish("erro");
  revalidatePath("/catalogos");
  revalidatePath("/painel/maker");
  revalidatePath("/admin/catalogos/impressoras");
  finish("salvo");
}

export async function reviewPrinterModelSuggestionAction(formData: FormData): Promise<void> {
  const modelPage = parsePage(formData.get("pagina"));
  const suggestionPage = parsePage(formData.get("sugestaoPagina"));
  const suggestionId = formData.get("suggestionId");
  const decision = formData.get("decision");
  const noteValue = formData.get("note");
  if (typeof suggestionId !== "string" || !uuidPattern.test(suggestionId)
    || (decision !== "approve" && decision !== "reject")
    || (noteValue != null && (typeof noteValue !== "string" || noteValue.length > 1000))) finishSuggestionReview("erro", modelPage, suggestionPage);
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("review_printer_model_suggestion", {
    p_suggestion_id: suggestionId, p_decision: decision, p_note: typeof noteValue === "string" ? noteValue.trim() : "",
  });
  if (error) finishSuggestionReview(error.message.includes("no longer pending") ? "sugestao-analisada" : "erro", modelPage, suggestionPage);
  revalidatePath("/admin/catalogos/impressoras");
  revalidatePath("/painel/maker");
  revalidatePath("/catalogos");
  finishSuggestionReview(decision === "approve" ? "sugestao-aprovada" : "sugestao-recusada", modelPage, suggestionPage);
}
