import "server-only";
import { decryptMercadoPagoToken, encryptMercadoPagoToken } from "@/lib/mercado-pago-token";
import { normalizeMelhorEnvioRates } from "@/lib/melhor-envio";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Connection = {
  provider_user_id: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  token_expires_at: string;
  scopes: string;
};

const baseUrl = process.env.MELHOR_ENVIO_SANDBOX === "true"
  ? "https://sandbox.melhorenvio.com.br"
  : "https://melhorenvio.com.br";

async function getConnection(storeId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Melhor Envio indisponível");
  const { data, error } = await admin.from("store_melhor_envio_connections")
    .select("provider_user_id, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, scopes")
    .eq("store_id", storeId).maybeSingle();
  if (error || !data) throw new Error("Conecte sua conta Melhor Envio");
  return { admin, connection: data as Connection };
}

export async function getMelhorEnvioAccessToken(storeId: string) {
  const encryptionKey = process.env.ME_TOKEN_ENCRYPTION_KEY;
  const clientId = process.env.ME_CLIENT_ID;
  const clientSecret = process.env.ME_CLIENT_SECRET;
  if (!encryptionKey || !clientId || !clientSecret) throw new Error("Melhor Envio não configurado");
  const { admin, connection } = await getConnection(storeId);
  if (new Date(connection.token_expires_at).getTime() > Date.now() + 120_000) {
    return decryptMercadoPagoToken(connection.access_token_ciphertext, encryptionKey);
  }

  const refreshToken = decryptMercadoPagoToken(connection.refresh_token_ciphertext, encryptionKey);
  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }),
    signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object") {
    const { connection: latest } = await getConnection(storeId);
    if (latest.refresh_token_ciphertext !== connection.refresh_token_ciphertext
      && new Date(latest.token_expires_at).getTime() > Date.now() + 120_000) {
      return decryptMercadoPagoToken(latest.access_token_ciphertext, encryptionKey);
    }
    throw new Error("Renove a conexão com Melhor Envio");
  }
  const token = payload as Record<string, unknown>;
  if (typeof token.access_token !== "string" || typeof token.refresh_token !== "string"
    || (typeof token.user_id !== "string" && typeof token.user_id !== "number")
    || String(token.user_id) !== connection.provider_user_id
    || typeof token.expires_in !== "number" || !Number.isSafeInteger(token.expires_in) || token.expires_in < 1) {
    throw new Error("Renove a conexão com Melhor Envio");
  }
  const { data: saved, error } = await admin.from("store_melhor_envio_connections").update({
    access_token_ciphertext: encryptMercadoPagoToken(token.access_token, encryptionKey),
    refresh_token_ciphertext: encryptMercadoPagoToken(token.refresh_token, encryptionKey),
    token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    scopes: typeof token.scope === "string" ? token.scope : connection.scopes,
    updated_at: new Date().toISOString(),
  }).eq("store_id", storeId).eq("provider_user_id", connection.provider_user_id)
    .eq("refresh_token_ciphertext", connection.refresh_token_ciphertext).select("store_id").maybeSingle();
  if (error) throw new Error("Não foi possível atualizar a conexão Melhor Envio");
  if (!saved) {
    const { connection: latest } = await getConnection(storeId);
    if (new Date(latest.token_expires_at).getTime() <= Date.now() + 120_000) throw new Error("Atualize a conexão Melhor Envio");
    return decryptMercadoPagoToken(latest.access_token_ciphertext, encryptionKey);
  }
  return token.access_token;
}

export { type MelhorEnvioRate } from "@/lib/melhor-envio";

export async function calculateMelhorEnvioRates(storeId: string, from: string, to: string, products: Array<{
  id: string; width: number; height: number; length: number; weight: number; insurance_value: number; quantity: number;
}>) {
  const accessToken = await getMelhorEnvioAccessToken(storeId);
  const response = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`, "content-type": "application/json", accept: "application/json",
      "user-agent": "ViraPeca3D (suporte@virapeca3d.com.br)",
    },
    body: JSON.stringify({ from: { postal_code: from }, to: { postal_code: to }, products, options: { receipt: false, own_hand: false } }),
    signal: AbortSignal.timeout(10000), cache: "no-store", redirect: "error",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error("Não foi possível consultar as tarifas Melhor Envio");
  return normalizeMelhorEnvioRates(payload);
}
