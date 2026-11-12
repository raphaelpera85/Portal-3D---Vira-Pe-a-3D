"use server";

import { revalidatePath } from "next/cache";
import { getUserWithRole } from "@/lib/auth-role.server";
import { makeDesignerSlug, validateDesignerProfile } from "@/lib/designer-profile";

export type DesignerProfileState = { message: string; success: boolean };

export async function submitDesignerProfile(_previous: DesignerProfileState, formData: FormData): Promise<DesignerProfileState> {
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) return { message: "Entre na sua conta para enviar seu perfil.", success: false };

  const profile = validateDesignerProfile(Object.fromEntries(formData));
  if (!profile) return { message: "Confira os campos e tente novamente.", success: false };

  const existing = await actor.supabase.from("designer_profiles").select("slug").eq("user_id", actor.user.id).maybeSingle();
  if (existing.error) return { message: "Não foi possível carregar seu perfil. Tente novamente.", success: false };
  const slug = existing.data?.slug ?? makeDesignerSlug(profile.displayName, actor.user.id.replaceAll("-", "").slice(0, 12));
  const { error } = await actor.supabase.rpc("submit_designer_profile", {
    p_slug: slug,
    p_display_name: profile.displayName,
    p_biography: profile.biography,
    p_portfolio_url: profile.portfolioUrl,
    p_city: profile.city,
    p_state_code: profile.stateCode,
    p_specialties: profile.specialties,
  });
  if (error) return { message: "Não foi possível salvar o perfil. Atualize a página e tente novamente.", success: false };

  revalidatePath("/conta");
  revalidatePath("/designers");
  revalidatePath("/painel/designer");
  return { message: "Perfil enviado e salvo. A equipe vai revisar sua publicação.", success: true };
}

