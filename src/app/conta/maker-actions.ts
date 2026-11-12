"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateMakerApplication } from "@/lib/marketplace-validation";

export type MakerApplicationState = { message: string; success: boolean };

export async function submitMakerApplication(_previous: MakerApplicationState, formData: FormData): Promise<MakerApplicationState> {
  const application = validateMakerApplication({
    businessName: formData.get("businessName"),
    description: formData.get("description"),
    portfolioUrl: formData.get("portfolioUrl"),
    city: formData.get("city"),
    stateCode: formData.get("stateCode"),
  });
  if (!application) return { message: "Confira o nome, a descrição, o estado e o link HTTPS do portfólio.", success: false };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "O backend ainda não está configurado para receber solicitações.", success: false };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Entre na sua conta para solicitar aprovação.", success: false };
  if (!auth.user.email) return { message: "Sua conta não tem um e-mail de contato confirmado.", success: false };

  const { error } = await supabase.from("maker_applications").insert({ ...application, user_id: auth.user.id, contact_email: auth.user.email });
  if (error?.code === "23505") return { message: "Você já tem uma solicitação pendente de análise.", success: false };
  if (error) return { message: "Não foi possível enviar a solicitação. Tente novamente mais tarde.", success: false };
  revalidatePath("/conta");
  return { message: "Solicitação enviada. Avisaremos quando a equipe concluir a análise.", success: true };
}
