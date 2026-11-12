import { createDecipheriv, createCipheriv, randomBytes } from "node:crypto";

function readKey(value: string) {
  if (!/^[a-f\d]{64}$/i.test(value)) throw new Error("Mercado Pago token encryption key must be 32-byte hex");
  return Buffer.from(value, "hex");
}

export function encryptMercadoPagoToken(token: string, keyHex: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", readKey(keyHex), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptMercadoPagoToken(value: string, keyHex: string) {
  const [version, iv, tag, ciphertext, extra] = value.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra) throw new Error("Invalid Mercado Pago token ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", readKey(keyHex), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
