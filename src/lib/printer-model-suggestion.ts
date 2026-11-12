const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const technologies = ["FDM", "SLA", "MSLA", "DLP"] as const;

function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validatePrinterModelSuggestion(values: Record<string, unknown>) {
  const manufacturer = text(values.manufacturer);
  const model = text(values.model);
  const variant = text(values.variant) || "standard";
  const technology = text(values.technology);
  const sourceUrl = text(values.sourceUrl);
  const notes = text(values.notes);

  if (manufacturer.length < 2 || manufacturer.length > 100 || !model || model.length > 120
    || variant.length > 80 || !technologies.includes(technology as typeof technologies[number])
    || sourceUrl.length > 2048 || (sourceUrl && !isSafeHttpsUrl(sourceUrl))
    || notes.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(notes)) return null;

  return { manufacturer, model, variant, technology, sourceUrl: sourceUrl || null, notes };
}
