import { describe, expect, it } from "vitest";
import { prioritizeSupportTickets } from "./support-ticket-queue";

describe("support ticket queue", () => {
  it("puts the oldest tickets needing staff action before waiting and resolved tickets", () => {
    const result = prioritizeSupportTickets([
      { id: "new-open", status: "open", updated_at: "2026-11-12T12:00:00Z" },
      { id: "closed", status: "closed", updated_at: "2026-11-12T10:00:00Z" },
      { id: "old-progress", status: "in_progress", updated_at: "2026-11-10T10:00:00Z" },
      { id: "waiting", status: "waiting_user", updated_at: "2026-11-12T11:00:00Z" },
      { id: "old-open", status: "open", updated_at: "2026-11-11T10:00:00Z" },
    ]);

    expect(result.map(({ id }) => id)).toEqual(["old-progress", "old-open", "new-open", "waiting", "closed"]);
  });
});
