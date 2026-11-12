export type HomepageBannerInput = {
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string | null;
  actionLabel: string;
  actionHref: string;
  sortOrder: number;
  isActive: boolean;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const inRange = (value: string, min: number, max: number) => value.length >= min && value.length <= max;
const isLocalPath = (value: string) => {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\r\n\t]/.test(value)) return false;
  try { return new URL(value, "https://virapeca.invalid").origin === "https://virapeca.invalid"; } catch { return false; }
};

export function validateHomepageBanner(values: Record<string, unknown>): HomepageBannerInput | null {
  const eyebrow = text(values.eyebrow);
  const title = text(values.title);
  const description = text(values.description);
  const rawImageUrl = text(values.imageUrl);
  const rawImageAlt = text(values.imageAlt);
  const actionLabel = text(values.actionLabel);
  const actionHref = text(values.actionHref);
  const rawSortOrder = text(values.sortOrder);
  const sortOrder = /^\d{1,4}$/.test(rawSortOrder) ? Number(rawSortOrder) : -1;

  if (eyebrow.length > 60 || !inRange(title, 4, 90) || !inRange(description, 10, 240)
    || !inRange(actionLabel, 2, 30) || !isLocalPath(actionHref) || actionHref.length > 200
    || sortOrder < 0 || sortOrder > 9999) return null;

  let imageUrl: string | null = null;
  if (rawImageUrl) {
    try {
      const url = new URL(rawImageUrl);
      if (url.protocol !== "https:" || url.username || url.password || rawImageUrl.length > 2048
        || !inRange(rawImageAlt, 3, 160)) return null;
      imageUrl = url.toString();
    } catch { return null; }
  } else if (rawImageAlt) return null;

  return {
    eyebrow, title, description, imageUrl, imageAlt: imageUrl ? rawImageAlt : null,
    actionLabel, actionHref, sortOrder,
    isActive: values.isActive === true || values.isActive === "on" || values.isActive === "true",
  };
}
