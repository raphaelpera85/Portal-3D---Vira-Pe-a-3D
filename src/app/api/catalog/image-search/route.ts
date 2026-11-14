import { createHash } from "node:crypto";
import { recognizeCatalogImage } from "@/lib/google-vision-ocr";
import { MAX_SLICER_OCR_IMAGE_BYTES, validateSlicerOcrImages } from "@/lib/ocr-image-validation";
import { readLimitedBody } from "@/lib/request-body";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_MULTIPART_BYTES = 2.25 * 1024 * 1024;

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) return Response.json({ error: "image_search_not_configured" }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_MULTIPART_BYTES) return Response.json({ error: "image_too_large" }, { status: 413 });

  let body: Uint8Array | null;
  try { body = await readLimitedBody(request.body, MAX_MULTIPART_BYTES); } catch { return Response.json({ error: "invalid_multipart_request" }, { status: 400 }); }
  if (body === null) return Response.json({ error: "image_too_large" }, { status: 413 });
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const bodyBuffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  let form: FormData;
  try { form = await new Request(request.url, { method: "POST", headers, body: bodyBuffer }).formData(); } catch { return Response.json({ error: "invalid_multipart_request" }, { status: 400 }); }
  if (form.get("consent") !== "yes") return Response.json({ error: "image_search_consent_required" }, { status: 400 });
  const file = form.get("image");
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_SLICER_OCR_IMAGE_BYTES) return Response.json({ error: "invalid_image" }, { status: 400 });
  const image = { type: file.type, size: file.size, bytes: new Uint8Array(await file.arrayBuffer()) };
  const validation = validateSlicerOcrImages([image]);
  if (validation) return Response.json({ error: "invalid_image" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: "image_search_quota_unavailable" }, { status: 503 });
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "unknown";
  const date = new Date().toISOString().slice(0, 10);
  const ipHash = createHash("sha256").update(`${date}:${ip}`).digest("hex");
  const { data: withinQuota, error: quotaError } = await admin.rpc("consume_catalog_image_search_quota", { p_ip_hash: ipHash });
  if (quotaError) return Response.json({ error: "image_search_quota_unavailable" }, { status: 503 });
  if (!withinQuota) return Response.json({ error: "image_search_daily_limit_reached" }, { status: 429 });

  try {
    return Response.json(await recognizeCatalogImage({ content: image.bytes, mimeType: image.type }, apiKey));
  } catch {
    return Response.json({ error: "image_search_provider_failed" }, { status: 502 });
  }
}
