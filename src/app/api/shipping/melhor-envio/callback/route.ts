import { NextRequest, NextResponse } from "next/server";
import { getUserWithRole } from "@/lib/auth-role.server";
import { encryptMercadoPagoToken } from "@/lib/mercado-pago-token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";

const callbackPath = "/api/shipping/melhor-envio/callback";

export async function GET(request: NextRequest) {
  const siteUrl = getSiteUrl();
  if (!siteUrl) return new NextResponse(null, { status: 400 });
  const actor = await getUserWithRole("maker");
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const cookieState = request.cookies.get("me_oauth_state")?.value;
  const [cookieUserId, cookieNonce, extra] = cookieState?.split(".") ?? [];
  const site = process.env.MELHOR_ENVIO_SANDBOX === "true" ? "https://sandbox.melhorenvio.com.br" : "https://melhorenvio.com.br";
  const redirectTo = (result: string) => {
    const response = NextResponse.redirect(new URL(`/painel/maker?resultado=${result}#frete`, siteUrl));
    response.cookies.set("me_oauth_state", "", { path: callbackPath, maxAge: 0 });
    return response;
  };
  if (!actor.supabase || !actor.user || !actor.authorized) return NextResponse.redirect(new URL("/conta", siteUrl));
  const clientId = process.env.ME_CLIENT_ID;
  const clientSecret = process.env.ME_CLIENT_SECRET;
  const encryptionKey = process.env.ME_TOKEN_ENCRYPTION_KEY;
  if (!state || state.length > 128 || state !== cookieNonce || extra || cookieUserId !== actor.user.id
    || !code || code.length > 2048 || !clientId || !clientSecret || !encryptionKey) {
    return redirectTo("melhor-envio-erro");
  }
  const [{ data: store }, admin] = await Promise.all([
    actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle(),
    Promise.resolve(createSupabaseAdminClient()),
  ]);
  if (!store || !admin) return redirectTo("melhor-envio-configurar");
  try {
    const response = await fetch(`${site}/oauth/token`, {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: new URL(callbackPath, siteUrl).toString() }),
      signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== "object") throw new Error("Invalid OAuth response");
    const token = payload as Record<string, unknown>;
    if (typeof token.access_token !== "string" || typeof token.refresh_token !== "string"
      || (typeof token.user_id !== "string" && typeof token.user_id !== "number")
      || typeof token.expires_in !== "number" || !Number.isSafeInteger(token.expires_in) || token.expires_in < 1) throw new Error("Incomplete OAuth response");
    const { error } = await admin.from("store_melhor_envio_connections").upsert({
      store_id: store.id, provider_user_id: String(token.user_id),
      access_token_ciphertext: encryptMercadoPagoToken(token.access_token, encryptionKey),
      refresh_token_ciphertext: encryptMercadoPagoToken(token.refresh_token, encryptionKey),
      token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      scopes: typeof token.scope === "string" ? token.scope : "shipping-calculate", updated_at: new Date().toISOString(),
    }, { onConflict: "store_id" });
    if (error) throw new Error("Could not store token");
    return redirectTo("melhor-envio-conectado");
  } catch {
    return redirectTo("melhor-envio-erro");
  }
}
