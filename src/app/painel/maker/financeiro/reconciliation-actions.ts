"use server";

import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { getMercadoPagoSellerAccessToken } from "@/lib/mercado-pago-access-token.server";
import { buildReleaseReportConfig, getReleaseReportDateRange, hasReleaseReportReconciliationColumns } from "@/lib/mercado-pago-release-reconciliation";

function feedback(result: string): never { redirect(`/painel/maker/financeiro/conciliacao?resultado=${result}`); }

async function getMakerPaymentContext() {
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) return null;
  const { data: store } = await actor.supabase.from("stores").select("id").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) return null;
  return { actor, store };
}

async function providerConfig(token: string) {
  return fetch("https://api.mercadopago.com/v1/account/release_report/config", {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
  });
}

export async function configureMercadoPagoReleaseReconciliation(formData: FormData): Promise<void> {
  if (formData.get("confirmConfiguration") !== "yes") feedback("configuracao-nao-confirmada");
  const context = await getMakerPaymentContext();
  if (!context) feedback("acesso-negado");
  let token: string;
  try { token = await getMercadoPagoSellerAccessToken(context.store.id); } catch { feedback("conta-desconectada"); }
  let result = "configuracao-falhou";
  try {
    const currentResponse = await providerConfig(token);
    if (!currentResponse.ok && currentResponse.status !== 404) result = "relatorio-indisponivel";
    else {
      const current = currentResponse.ok ? await currentResponse.json().catch(() => null) : null;
      if (currentResponse.ok && !current) result = "relatorio-indisponivel";
      else if (current && hasReleaseReportReconciliationColumns(current)) result = "configuracao-pronta";
      else {
        const response = await fetch("https://api.mercadopago.com/v1/account/release_report/config", {
          method: currentResponse.status === 404 ? "POST" : "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(buildReleaseReportConfig(current)),
          signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
        });
        result = response.ok ? "configuracao-salva" : "configuracao-falhou";
      }
    }
  } catch { result = "configuracao-falhou"; }
  feedback(result);
}

export async function requestMercadoPagoReleaseReport(formData: FormData): Promise<void> {
  const from = formData.get("from"); const through = formData.get("through");
  if (typeof from !== "string" || typeof through !== "string" || !getReleaseReportDateRange(from, through)) feedback("periodo-invalido");
  const context = await getMakerPaymentContext();
  if (!context) feedback("acesso-negado");
  let token: string;
  try { token = await getMercadoPagoSellerAccessToken(context.store.id); } catch { feedback("conta-desconectada"); }
  let result = "geracao-falhou";
  try {
    const configResponse = await providerConfig(token);
    const config = configResponse.ok ? await configResponse.json().catch(() => null) : null;
    if (!hasReleaseReportReconciliationColumns(config)) result = "configuracao-pendente";
    else {
      const range = getReleaseReportDateRange(from, through)!;
      const response = await fetch("https://api.mercadopago.com/v1/account/release_report", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ begin_date: range.beginDate, end_date: range.endDate }),
        signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
      });
      result = response.status === 202 ? "geracao-solicitada" : "geracao-falhou";
    }
  } catch { result = "geracao-falhou"; }
  feedback(result);
}
