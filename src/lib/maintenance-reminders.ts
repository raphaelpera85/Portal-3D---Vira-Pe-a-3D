export type MaintenanceScheduleEvent = {
  component: string;
  performed_at: string;
  next_due_at: string | null;
  next_due_hours: number | string | null;
};

export function getBrazilianCalendarDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: "year" | "month" | "day") => parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getMaintenanceReminders(events: MaintenanceScheduleEvent[], accumulatedHours: number, today: string) {
  const latestByComponent = new Map<string, MaintenanceScheduleEvent>();
  for (const event of events) {
    const key = event.component.trim().toLocaleLowerCase("pt-BR");
    const existing = latestByComponent.get(key);
    if (!existing || event.performed_at > existing.performed_at) latestByComponent.set(key, event);
  }

  const todayMs = Date.parse(`${today}T00:00:00Z`);
  return [...latestByComponent.values()].flatMap((event) => {
    const nextDueHours = event.next_due_hours == null ? null : Number(event.next_due_hours);
    if (!event.next_due_at && nextDueHours == null) return [];
    const daysRemaining = event.next_due_at ? Math.ceil((Date.parse(`${event.next_due_at}T00:00:00Z`) - todayMs) / 86_400_000) : null;
    const hoursRemaining = nextDueHours == null ? null : Math.round((nextDueHours - accumulatedHours) * 100) / 100;
    const due = (daysRemaining != null && daysRemaining <= 0) || (hoursRemaining != null && hoursRemaining <= 0);
    const overdue = (daysRemaining != null && daysRemaining < 0) || (hoursRemaining != null && hoursRemaining < 0);
    return [{ component: event.component, nextDueAt: event.next_due_at, nextDueHours,
      daysRemaining, hoursRemaining, due, overdue }];
  }).sort((left, right) => Number(right.due) - Number(left.due)
    || (left.daysRemaining ?? Infinity) - (right.daysRemaining ?? Infinity)
    || (left.hoursRemaining ?? Infinity) - (right.hoursRemaining ?? Infinity));
}
