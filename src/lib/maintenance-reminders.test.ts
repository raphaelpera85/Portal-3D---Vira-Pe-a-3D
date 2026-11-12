import { describe, expect, it } from "vitest";
import { getBrazilianCalendarDate, getMaintenanceReminders } from "./maintenance-reminders";

describe("getMaintenanceReminders", () => {
  it("uses the Brazilian calendar day around UTC midnight", () => {
    expect(getBrazilianCalendarDate(new Date("2026-11-12T02:00:00Z"))).toBe("2026-11-11");
  });

  it("uses the latest schedule for each component and reports overdue date or usage hours", () => {
    expect(getMaintenanceReminders([
      { component: "Bico", performed_at: "2026-01-01", next_due_at: "2026-11-12", next_due_hours: 900 },
      { component: "bico", performed_at: "2026-10-01", next_due_at: "2026-11-30", next_due_hours: 1200 },
      { component: "Correia", performed_at: "2026-09-01", next_due_at: null, next_due_hours: 1000 },
    ], 1000, "2026-11-11")).toEqual([
      { component: "Correia", nextDueAt: null, nextDueHours: 1000, daysRemaining: null, hoursRemaining: 0, due: true, overdue: false },
      { component: "bico", nextDueAt: "2026-11-30", nextDueHours: 1200, daysRemaining: 19, hoursRemaining: 200, due: false, overdue: false },
    ]);
  });

  it("keeps future dates visible as scheduled and hides components without a next service", () => {
    expect(getMaintenanceReminders([
      { component: "Mesa", performed_at: "2026-09-01", next_due_at: "2027-01-01", next_due_hours: null },
      { component: "Ventoinha", performed_at: "2026-10-01", next_due_at: null, next_due_hours: null },
    ], 20, "2026-11-11")).toEqual([
      { component: "Mesa", nextDueAt: "2027-01-01", nextDueHours: null, daysRemaining: 51, hoursRemaining: null, due: false, overdue: false },
    ]);
  });
});
