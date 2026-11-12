"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { getMercadoPagoDisconnectionResult } from "@/lib/mercado-pago-disconnection";
import { buildMercadoPagoAuthorizationUrl, createMercadoPagoPkce, createMercadoPagoState } from "@/lib/mercado-pago-oauth";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const cookieName = "mp_oauth_state";
const verifierCookieName = "mp_oauth_verifier";
const callbackPath = "/api/payments/mercado-pago/callback";
const disconnectResultPath = "/painel/maker?resultado=";

export async function disconnectMercadoPago(formData: FormData): Promise<void> {
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");

  const storeId = formData.get("storeId");
  if (typeof storeId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storeId)
    || formData.get("confirmDisconnect") !== "yes") {
    redirect(`${disconnectResultPath}mercado-pago-desconectar-erro#pagamentos`);
  }

  const { data: store } = await actor.supabase.from("stores").select("id")
    .eq("id", storeId).eq("owner_user_id", actor.user.id).maybeSingle();
  const admin = store ? createSupabaseAdminClient() : null;
  if (!store || !admin) redirect(`${disconnectResultPath}mercado-pago-desconectar-erro#pagamentos`);

  const { data, error } = await admin.rpc("disconnect_mercado_pago_store", {
    p_store_id: store.id,
    p_maker_id: actor.user.id,
  });
  const result = error ? null : getMercadoPagoDisconnectionResult(data);
  if (!result) redirect(`${disconnectResultPath}mercado-pago-desconectar-erro#pagamentos`);
  revalidatePath("/painel/maker");
  redirect(`${disconnectResultPath}${result}#pagamentos`);
}

export async function startMercadoPagoConnect(): Promise<void> {
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  const clientId = process.env.MP_CLIENT_ID;
  const clientSecret = process.env.MP_CLIENT_SECRET;
  const siteUrl = getSiteUrl();
  if (!store || !clientId || !clientSecret || !siteUrl || !process.env.MP_TOKEN_ENCRYPTION_KEY || !createSupabaseAdminClient()) {
    redirect("/painel/maker?resultado=mercado-pago-configurar#pagamentos");
  }

  const state = createMercadoPagoState(actor.user.id, clientSecret);
  const { verifier, challenge } = createMercadoPagoPkce();
  const cookieStore = await cookies();
  const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const,
    path: callbackPath, maxAge: 600,
  };
  cookieStore.set(cookieName, state, cookieOptions);
  cookieStore.set(verifierCookieName, verifier, cookieOptions);
  redirect(buildMercadoPagoAuthorizationUrl(clientId, new URL(callbackPath, siteUrl).toString(), state, challenge));
}
