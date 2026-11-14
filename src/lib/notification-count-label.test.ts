import { describe, expect, it } from "vitest";
import { getUnreadNotificationLabel } from "./notification-count-label";

describe("getUnreadNotificationLabel", () => {
  it.each([[0, "Notificações"], [null, "Notificações"], [1, "Notificações · 1 não lida"], [4, "Notificações · 4 não lidas"]] as const)(
    "formats count %s as %s",
    (count, expected) => expect(getUnreadNotificationLabel(count)).toBe(expected),
  );
});
