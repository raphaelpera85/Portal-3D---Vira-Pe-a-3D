import { NextRequest, NextResponse } from "next/server";
import { getUserWithRole } from "@/lib/auth-role.server";
import { encryptMercadoPagoToken } from "@/lib/mercado-pago-token";
import { verifyMercadoPagoState } from "@/lib/mercado-pago-oauth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";

const cookieName = "mp_oauth_state";
const verifierCookieName = "mp_oauth_verifier";
const callbackPath = "/api/payments/mercado-pago/callback";

function makerUrl(result: string, origin: string) {
  return new URL(`/painel/maker?resultado=${result}#pagamentos`, origin);
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.set(cookieName, "", { path: callbackPath, maxAge: 0 });
  response.cookies.set(verifierCookieName, "", { path: callbackPath, maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const siteUrl = getSiteUrl();
  if (!siteUrl) return new NextResponse(null, { status: 400 });
  const actor = await getUserWithRole("maker");
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const cookieState = request.cookies.get(cookieName)?.value;
  const verifier = request.cookies.get(verifierCookieName)?.value;
  const secret = process.env.MP_CLIENT_SECRET;
  const clientId = process.env.MP_CLIENT_ID;
  const redirectUri = new URL(callbackPath, siteUrl).toString();
  if (!actor.supabase || !actor.user || !actor.authorized) return NextResponse.redirect(new URL("/conta", siteUrl));
  if (!state || state.length > 256 || !code || code.length > 2048 || !cookieState || !verifier
    || state !== cookieState || !secret || !clientId
    || !verifyMercadoPagoState(state, actor.user.id, secret)) {
    return clearOAuthCookies(NextResponse.redirect(makerUrl("mercado-pago-erro", siteUrl.origin)));
  }

  const [{ data: store }, admin] = await Promise.all([
    actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle(),
    Promise.resolve(createSupabaseAdminClient()),
  ]);
  if (!store || !admin || !process.env.MP_TOKEN_ENCRYPTION_KEY) {
    return clearOAuthCookies(NextResponse.redirect(makerUrl("mercado-pago-configurar", siteUrl.origin)));
  }

  try {
    const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: secret, code, code_verifier: verifier, grant_type: "authorization_code", redirect_uri: redirectUri }),
      signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
    });
    if (!tokenResponse.ok) throw new Error("OAuth token exchange failed");
    const tokenData: unknown = await tokenResponse.json();
    if (!tokenData || typeof tokenData !== "object") throw new Error("Invalid OAuth response");
    const token = tokenData as Record<string, unknown>;
    if (typeof token.access_token !== "string" || typeof token.refresh_token !== "string"
      || (typeof token.user_id !== "string" && typeof token.user_id !== "number")
      || typeof token.expires_in !== "number" || !Number.isFinite(token.expires_in) || token.expires_in <= 0) {
      throw new Error("Incomplete OAuth response");
    }
    const encryptionKey = process.env.MP_TOKEN_ENCRYPTION_KEY;
    const accessToken = encryptMercadoPagoToken(token.access_token, encryptionKey);
    const refreshToken = encryptMercadoPagoToken(token.refresh_token, encryptionKey);
    const { error } = await admin.from("store_payment_connections").upsert({
      store_id: store.id, provider_user_id: String(token.user_id), access_token_ciphertext: accessToken,
      refresh_token_ciphertext: refreshToken, token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      scopes: typeof token.scope === "string" ? token.scope : "", updated_at: new Date().toISOString(),
    }, { onConflict: "store_id" });
    if (error) throw new Error("Could not save payment connection");
    return clearOAuthCookies(NextResponse.redirect(makerUrl("mercado-pago-conectado", siteUrl.origin)));
  } catch {
    return clearOAuthCookies(NextResponse.redirect(makerUrl("mercado-pago-erro", siteUrl.origin)));
  }
}
