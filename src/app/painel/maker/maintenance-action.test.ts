import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), revalidatePath: vi.fn(), redirect: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));

import { logPrinterMaintenance } from "./actions";

const printerId = "dc4e58d6-c782-4dc5-83c1-68d08072224d";

function form(hoursAtEvent: string) {
  const data = new FormData();
  data.set("printerId", printerId);
  data.set("performedAt", "2026-11-10");
  data.set("maintenanceType", "preventive");
  data.set("component", "Eixo X");
  data.set("costBrl", "50");
  data.set("hoursAtEvent", hoursAtEvent);
  return data;
}

describe("logPrinterMaintenance", () => {
  const storeQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  const printerRead = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  const printerUpdate = { update: vi.fn(), eq: vi.fn(), lt: vi.fn() };
  const maintenanceInsert = { insert: vi.fn() };
  const from = vi.fn();

  beforeEach(() => {
    for (const query of [storeQuery, printerRead, printerUpdate]) {
      for (const method of Object.values(query)) vi.mocked(method).mockReset().mockReturnValue(query);
    }
    storeQuery.maybeSingle.mockResolvedValue({ data: { id: "store-1" } });
    printerRead.maybeSingle.mockResolvedValue({ data: { id: printerId, accumulated_hours: 100 } });
    maintenanceInsert.insert.mockReset().mockResolvedValue({ error: null });
    printerUpdate.lt.mockReset().mockResolvedValue({ error: null });
    from.mockReset().mockImplementation((table: string) => {
      if (table === "stores") return storeQuery;
      if (table === "printer_maintenance_events") return maintenanceInsert;
      return from.mock.calls.filter(([name]) => name === table).length === 1 ? printerRead : printerUpdate;
    });
    mocks.getUserWithRole.mockReset().mockResolvedValue({
      supabase: { from }, user: { id: "maker-user" }, authorized: true,
    });
    mocks.revalidatePath.mockReset();
    mocks.redirect.mockReset().mockImplementation((url: string) => { throw new Error(`redirect:${url}`); });
  });

  it("advances accumulated hours after saving a newer maintenance reading", async () => {
    await expect(logPrinterMaintenance(form("125"))).rejects.toThrow("redirect:/painel/maker?resultado=manutencao-salva#equipamentos");

    expect(maintenanceInsert.insert).toHaveBeenCalledWith(expect.objectContaining({ hours_at_event: 125 }));
    expect(printerUpdate.update).toHaveBeenCalledWith(expect.objectContaining({ accumulated_hours: 125, updated_at: expect.any(String) }));
    expect(printerUpdate.lt).toHaveBeenCalledWith("accumulated_hours", 125);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/painel/maker");
  });

  it("does not lower the equipment hour meter for an older maintenance entry", async () => {
    await expect(logPrinterMaintenance(form("80"))).rejects.toThrow("redirect:/painel/maker?resultado=manutencao-salva#equipamentos");

    expect(maintenanceInsert.insert).toHaveBeenCalledWith(expect.objectContaining({ hours_at_event: 80 }));
    expect(printerUpdate.update).not.toHaveBeenCalled();
  });

  it("reports a partial failure without inviting a duplicate maintenance entry", async () => {
    printerUpdate.lt.mockResolvedValue({ error: { message: "database unavailable" } });

    await expect(logPrinterMaintenance(form("125"))).rejects.toThrow("redirect:/painel/maker?resultado=manutencao-horimetro-erro#equipamentos");

    expect(maintenanceInsert.insert).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/painel/maker");
  });
});
