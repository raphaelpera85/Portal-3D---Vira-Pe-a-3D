import { describe, expect, it } from "vitest";
import { formatSupportElapsedDuration, formatSupportTicketAge } from "./support-ticket-age";

describe("formatSupportTicketAge", () => {
  const now = new Date("2026-11-13T12:00:00.000Z");

  it("formats minutes, hours, and days from the last update", () => {
    expect(formatSupportTicketAge("2026-11-13T11:42:00.000Z", now)).toBe("18 min");
    expect(formatSupportTicketAge("2026-11-13T08:00:00.000Z", now)).toBe("4 h");
    expect(formatSupportTicketAge("2026-11-11T10:00:00.000Z", now)).toBe("2 d 2 h");
  });

  it("clamps future timestamps and handles invalid dates", () => {
    expect(formatSupportTicketAge("2026-11-14T12:00:00.000Z", now)).toBe("0 min");
    expect(formatSupportTicketAge("invalid", now)).toBe("indisponível");
  });

  it("formats response durations returned in seconds", () => {
    expect(formatSupportElapsedDuration(90 * 60 * 1000)).toBe("1 h");
    expect(formatSupportElapsedDuration(Number.NaN)).toBe("indisponível");
  });
});
