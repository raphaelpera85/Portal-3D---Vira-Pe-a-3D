import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  headers: vi.fn(),
  getUserWithRole: vi.fn(),
  validateEmailAddress: vi.fn(),
  validateCredentials: vi.fn(),
  validateRegistration: vi.fn(),
  validateBuyerAddress: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/auth-validation", () => ({
  validateEmailAddress: mocks.validateEmailAddress,
  validateCredentials: mocks.validateCredentials,
  validateRegistration: mocks.validateRegistration,
}));
vi.mock("@/lib/buyer-address", () => ({ validateBuyerAddress: mocks.validateBuyerAddress }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { requestPasswordResetAction, signUpAction, updatePasswordAction } from "./actions";

const initialState = { message: "", success: false };
const form = (fields: Record<string, string>) => {
  const value = new FormData();
  for (const [key, entry] of Object.entries(fields)) value.set(key, entry);
  return value;
};

describe("account password recovery", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://virapeca3d.example");
    mocks.headers.mockResolvedValue(new Headers({ origin: "https://local.example" }));
    mocks.createSupabaseServerClient.mockReset();
    mocks.validateEmailAddress.mockImplementation((value) => typeof value === "string" && value.includes("@") ? value.trim().toLowerCase() : null);
    mocks.validateCredentials.mockReset();
    mocks.validateRegistration.mockReset();
    mocks.getUserWithRole.mockReset();
    mocks.validateBuyerAddress.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.redirect.mockReset();
  });

  it("sends recovery through the auth callback without revealing whether an account exists", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { resetPasswordForEmail } });

    const result = await requestPasswordResetAction(initialState, form({ email: " RaphaelPera85@Gmail.com " }));

    expect(result.success).toBe(true);
    expect(result.message).toContain("Se houver uma conta");
    expect(resetPasswordForEmail).toHaveBeenCalledWith("raphaelpera85@gmail.com", {
      redirectTo: "https://virapeca3d.example/auth/callback?next=/conta/nova-senha",
    });
  });

  it("does not contact Supabase for an invalid email address", async () => {
    const result = await requestPasswordResetAction(initialState, form({ email: "not-an-email" }));

    expect(result.success).toBe(false);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("updates a password only for an authenticated recovery session", async () => {
    const updateUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser, updateUser } });

    const result = await updatePasswordAction(initialState, form({ password: "new-password-123", confirmation: "new-password-123" }));

    expect(result.success).toBe(true);
    expect(updateUser).toHaveBeenCalledWith({ password: "new-password-123" });
  });

  it("rejects mismatched passwords before calling Supabase", async () => {
    const updateUser = vi.fn();
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser, updateUser } });

    const result = await updatePasswordAction(initialState, form({ password: "new-password-123", confirmation: "different-password" }));

    expect(result.success).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("does not update a password without an authenticated recovery session", async () => {
    const updateUser = vi.fn();
    const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser, updateUser } });

    const result = await updatePasswordAction(initialState, form({ password: "new-password-123", confirmation: "new-password-123" }));

    expect(result.success).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("account signup return destination", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://virapeca3d.example");
    mocks.createSupabaseServerClient.mockReset();
    mocks.validateRegistration.mockReturnValue({ displayName: "Raphael", email: "raphael@example.com", password: "password-123" });
    mocks.redirect.mockReset();
  });

  it("preserves the model registration destination through email confirmation", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { signUp } });

    const result = await signUpAction(initialState, form({ destination: "maker-model-registration" }));

    expect(result.success).toBe(true);
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ emailRedirectTo: "https://virapeca3d.example/auth/callback?next=%2Fconta%3Fdestino%3Dmodelo-3d" }),
    }));
  });

  it("returns an immediately created session to the model registration destination", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { session: { access_token: "session" } }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { signUp } });

    await signUpAction(initialState, form({ destination: "maker-model-registration" }));

    expect(mocks.redirect).toHaveBeenCalledWith("/conta?destino=modelo-3d");
  });

  it("ignores unrecognized signup destinations", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { signUp } });

    await signUpAction(initialState, form({ destination: "https://evil.example" }));

    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ emailRedirectTo: "https://virapeca3d.example/auth/callback?next=%2Fconta" }),
    }));
  });
});
