"use server";

import { revalidatePath } from "next/cache";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateProductQuoteOffer } from "@/lib/marketplace-validation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type DesignerServiceQuoteState = { message: string; success: boolean };

export async function submitDesignerServiceQuote(
  _previous: DesignerServiceQuoteState,
  formData: FormData,
): Promise<DesignerServiceQuoteState> {
  const requestId = formData.get("requestId");
  const offer = validateProductQuoteOffer({
    totalBrl: formData.get("totalBrl"),
    leadDays: formData.get("leadDays"),
    terms: formData.get("terms"),
  });
  if (typeof requestId !== "string" || !uuidPattern.test(requestId) || !offer || offer.terms.trim().length < 20) {
    return { message: "Informe um valor, prazo e escopo de entrega válidos.", success: false };
  }

  const actor = await getUserWithRole("designer");
  if (!actor.supabase || !actor.user) return { message: "Entre na conta para responder ao pedido.", success: false };
  if (!actor.authorized) return { message: "Esta conta não tem acesso ao painel de designers.", success: false };

  const { error } = await actor.supabase.rpc("submit_designer_service_quote", {
    p_request_id: requestId,
    p_amount_cents: Math.round(offer.totalBrl * 100),
    p_lead_days: offer.leadDays,
    p_notes: offer.terms,
  });
  if (error) return { message: "Não foi possível enviar a proposta. Confira se o pedido continua aberto.", success: false };

  revalidatePath("/painel/designer");
  revalidatePath("/conta/modelagem");
  return { message: "Proposta enviada ao comprador. O pagamento ainda não foi processado.", success: true };
}
