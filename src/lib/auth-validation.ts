export type Credentials = { email: string; password: string };
export type Registration = Credentials & { displayName: string };

export function validateCredentials(emailValue: unknown, passwordValue: unknown): Credentials | null {
  if (typeof emailValue !== "string" || typeof passwordValue !== "string") return null;
  const email = emailValue.trim().toLocaleLowerCase("en-US");
  const password = passwordValue;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) return null;
  return { email, password };
}

export function validateRegistration(nameValue: unknown, emailValue: unknown, passwordValue: unknown): Registration | null {
  const credentials = validateCredentials(emailValue, passwordValue);
  if (typeof nameValue !== "string") return null;
  const displayName = nameValue.trim();
  if (!credentials || displayName.length < 2 || displayName.length > 80) return null;
  return { ...credentials, displayName };
}
