"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function downloadDigitalAssetAction(formData: FormData): Promise<void> {
  const requestId = formData.get("requestId");
  if (typeof requestId !== "string" || !uuidPattern.test(requestId)) redirect("/orcamentos?resultado=download-erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const [{ data: request }, { data: payment }] = await Promise.all([
    actor.supabase.from("product_quote_requests").select("id, product_id, license_type")
      .eq("id", requestId).eq("buyer_id", actor.user.id).eq("request_type", "purchase").eq("status", "accepted").maybeSingle(),
    actor.supabase.from("seller_order_payments").select("id")
      .eq("purchase_request_id", requestId).eq("buyer_id", actor.user.id).eq("status", "paid").maybeSingle(),
  ]);
  const admin = createSupabaseAdminClient();
  if (!request || !request.license_type || !payment || !admin) redirect("/orcamentos?resultado=download-erro");
  const { data: asset } = await admin.from("digital_assets").select("object_path, file_name")
    .eq("product_id", request.product_id).maybeSingle();
  if (!asset) redirect("/orcamentos?resultado=download-erro");
  const { data: link, error } = await admin.storage.from("digital-assets").createSignedUrl(asset.object_path, 120, { download: asset.file_name });
  if (error || !link) redirect("/orcamentos?resultado=download-erro");
  const { error: historyError } = await actor.supabase.rpc("record_digital_asset_download", { p_request_id: request.id });
  if (historyError) redirect("/orcamentos?resultado=download-erro");
  revalidatePath("/orcamentos");
  redirect(link.signedUrl);
}
