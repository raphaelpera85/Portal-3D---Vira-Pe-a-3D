import { describe, expect, it } from "vitest";
import { SUPPORT_ATTACHMENT_MAX_BYTES, validateSupportAttachments } from "./support-attachments";

describe("validateSupportAttachments", () => {
  it("accepts supported document and image types within limits", () => {
    expect(validateSupportAttachments([
      { name: "nota.pdf", type: "application/pdf", size: 1000 },
      { name: "captura.webp", type: "image/webp", size: 2000 },
    ])).toBeNull();
  });

  it("rejects mismatched types, unsafe names, and oversized files", () => {
    expect(validateSupportAttachments([{ name: "arquivo.html", type: "application/pdf", size: 100 }])).toContain("extensão correspondente");
    expect(validateSupportAttachments([{ name: "../privado.pdf", type: "application/pdf", size: 100 }])).toContain("nomes");
    expect(validateSupportAttachments([{ name: "grande.pdf", type: "application/pdf", size: SUPPORT_ATTACHMENT_MAX_BYTES + 1 }])).toContain("2 MiB");
  });

  it("limits each response to three files and four MiB combined", () => {
    const file = (name: string, size: number) => ({ name, type: "application/pdf", size });
    expect(validateSupportAttachments([file("a.pdf", 1), file("b.pdf", 1), file("c.pdf", 1), file("d.pdf", 1)])).toContain("no máximo 3");
    expect(validateSupportAttachments([file("a.pdf", 2 * 1024 * 1024), file("b.pdf", 2 * 1024 * 1024), file("c.pdf", 1)])).toContain("4 MiB");
  });
});
