export type DesignerServiceRequestInput = {
  title: string;
  brief: string;
  dueDate: string | null;
  referenceUrl: string | null;
};

export function validateDesignerServiceRequest(
  values: Record<string, unknown>,
  today: string,
): DesignerServiceRequestInput | null {
  const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const title = text(values.title);
  const brief = text(values.brief);
  const rawDueDate = text(values.dueDate);
  const rawReferenceUrl = text(values.referenceUrl);
  if (title.length < 3 || title.length > 120 || /[\u0000-\u001f\u007f]/.test(title)
    || brief.length < 30 || brief.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(brief)
    || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;

  let dueDate: string | null = null;
  if (rawDueDate) {
    const parsed = new Date(`${rawDueDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDueDate) || Number.isNaN(parsed.valueOf())
      || parsed.toISOString().slice(0, 10) !== rawDueDate || rawDueDate < today) return null;
    dueDate = rawDueDate;
  }

  let referenceUrl: string | null = null;
  if (rawReferenceUrl) {
    try {
      const url = new URL(rawReferenceUrl);
      if (url.protocol !== "https:" || url.username || url.password || rawReferenceUrl.length > 1000) return null;
      referenceUrl = url.toString();
    } catch { return null; }
  }

  return { title, brief, dueDate, referenceUrl };
}
