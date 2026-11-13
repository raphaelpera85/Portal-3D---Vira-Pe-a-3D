"use server";

import { revalidatePath } from "next/cache";
import { getUserWithRole } from "@/lib/auth-role.server";
import { getBrazilianCalendarDate } from "@/lib/maintenance-reminders";
import { validateDesignerServiceRequest } from "@/lib/designer-service-request";

export type DesignerServiceRequestState = { message: string; success: boolean };

export async function createDesignerServiceRequest(
  slug: string,
  _previous: DesignerServiceRequestState,
  formData: FormData,
): Promise<DesignerServiceRequestState> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return { message: "Este perfil de designer não está disponível para solicitação.", success: false };
  }
  const request = validateDesignerServiceRequest(Object.fromEntries(formData.entries()), getBrazilianCalendarDate());
  if (!request) return { message: "Confira o título, os detalhes, o prazo e o link de referência.", success: false };

  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user) return { message: "Entre na sua conta para solicitar uma modelagem.", success: false };
  if (!actor.authorized) return { message: "Esta conta não tem acesso às solicitações de comprador.", success: false };

  const { error } = await actor.supabase.rpc("create_designer_service_request", {
    p_designer_slug: slug,
    p_title: request.title,
    p_brief: request.brief,
    p_due_date: request.dueDate,
    p_reference_url: request.referenceUrl,
  });
  if (error) return { message: "Não foi possível enviar o pedido. Confira se o perfil ainda está publicado e tente novamente.", success: false };

  revalidatePath(`/designers/${slug}`);
  revalidatePath("/painel/designer");
  revalidatePath("/conta/modelagem");
  return { message: "Pedido enviado. Você acompanhará a resposta do designer na sua conta.", success: true };
}
