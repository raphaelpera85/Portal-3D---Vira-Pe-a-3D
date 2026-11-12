import "server-only";
import { decryptMercadoPagoToken, encryptMercadoPagoToken } from "@/lib/mercado-pago-token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PaymentConnection = {
  provider_user_id: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  token_expires_at: string;
  scopes: string;
};

const isProviderId = (value: unknown): value is string | number => typeof value === "string" || typeof value === "number";

async function readConnection(storeId: string): Promise<PaymentConnection> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Payment service is unavailable");
  const { data, error } = await admin.from("store_payment_connections")
    .select("provider_user_id, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, scopes")
    .eq("store_id", storeId).maybeSingle();
  if (error || !data) throw new Error("Seller payment account is unavailable");
  return data;
}

export async function getMercadoPagoSellerAccessToken(storeId: string) {
  const encryptionKey = process.env.MP_TOKEN_ENCRYPTION_KEY;
  const clientId = process.env.MP_CLIENT_ID;
  const clientSecret = process.env.MP_CLIENT_SECRET;
  const admin = createSupabaseAdminClient();
  if (!admin || !encryptionKey || !clientId || !clientSecret) throw new Error("Payment service is not configured");

  let connection = await readConnection(storeId);
  if (new Date(connection.token_expires_at).getTime() > Date.now() + 120_000) {
    return decryptMercadoPagoToken(connection.access_token_ciphertext, encryptionKey);
  }

  const { data: claimed, error: claimError } = await admin.rpc("claim_mercado_pago_token_refresh", { p_store_id: storeId });
  if (claimError) throw new Error("Could not refresh seller payment account");
  if (!claimed) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      connection = await readConnection(storeId);
      if (new Date(connection.token_expires_at).getTime() > Date.now() + 120_000) {
        return decryptMercadoPagoToken(connection.access_token_ciphertext, encryptionKey);
      }
    }
    throw new Error("Seller payment account refresh is still in progress");
  }

  try {
    const refreshToken = decryptMercadoPagoToken(connection.refresh_token_ciphertext, encryptionKey);
    const response = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }),
      signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
    });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok || !value || typeof value !== "object") throw new Error("Mercado Pago token refresh failed");
    const token = value as Record<string, unknown>;
    if (typeof token.access_token !== "string" || typeof token.refresh_token !== "string"
      || !isProviderId(token.user_id) || String(token.user_id) !== connection.provider_user_id
      || typeof token.expires_in !== "number" || !Number.isSafeInteger(token.expires_in) || token.expires_in < 1) {
      throw new Error("Incomplete Mercado Pago token refresh");
    }
    const { error } = await admin.rpc("complete_mercado_pago_token_refresh", {
      p_store_id: storeId, p_provider_user_id: String(token.user_id),
      p_access_token_ciphertext: encryptMercadoPagoToken(token.access_token, encryptionKey),
      p_refresh_token_ciphertext: encryptMercadoPagoToken(token.refresh_token, encryptionKey),
      p_expires_in: token.expires_in, p_scopes: typeof token.scope === "string" ? token.scope : connection.scopes,
    });
    if (error) throw new Error("Could not save refreshed Mercado Pago token");
    return token.access_token;
  } catch (error) {
    await admin.rpc("release_mercado_pago_token_refresh", { p_store_id: storeId });
    throw error;
  }
}
