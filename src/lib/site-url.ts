export function resolveSiteUrl(value: string | undefined, isProduction: boolean) {
  if (!value) return isProduction ? null : new URL("http://localhost:3000");
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return (url.protocol === "https:" || (!isProduction && local)) && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash ? url : null;
  } catch {
    return null;
  }
}

export function getSiteUrl() {
  return resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV === "production");
}
