export const SESSION_REMEMBER_COOKIE = "vp-remember-session";
export const REMEMBERED_SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export function shouldRememberSession(value: string | undefined) {
  return value !== "0";
}

export function applySessionCookiePolicy<T extends { maxAge?: number }>(options: T, remember: boolean): T {
  if (options.maxAge === 0) return options;
  const { maxAge: _maxAge, ...cookieOptions } = options;
  return (remember ? { ...cookieOptions, maxAge: REMEMBERED_SESSION_MAX_AGE } : cookieOptions) as T;
}
