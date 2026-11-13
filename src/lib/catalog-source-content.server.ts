import "server-only";
import { createHash } from "node:crypto";
import { getAllowedCatalogRedirect } from "./catalog-source-monitor";

export const maxCatalogFingerprintBytes = 512 * 1024;

export async function fetchCatalogSourceContentFingerprint(url: string, allowedHosts: string, fetcher: typeof fetch = fetch) {
  let target = url;
  for (let redirects = 0; redirects <= 2; redirects += 1) {
    const response = await fetcher(target, {
      method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(5000),
      headers: { "user-agent": "ViraPeca3D-CatalogSourceMonitor/1.0", accept: "text/html, application/xhtml+xml, application/pdf, text/plain" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      const next = location ? getAllowedCatalogRedirect(target, location, allowedHosts) : null;
      await response.body?.cancel();
      if (!next || redirects === 2) return null;
      target = next;
      continue;
    }
    if (!response.ok || !/^(text\/html|application\/xhtml\+xml|text\/plain|application\/pdf)(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) {
      await response.body?.cancel();
      return null;
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxCatalogFingerprintBytes) {
      await response.body?.cancel();
      return null;
    }
    if (!response.body) return createHash("sha256").digest("hex");

    const reader = response.body.getReader();
    const hash = createHash("sha256");
    let bytesRead = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        if (bytesRead > maxCatalogFingerprintBytes) {
          await reader.cancel();
          return null;
        }
        hash.update(value);
      }
      return hash.digest("hex");
    } finally {
      reader.releaseLock();
    }
  }
  return null;
}
