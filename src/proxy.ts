import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return NextResponse.next({ request });

  const pendingCookies = new Map<string, { name: string; value: string; options: Record<string, unknown> }>();
  const responseHeaders = new Headers();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach((cookie) => {
          request.cookies.set(cookie.name, cookie.value);
          pendingCookies.set(JSON.stringify([cookie.name, cookie.options.path, cookie.options.domain]), cookie);
        });
        Object.entries(headers).forEach(([name, value]) => responseHeaders.set(name, value));
      },
    },
  });

  await supabase.auth.getClaims();

  const response = NextResponse.next({ request });
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  responseHeaders.forEach((value, name) => response.headers.set(name, value));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
