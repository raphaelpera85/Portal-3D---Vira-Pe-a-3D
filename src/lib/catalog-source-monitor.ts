export type CatalogSourceEvent = "source_changed" | "source_unavailable" | "source_moved" | "source_check_failed";
export type CatalogWatchState = "current" | "unavailable" | "moved" | "changed" | "uncheckable" | "failed";

const knownOfficialHosts = [
  "anycubic.com", "creality.com", "elegoo.com", "prusa3d.com", "flashforge.com", "sovol3d.com",
  "qidi3d.com", "artillery3d.com", "flsun3d.com", "raise3d.com", "formlabs.com", "phrozen3d.com",
  "ultimaker.com", "snapmaker.com", "bambulab.com", "bambulab-us.myshopify.com",
];

export function isAllowedCatalogSourceUrl(value: string, extraHosts = "") {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const allowedHosts = [...knownOfficialHosts, ...extraHosts.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)];
  return url.protocol === "https:"
    && !url.username
    && !url.password
    && (!url.port || url.port === "443")
    && host.includes(".")
    && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(host)
    && !/\.(local|internal|localhost|test|invalid)$/.test(host)
    && allowedHosts.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function getAllowedCatalogRedirect(currentUrl: string, location: string, extraHosts = "") {
  try {
    const target = new URL(location, currentUrl);
    return isAllowedCatalogSourceUrl(target.toString(), extraHosts) ? target.toString() : null;
  } catch { return null; }
}

export function classifyCatalogSourceResponse(
  previous: { etag: string | null; lastModified: string | null } | null,
  current: { status: number; etag: string | null; lastModified: string | null },
): { state: CatalogWatchState; event: CatalogSourceEvent | null; detail: string | null } {
  if (current.status === 404 || current.status === 410) return { state: "unavailable", event: "source_unavailable", detail: `A fonte retornou HTTP ${current.status}.` };
  if (current.status >= 300 && current.status < 400) return { state: "moved", event: "source_moved", detail: `A fonte redireciona (HTTP ${current.status}); a URL requer revisão.` };
  if (current.status === 405 || current.status === 501) return { state: "uncheckable", event: null, detail: "O servidor não aceita HEAD; o conteúdo não foi baixado." };
  if (current.status < 200 || current.status >= 300) return { state: "failed", event: null, detail: `A verificação retornou HTTP ${current.status}.` };

  const hasValidator = current.etag != null || current.lastModified != null;
  if (!hasValidator) return { state: "uncheckable", event: null, detail: "A fonte não fornece ETag nem Last-Modified; alterações de conteúdo não são detectáveis sem baixar a página." };
  const hasComparableValidator = Boolean(previous?.etag && current.etag) || Boolean(previous?.lastModified && current.lastModified);
  if (previous && (previous.etag != null || previous.lastModified != null) && !hasComparableValidator) {
    return { state: "uncheckable", event: null, detail: "Os validadores anteriores não estão disponíveis nesta resposta; a fonte precisa de conferência manual." };
  }
  if (previous && ((previous.etag != null && current.etag != null && previous.etag !== current.etag)
    || (previous.lastModified != null && current.lastModified != null && previous.lastModified !== current.lastModified))) {
    return { state: "changed", event: "source_changed", detail: "ETag ou Last-Modified mudou; as especificações precisam de conferência humana." };
  }
  return { state: "current", event: null, detail: null };
}

export function getCatalogSourceCheckCycleStart(date: Date, configuredDay = "1") {
  const parsedDay = /^\d$/.test(configuredDay) ? Number(configuredDay) : 1;
  const day = parsedDay <= 6 ? parsedDay : 1;
  const cycleStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  cycleStart.setUTCDate(cycleStart.getUTCDate() - ((date.getUTCDay() - day + 7) % 7));
  return cycleStart;
}

export function hasCatalogSourceBeenCheckedInCycle(lastCheckedAt: string | null | undefined, date: Date, configuredDay = "1") {
  const checkedAt = lastCheckedAt ? Date.parse(lastCheckedAt) : NaN;
  return Number.isFinite(checkedAt) && checkedAt >= getCatalogSourceCheckCycleStart(date, configuredDay).getTime();
}
