import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function createMercadoPagoPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createMercadoPagoState(userId: string, clientSecret: string) {
  const nonce = randomBytes(32).toString("base64url");
  const signature = createHmac("sha256", clientSecret).update(`${nonce}:${userId}`).digest("base64url");
  return `${nonce}.${signature}`;
}

export function verifyMercadoPagoState(state: string, userId: string, clientSecret: string) {
  const [nonce, signature, extra] = state.split(".");
  if (!nonce || !signature || extra) return false;
  const expected = createHmac("sha256", clientSecret).update(`${nonce}:${userId}`).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, "base64url"); } catch { return false; }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function buildMercadoPagoAuthorizationUrl(clientId: string, redirectUri: string, state: string, challenge: string) {
  const url = new URL("https://auth.mercadopago.com/authorization");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}
