"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateCredentials, validateRegistration } from "@/lib/auth-validation";
import { validateBuyerAddress } from "@/lib/buyer-address";

export type AuthActionState = { message: string; success: boolean };
const invalidMessage = "Não foi possível concluir. Confira os dados informados e tente novamente.";
const addressUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveBuyerAddress(formData: FormData): Promise<void> {
  const address = validateBuyerAddress(Object.fromEntries(formData.entries()));
  if (!address) redirect("/conta?endereco=erro#enderecos");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("save_buyer_address", {
    p_id: address.id, p_label: address.label, p_recipient_name: address.recipientName,
    p_postal_code: address.postalCode, p_street: address.street, p_number: address.number,
    p_complement: address.complement, p_district: address.district, p_city: address.city,
    p_state_code: address.stateCode, p_reference: address.reference, p_is_default: address.isDefault,
  });
  if (error) redirect("/conta?endereco=erro#enderecos");
  revalidatePath("/conta");
  redirect("/conta?endereco=salvo#enderecos");
}

export async function deleteBuyerAddress(formData: FormData): Promise<void> {
  const addressId = formData.get("addressId");
  if (typeof addressId !== "string" || !addressUuid.test(addressId)) redirect("/conta?endereco=erro#enderecos");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("delete_buyer_address", { p_id: addressId });
  if (error) redirect("/conta?endereco=erro#enderecos");
  revalidatePath("/conta");
  redirect("/conta?endereco=excluido#enderecos");
}

export async function signInAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const credentials = validateCredentials(formData.get("email"), formData.get("password"));
  if (!credentials) return { message: invalidMessage, success: false };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "O acesso ainda não está conectado. Configure o Supabase para habilitar contas.", success: false };

  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) return { message: "E-mail ou senha incorretos. Confira os dados e tente novamente.", success: false };
  redirect("/conta");
}

export async function signUpAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const registration = validateRegistration(formData.get("displayName"), formData.get("email"), formData.get("password"));
  if (!registration) return { message: invalidMessage, success: false };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "O acesso ainda não está conectado. Configure o Supabase para habilitar contas.", success: false };

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? (await headers()).get("origin") ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email: registration.email,
    password: registration.password,
    options: { data: { display_name: registration.displayName }, emailRedirectTo: `${origin}/auth/callback?next=/conta` },
  });
  if (error) return { message: "Não foi possível criar a conta. Verifique os dados ou tente novamente mais tarde.", success: false };
  if (data.session) redirect("/conta");
  return { message: "Cadastro iniciado. Confira seu e-mail para confirmar a conta e entrar.", success: true };
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/conta");
}
