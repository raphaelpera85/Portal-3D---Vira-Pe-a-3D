import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { applySessionCookiePolicy, SESSION_REMEMBER_COOKIE, shouldRememberSession } from "./session-cookie-policy";

export async function createSupabaseServerClient(options?: { rememberMe?: boolean }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;

  const cookieStore = await cookies();
  const rememberSession = options?.rememberMe ?? shouldRememberSession(cookieStore.get(SESSION_REMEMBER_COOKIE)?.value);

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) => cookieStore.set(name, value, applySessionCookiePolicy(cookieOptions ?? {}, rememberSession)));
        } catch {
          // Server Components cannot write cookies; src/proxy.ts refreshes sessions before rendering.
        }
      },
    },
  });
}
