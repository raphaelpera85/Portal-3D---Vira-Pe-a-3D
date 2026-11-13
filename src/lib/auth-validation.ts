export type Credentials = { email: string; password: string };
export type Registration = Credentials & { displayName: string };

export function validateEmailAddress(emailValue: unknown): string | null {
  if (typeof emailValue !== "string") return null;
  const email = emailValue.trim().toLocaleLowerCase("en-US");
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function validateCredentials(emailValue: unknown, passwordValue: unknown): Credentials | null {
  const email = validateEmailAddress(emailValue);
  if (!email || typeof passwordValue !== "string" || passwordValue.length < 8 || passwordValue.length > 128) return null;
  return { email, password: passwordValue };
}

export function validateRegistration(nameValue: unknown, emailValue: unknown, passwordValue: unknown): Registration | null {
  const credentials = validateCredentials(emailValue, passwordValue);
  if (typeof nameValue !== "string") return null;
  const displayName = nameValue.trim();
  if (!credentials || displayName.length < 2 || displayName.length > 80) return null;
  return { ...credentials, displayName };
}
