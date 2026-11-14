export function areLegalPagesIndexable(env: Record<string, string | undefined> = process.env) {
  return env.SITE_LEGAL_PAGES_APPROVED === "true"
    && [env.SITE_LEGAL_NAME, env.SITE_LEGAL_ID, env.SITE_LEGAL_ADDRESS, env.SITE_PRIVACY_EMAIL].every((value) => value?.trim());
}
