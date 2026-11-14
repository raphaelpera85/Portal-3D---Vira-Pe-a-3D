import { describe, expect, it } from "vitest";
import { isMakerRealtimeUnavailable } from "./maker-notification-sync";

describe("isMakerRealtimeUnavailable", () => {
  it.each(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"])("uses fallback refresh for %s", (status) => {
    expect(isMakerRealtimeUnavailable(status)).toBe(true);
  });

  it("keeps live refresh when the subscription is active", () => {
    expect(isMakerRealtimeUnavailable("SUBSCRIBED")).toBe(false);
  });
});
