import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), getMercadoPagoSellerAccessToken: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/mercado-pago-access-token.server", () => ({ getMercadoPagoSellerAccessToken: mocks.getMercadoPagoSellerAccessToken }));
vi.mock("next/navigation", () => ({ redirect: (value: string) => { throw new Error(`redirect:${value}`); } }));

import { configureMercadoPagoReleaseReconciliation, requestMercadoPagoReleaseReport } from "./reconciliation-actions";
import { releaseReportColumns } from "@/lib/mercado-pago-release-reconciliation";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function makerContext(authorized = true) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "store-1" }, error: null }) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  mocks.getUserWithRole.mockResolvedValue({ supabase: { from: vi.fn().mockReturnValue(query) }, user: { id: "maker-1" }, authorized });
}

describe("maker release reconciliation actions", () => {
  beforeEach(() => {
    mocks.getUserWithRole.mockReset(); mocks.getMercadoPagoSellerAccessToken.mockReset().mockResolvedValue("seller-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("requires explicit consent before changing Mercado Pago's report configuration", async () => {
    await expect(configureMercadoPagoReleaseReconciliation(form({}))).rejects.toThrow("redirect:/painel/maker/financeiro/conciliacao?resultado=configuracao-nao-confirmada");
    expect(mocks.getUserWithRole).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not change report settings for users without a maker role", async () => {
    makerContext(false);
    await expect(configureMercadoPagoReleaseReconciliation(form({ confirmConfiguration: "yes" }))).rejects.toThrow("redirect:/painel/maker/financeiro/conciliacao?resultado=acesso-negado");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves an existing schedule and settings while adding the required columns", async () => {
    makerContext();
    const current = { scheduled: true, file_name_prefix: "existing-report", display_timezone: "GMT-03", notification_email_list: ["owner@example.com"],
      frequency: { hour: 2, type: "weekly", value: 2 }, columns: [{ key: "DATE" }] };
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(current)).mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(configureMercadoPagoReleaseReconciliation(form({ confirmConfiguration: "yes" }))).rejects.toThrow("redirect:/painel/maker/financeiro/conciliacao?resultado=configuracao-salva");
    const [, request] = vi.mocked(fetch).mock.calls[1];
    const payload = JSON.parse(String(request?.body));
    expect(request?.method).toBe("PUT");
    expect(payload.file_name_prefix).toBe("existing-report");
    expect(payload.notification_email_list).toEqual(["owner@example.com"]);
    expect(payload.frequency).toEqual(current.frequency);
    expect(payload.scheduled).toBeUndefined();
    expect(payload.columns.map((column: { key: string }) => column.key)).toContain("EXTERNAL_REFERENCE");
  });

  it("rejects invalid report periods before connecting to Mercado Pago", async () => {
    await expect(requestMercadoPagoReleaseReport(form({ from: "2026-10-01", through: "2026-11-13" }))).rejects.toThrow("redirect:/painel/maker/financeiro/conciliacao?resultado=periodo-invalido");
    expect(mocks.getUserWithRole).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("only generates manual releases when the account has the required configured columns", async () => {
    makerContext();
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ columns: [{ key: "DATE" }] }));
    await expect(requestMercadoPagoReleaseReport(form({ from: "2026-11-07", through: "2026-11-13" }))).rejects.toThrow("redirect:/painel/maker/financeiro/conciliacao?resultado=configuracao-pendente");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("requests a manual report with São Paulo day boundaries and never activates scheduling", async () => {
    makerContext();
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ scheduled: false, columns: releaseReportColumns.map((key) => ({ key })) }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    await expect(requestMercadoPagoReleaseReport(form({ from: "2026-11-07", through: "2026-11-13" }))).rejects.toThrow("redirect:/painel/maker/financeiro/conciliacao?resultado=geracao-solicitada");
    const [url, request] = vi.mocked(fetch).mock.calls[1];
    expect(url).toBe("https://api.mercadopago.com/v1/account/release_report");
    expect(JSON.parse(String(request?.body))).toEqual({ begin_date: "2026-11-07T03:00:00.000Z", end_date: "2026-11-14T02:59:59.999Z" });
  });
});
