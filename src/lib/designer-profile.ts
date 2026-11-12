export type DesignerProfileInput = {
  displayName: string;
  biography: string;
  portfolioUrl: string | null;
  city: string | null;
  stateCode: string | null;
  specialties: string[];
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function validateDesignerProfile(values: Record<string, unknown>): DesignerProfileInput | null {
  const displayName = text(values.displayName);
  const biography = text(values.biography);
  const rawPortfolioUrl = text(values.portfolioUrl);
  const city = text(values.city);
  const rawStateCode = text(values.stateCode);
  const specialties = text(values.specialties).split(",").map((value) => value.trim()).filter(Boolean);
  if (displayName.length < 2 || displayName.length > 80 || biography.length < 30 || biography.length > 1200
    || city.length > 60 || specialties.length < 1 || specialties.length > 8
    || specialties.some((specialty) => specialty.length < 2 || specialty.length > 40 || /[\u0000-\u001f\u007f]/.test(specialty))) return null;
  const stateCode = rawStateCode ? rawStateCode.toUpperCase() : null;
  if (stateCode && !/^[A-Z]{2}$/.test(stateCode)) return null;
  let portfolioUrl: string | null = null;
  if (rawPortfolioUrl) {
    try {
      const url = new URL(rawPortfolioUrl);
      if (url.protocol !== "https:" || url.username || url.password || rawPortfolioUrl.length > 500) return null;
      portfolioUrl = url.toString();
    } catch { return null; }
  }
  return { displayName, biography, portfolioUrl, city: city || null, stateCode, specialties };
}

export function makeDesignerSlug(displayName: string, suffix: string) {
  const base = displayName.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "designer";
  return `${base}-${suffix.toLowerCase()}`;
}
