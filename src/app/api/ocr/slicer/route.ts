import { getUserWithRole } from "@/lib/auth-role.server";
import { recognizeSlicerImages } from "@/lib/google-vision-ocr";
import { MAX_SLICER_OCR_IMAGE_BYTES, validateSlicerOcrImages } from "@/lib/ocr-image-validation";
import { readLimitedBody } from "@/lib/request-body";
import { parseSlicerOcrTexts } from "@/lib/slicer-ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_MULTIPART_BYTES = Math.floor(4.25 * 1024 * 1024);

export async function POST(request: Request) {
  const actor = await getUserWithRole("maker");
  if (!actor.user) return Response.json({ error: "authentication_required" }, { status: 401 });
  if (!actor.authorized) return Response.json({ error: "maker_account_required" }, { status: 403 });

  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) return Response.json({ error: "ocr_not_configured" }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_MULTIPART_BYTES) return Response.json({ error: "images_too_large" }, { status: 413 });

  let body: Uint8Array | null;
  try { body = await readLimitedBody(request.body, MAX_MULTIPART_BYTES); } catch { return Response.json({ error: "invalid_multipart_request" }, { status: 400 }); }
  if (body === null) return Response.json({ error: "images_too_large" }, { status: 413 });
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const bodyBuffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  let form: FormData;
  try { form = await new Request(request.url, { method: "POST", headers, body: bodyBuffer }).formData(); } catch { return Response.json({ error: "invalid_multipart_request" }, { status: 400 }); }
  const entries = form.getAll("images");
  if (entries.length < 1 || entries.length > 3 || entries.some((entry) => !(entry instanceof File))) {
    return Response.json({ error: "invalid_image_count" }, { status: 400 });
  }
  const files = entries as File[];
  if (files.some((file) => file.size > MAX_SLICER_OCR_IMAGE_BYTES)) return Response.json({ error: "image_too_large" }, { status: 413 });

  const images = await Promise.all(files.map(async (file) => ({ type: file.type, size: file.size, bytes: new Uint8Array(await file.arrayBuffer()) })));
  const validation = validateSlicerOcrImages(images);
  if (validation) return Response.json({ error: validation }, { status: 400 });
  const { data: withinQuota, error: quotaError } = await actor.supabase!.rpc("consume_maker_slicer_ocr_quota", { p_image_count: images.length });
  if (quotaError) return Response.json({ error: "ocr_quota_unavailable" }, { status: 503 });
  if (!withinQuota) return Response.json({ error: "ocr_daily_limit_reached" }, { status: 429 });

  try {
    const texts = await recognizeSlicerImages(images.map(({ bytes, type }) => ({ content: bytes, mimeType: type })), apiKey);
    return Response.json({ extraction: parseSlicerOcrTexts(texts) });
  } catch {
    return Response.json({ error: "ocr_provider_failed" }, { status: 502 });
  }
}
