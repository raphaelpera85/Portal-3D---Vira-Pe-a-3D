import { createBrowserClient } from "@supabase/ssr";
import { applySessionCookiePolicy, SESSION_REMEMBER_COOKIE, shouldRememberSession } from "./session-cookie-policy";

function readBrowserCookies() {
  return document.cookie.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return [];
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    try {
      return [{ name, value: decodeURIComponent(rawValue) }];
    } catch {
      return [{ name, value: rawValue }];
    }
  });
}

function writeBrowserCookie(name: string, value: string, options: Record<string, unknown>) {
  const attributes = [`${name}=${encodeURIComponent(value)}`, `Path=${typeof options.path === "string" ? options.path : "/"}`];
  if (typeof options.domain === "string") attributes.push(`Domain=${options.domain}`);
  if (typeof options.maxAge === "number") attributes.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.expires instanceof Date) attributes.push(`Expires=${options.expires.toUTCString()}`);
  if (typeof options.sameSite === "string") attributes.push(`SameSite=${options.sameSite}`);
  if (options.secure) attributes.push("Secure");
  document.cookie = attributes.join("; ");
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key || typeof document === "undefined") return null;
  return createBrowserClient(url, key, {
    cookies: {
      getAll: readBrowserCookies,
      setAll(cookiesToSet) {
        const rememberSession = shouldRememberSession(readBrowserCookies().find(({ name }) => name === SESSION_REMEMBER_COOKIE)?.value);
        cookiesToSet.forEach(({ name, value, options }) => writeBrowserCookie(name, value, applySessionCookiePolicy(options, rememberSession)));
      },
    },
  });
}
