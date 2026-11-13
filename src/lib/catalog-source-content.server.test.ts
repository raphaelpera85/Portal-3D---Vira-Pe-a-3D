import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { fetchCatalogSourceContentFingerprint, maxCatalogFingerprintBytes } from "./catalog-source-content.server";

vi.mock("server-only", () => ({}));

describe("fetchCatalogSourceContentFingerprint", () => {
  it("hashes small text sources without following redirects implicitly", async () => {
    const body = "official printer specifications";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } }));

    await expect(fetchCatalogSourceContentFingerprint("https://store.anycubic.com/printer", "", fetcher))
      .resolves.toBe(createHash("sha256").update(body).digest("hex"));
    expect(fetcher).toHaveBeenCalledWith("https://store.anycubic.com/printer", expect.objectContaining({ method: "GET", redirect: "manual", cache: "no-store" }));
  });

  it("follows only a small number of redirects on allowed official hosts", async () => {
    const body = "specification";
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://www.anycubic.com/pages/specification" } }))
      .mockResolvedValueOnce(new Response(body, { headers: { "content-type": "application/pdf" } }));

    await expect(fetchCatalogSourceContentFingerprint("https://store.anycubic.com/specification", "", fetcher))
      .resolves.toBe(createHash("sha256").update(body).digest("hex"));
    expect(fetcher).toHaveBeenCalledTimes(2);

    const blockedRedirect = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://attacker.invalid/file" } }));
    await expect(fetchCatalogSourceContentFingerprint("https://store.anycubic.com/specification", "", blockedRedirect)).resolves.toBeNull();
    expect(blockedRedirect).toHaveBeenCalledTimes(1);
  });

  it("does not read oversized or unsupported source content", async () => {
    let canceledDeclared = false;
    const declaredTooLarge = new Response(new ReadableStream({ cancel() { canceledDeclared = true; } }), {
      headers: { "content-type": "text/html", "content-length": String(maxCatalogFingerprintBytes + 1) },
    });
    await expect(fetchCatalogSourceContentFingerprint("https://store.anycubic.com/large", "", vi.fn<typeof fetch>().mockResolvedValue(declaredTooLarge))).resolves.toBeNull();
    expect(canceledDeclared).toBe(true);

    let canceledStream = false;
    const streamTooLarge = new Response(new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(maxCatalogFingerprintBytes + 1)); },
      cancel() { canceledStream = true; },
    }), { headers: { "content-type": "text/plain" } });
    await expect(fetchCatalogSourceContentFingerprint("https://store.anycubic.com/stream", "", vi.fn<typeof fetch>().mockResolvedValue(streamTooLarge))).resolves.toBeNull();
    expect(canceledStream).toBe(true);

    const binarySource = new Response("binary", { headers: { "content-type": "application/octet-stream" } });
    await expect(fetchCatalogSourceContentFingerprint("https://store.anycubic.com/file", "", vi.fn<typeof fetch>().mockResolvedValue(binarySource))).resolves.toBeNull();
  });
});
