import { describe, expect, it } from "vitest";
import { validatePrinterModelSuggestion } from "./printer-model-suggestion";

const suggestion = {
  manufacturer: "  Bambu Lab ",
  model: "  P2S ",
  variant: "  Combo  ",
  technology: "FDM",
  sourceUrl: "https://example.com/p2s",
  notes: "Versão com sistema multicolorido.",
};

describe("validatePrinterModelSuggestion", () => {
  it("normalizes a valid suggestion without approving or publishing technical facts", () => {
    expect(validatePrinterModelSuggestion(suggestion)).toEqual({
      manufacturer: "Bambu Lab",
      model: "P2S",
      variant: "Combo",
      technology: "FDM",
      sourceUrl: "https://example.com/p2s",
      notes: "Versão com sistema multicolorido.",
    });
  });

  it("defaults the variant and permits a source to be reviewed later", () => {
    expect(validatePrinterModelSuggestion({ ...suggestion, variant: "", sourceUrl: "" })).toMatchObject({ variant: "standard", sourceUrl: null });
  });

  it("rejects unsupported technologies, unsafe sources, and oversized fields", () => {
    expect(validatePrinterModelSuggestion({ ...suggestion, model: "" })).toBeNull();
    expect(validatePrinterModelSuggestion({ ...suggestion, technology: "CNC" })).toBeNull();
    expect(validatePrinterModelSuggestion({ ...suggestion, sourceUrl: "http://example.com" })).toBeNull();
    expect(validatePrinterModelSuggestion({ ...suggestion, sourceUrl: "https://user:secret@example.com/model" })).toBeNull();
    expect(validatePrinterModelSuggestion({ ...suggestion, notes: "x".repeat(1001) })).toBeNull();
  });
});
