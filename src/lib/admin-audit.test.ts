import { describe, expect, it } from "vitest";
import { formatAdminAuditValue, getAdminAuditEntityLabel } from "./admin-audit";

describe("admin audit labels", () => {
  it("translates known states and preserves unknown values for traceability", () => {
    expect(formatAdminAuditValue("in_progress")).toBe("Em análise");
    expect(formatAdminAuditValue("provider_specific_state")).toBe("provider_specific_state");
  });

  it("uses readable labels for moderated entities and a safe fallback", () => {
    expect(getAdminAuditEntityLabel("marketplace_products")).toBe("Anúncio de produto");
    expect(getAdminAuditEntityLabel("unexpected_table")).toBe("Registro");
  });
});
